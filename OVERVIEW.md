# wi-ai-service — Project Overview

A plain-language + technical guide to **what this service is, how it works, how to use it, and how its AI answers get better over time.**

> This document is a companion to [CLAUDE.md](CLAUDE.md) (which is written for the AI coding assistant). This one is written for humans onboarding to the project.

---

## 1. What this is (in one paragraph)

`wi-ai-service` is a **NestJS microservice** for the **W&I (Warranties & Indemnities) insurance** platform. In a W&I deal, an insurer reviews a **Share Purchase Agreement (SPA)** — a long legal contract full of *warranties* (statements the seller guarantees to be true) — and decides, for each one, whether it will be **covered, partially covered, or excluded** from the insurance policy.

This service does the AI-heavy parts of that workflow:

1. **Reads the SPA** and extracts every warranty as structured data.
2. **Categorises** each warranty (Fundamental / Business / Tax / Tax-indemnity).
3. **Maps exclusions** — given a policy exclusion, works out which warranties it touches.
4. **Suggests a coverage position** for each warranty, learning from how underwriters decided on *past* deals.

It is **one microservice in a bigger platform.** It deliberately stores **only what the AI needs** (documents, extracted warranties, embeddings, decisions). The authoritative business state lives in other services upstream.

---

## 2. The core concepts (glossary)

| Term | Meaning |
|------|---------|
| **Deal** | A single transaction. Lightweight container: `externalRef`, `name`, `governingLaw`. Owned upstream; this service only references it. |
| **SPA** | Share Purchase Agreement — the source legal document uploaded per deal. |
| **Warranty** | One extracted clause from the SPA. The central entity in this service. |
| **Category** | The warranty's type: `FUNDAMENTAL`, `BUSINESS`, `TAX`, `TAX_INDEMNITY`. |
| **Coverage position** | The underwriting decision for a warranty (e.g. covered / excluded / partial). |
| **Exclusion** | A carve-out in the policy; the service maps which warranties it affects. |
| **Suggestion** | An AI-proposed coverage position, derived from precedent (past decided warranties). |

### The AI-vs-human split (the single most important design rule)

Every AI output and every human decision are stored **in separate fields** and never overwrite each other:

| Concept | AI's output (a *suggestion*, immutable) | Human's answer (the *truth*, the learning signal) |
|---------|----------------------------------------|---------------------------------------------------|
| Category | `aiCategory`, `aiConfidence` | `category` + `overriddenBy` |
| Position | `aiPosition`, `aiComment`, `aiPositionScore` | `decidedPosition`, `decidedComment`, `decidedBy` |

Because they never collide, the system can always answer *"what did the AI say vs. what did the human decide?"* — which is exactly the data the audit trail and the learning loop feed on. (See [warranty.aggregate.ts](src/modules/warranties/domain/warranty.aggregate.ts).)

---

## 3. How it works — the end-to-end flow

```
                 ┌─────────────────────────────────────────────────────────────┐
                 │                     wi-ai-service                            │
                 │                                                              │
  Upload SPA ───▶│  1. Store doc in MinIO                                       │
  (PDF/DOCX)     │  2. Enqueue  warranty-parse  (BullMQ / Redis)                │
                 │        │                                                     │
                 │        ▼                                                     │
                 │  3. Claude extracts + categorises warranties  ──┐            │
                 │        │                                        │ per warranty│
                 │        ▼                                        ▼            │
                 │  4. Ingest warranties  ──▶ WarrantyCategorised event         │
                 │        │                          │                          │
                 │        │                          ▼                          │
                 │        │                  5. Enqueue warranty-embed          │
                 │        │                          │                          │
                 │        │                          ▼                          │
                 │        │                  6. Embed → store pgvector          │
                 │        ▼                                                     │
  Human reviews ▶│  7. PATCH category / position  (audited, learning signal)    │
                 │        │                                                     │
                 │        ▼                                                     │
  Generate ─────▶│  8. For each warranty: embed → vector-search PAST decided    │
  suggestions    │        warranties → SuggestionPolicy → suggested position    │
                 └─────────────────────────────────────────────────────────────┘
```

### Step-by-step

1. **Upload** — `POST /deals/:id/documents`. The document is streamed to **MinIO** (object storage) and a `warranty-parse` job is enqueued on **Redis/BullMQ**. The HTTP request returns immediately; parsing is asynchronous. See [upload-document.handler.ts](src/modules/warranties/application/commands/upload-document.handler.ts).

2. **Parse (Claude)** — the `warranty-parse` processor pulls the doc from MinIO, extracts its text, and asks Claude for a **structured JSON array** of warranties. Big SPAs are **split into size-based chunks and classified in parallel** (see §5), then merged and de-duplicated. See [claude-warranty-parser.adapter.ts](src/modules/warranties/infrastructure/claude-warranty-parser.adapter.ts).

3. **Ingest** — each parsed row becomes a `Warranty` aggregate (`aiCategory` + `aiConfidence` set, `category` initialised to the AI value). Creating one raises a **`WarrantyCategorisedEvent`**.

4. **Embed** — that event enqueues a `warranty-embed` job. The processor embeds the warranty text and stores the vector in the pgvector `embedding` column, making the warranty **retrievable as future precedent**. See [warranty-categorised.handler.ts](src/modules/warranties/infrastructure/warranty-categorised.handler.ts).

5. **Human review** — underwriters correct the category (`PATCH /warranties/:id/category`) or record the coverage decision (`PATCH /warranties/:id/position`). The position decision is the **learning signal**. Both are written to the immutable **AuditLog**.

6. **Suggestions** — `POST /deals/:id/suggestions/generate` runs the learning loop (§4) across every warranty in the deal.

7. **Exclusions** — `POST /deals/:id/exclusions/:exId/map` gives Claude the exclusion text plus the deal's warranties and asks which ones it affects; hallucinated IDs are filtered out. See [claude-exclusion-mapper.adapter.ts](src/modules/exclusions/infrastructure/claude-exclusion-mapper.adapter.ts).

---

## 4. How the AI gets better over time (the learning loop)

This is the heart of the product, and it's worth understanding clearly: **there is no model training and no fine-tuning.** The AI improves purely because it can retrieve more real human decisions as the platform accumulates deals. This is often called **retrieval-augmented / precedent-based** learning.

### How one suggestion is produced

For each warranty needing a position ([generate-suggestions.handler.ts](src/modules/suggestions/application/commands/generate-suggestions.handler.ts)):

1. **Embed** the warranty's `title + fullText` into a 1536-dimension vector.
2. **Vector-search** for the *nearest* past warranties that already have a **human-decided position**, restricted to:
   - the **same category** (fundamental compared with fundamental, etc.), and
   - **other deals** (`dealId <> current` — never learn from itself).
   See the raw pgvector SQL in [vector-store.service.ts](src/shared/infrastructure/embeddings/vector-store.service.ts).
3. **Vote** — [SuggestionPolicy.fromNeighbours()](src/modules/suggestions/domain/suggestion-policy.ts) turns those neighbours into one suggestion:
   - **Similarity-weighted majority vote** on the position — closer precedents count more (`weight = 1 / (1 + distance)`).
   - A **representative comment** copied from the closest matching precedent.
   - A **confidence score** derived from the nearest neighbour's distance.
   - Returns `null` (skips) when there is no decided precedent yet.

The result is attached as `aiPosition` / `aiComment` / `aiPositionScore` — a *suggestion*, never the final answer.

### Why it improves with use

```
  Deal #1: no precedent      → AI skips most warranties (nothing to learn from)
  Underwriter decides them   → decisions embedded & stored
  Deal #2: some precedent    → AI suggests where similar warranties were decided before
  ... more deals, more decided warranties ...
  Deal #N: rich precedent    → most warranties get a confident, well-justified suggestion
```

Every human `decidedPosition` becomes retrievable precedent for every *future* deal. More history ⇒ more (and closer) neighbours ⇒ better, higher-confidence suggestions — **with zero retraining.** The `SuggestionPolicy` is pure and deterministic, so it is fully unit-tested.

### What makes the loop trustworthy

- **AuditLog** ([audit-logger.service.ts](src/shared/infrastructure/audit/audit-logger.service.ts)) — an append-only, immutable table recording *AI suggestion vs. human decision* for every override/decision (7-year retention). It is described in the code as *"the load-bearing piece of the learning loop"*: it's what proves the precedent is genuine human judgment.
- **AI outputs are never mutated by humans** — corrections go into separate fields, so the training signal (real human decisions) stays clean and distinguishable from AI guesses.

### How to make suggestions better in practice

- **Decide more warranties.** The single biggest lever — every decision is a precedent.
- **Keep categories accurate.** Search is scoped by category; a mis-categorised warranty retrieves the wrong precedent pool. Override categories when the AI is wrong.
- **Write good `decidedComment`s.** The nearest precedent's comment is surfaced verbatim to the next underwriter as the rationale — quality comments compound.
- **Let deals accumulate before expecting confidence.** Early deals will legitimately skip warranties; that's the system honestly saying *"no precedent yet."*

---

## 5. Handling large documents (chunked parsing)

SPAs can run to hundreds of pages. Sending one giant request is slow and risks Claude's output being **truncated mid-JSON** (hitting the output-token cap), which makes the whole response unparseable. So the parser ([claude-warranty-parser.adapter.ts](src/modules/warranties/infrastructure/claude-warranty-parser.adapter.ts)):

- **Splits** text into chunks of ~`parseChunkChars` (default 12000), breaking **only on line boundaries** so a clause is never cut in half.
- **Classifies chunks in parallel** — up to `parseMaxConcurrency` (default 5) in flight, each with its own `parseMaxTokens` (default 8192) output budget.
- **Merges + de-duplicates** by `spaReference` (the same clause can appear at a chunk boundary).
- **Fails soft**: a chunk whose Claude call errors contributes zero rows instead of failing the whole document.
- **Salvages truncated output**: if a chunk's JSON is cut off, `salvageObjects()` recovers every *complete* `{...}` object (tracking string/escape state so a `}` inside verbatim clause text doesn't fool the scanner) rather than dropping the chunk.

These knobs live in [configuration.ts](src/shared/infrastructure/config/configuration.ts) under `ai.*` and are all environment-overridable.

---

## 6. Architecture at a glance

**DDD + CQRS** on NestJS `@nestjs/cqrs`. Every module has four layers:

```
src/modules/<name>/
  domain/          ← aggregates, value objects, repository PORT (interface). No Prisma, no NestJS.
  application/     ← command handlers, query handlers, port interfaces
  infrastructure/  ← Prisma repo ADAPTERS, Claude AI adapters, BullMQ processors
  interface/       ← controllers, DTOs
```

| Module | Responsibility |
|--------|----------------|
| `deals` | Lightweight deal container. Referenced, not owned. |
| `warranties` | Core: upload → parse → categorise → embed; human override/decision. |
| `exclusions` | Create exclusions; AI-map which warranties each one touches. |
| `suggestions` | The learning loop: embed → vector-search precedent → `SuggestionPolicy`. |

**The AI seam.** Every call to Claude goes through one class — [claude.client.ts](src/shared/infrastructure/ai/claude.client.ts) — and module-level adapters (`ClaudeWarrantyParser`, `ClaudeExclusionMapper`) consume it. **To swap AI provider, replace those adapters only.** The client also masks the API key in logs, honours SOCKS/HTTP proxies, and gives clear errors on timeout.

**Repository pattern.** Domain repositories are interfaces in `domain/`; Prisma implementations live in `infrastructure/`. Aggregates never import Prisma.

**Background work.** Two BullMQ queues (`warranty-parse`, `warranty-embed`). Processors are **thin** — they only dispatch to the `CommandBus`; business logic stays in handlers.

---

## 7. Infrastructure dependencies

| Service | Purpose | Default local port |
|---------|---------|--------------------|
| PostgreSQL 16 + **pgvector** | Main DB + vector similarity search | 5432 |
| Redis 7 | BullMQ job queues | 6379 |
| MinIO | Document (SPA) object storage | 9000 (API), 9001 (console) |
| **Claude API** | Parsing, categorisation, exclusion mapping | — (external) |
| **Embeddings API** | 1536-dim vectors for the learning loop | — (external) |

> `Warranty.embedding` is a raw pgvector `vector(1536)` column (Prisma `Unsupported`), so all vector reads/writes use `prisma.$queryRaw` in `VectorStore`.

---

## 8. Usage — getting it running

```bash
# 1. Config
cp .env.example .env      # fill in ANTHROPIC_API_KEY and EMBEDDINGS_API_KEY

# 2. Infrastructure (postgres + pgvector, redis, minio + bucket setup)
docker compose up -d

# 3. Database
npm run prisma:generate   # regenerate client after any schema change
npm run prisma:migrate    # create + apply migration (dev)

# 4. Run
npm run start:dev         # watch mode

# Quality
npm run typecheck         # tsc --noEmit
npm run lint

# Tests
npm run test:unit         # domain value objects + aggregates, no I/O
npm run test:integration  # real handlers, fake I/O ports; needs docker DB + Redis
npm test                  # both
```

### Auth

Every endpoint requires an `x-api-key` header matching `SERVICE_API_KEY` (`ApiKeyGuard`). Endpoints marked `@Public()` are exempt (e.g. health check).

### API surface (all prefixed `/api/v1`)

```
POST   /deals                             create deal
GET    /deals   |  GET /deals/:id         list / get deal
POST   /deals/:id/documents               upload SPA → MinIO → async parse
GET    /deals/:id/warranties              list warranties
GET    /warranties/:id                     get warranty
PATCH  /warranties/:id/category            human override        (audited)
PATCH  /warranties/:id/position            human decision        (learning signal)
POST   /deals/:id/suggestions/generate     compute positions via pgvector precedent
GET    /warranties/:id/similar             nearest decided precedent
POST   /deals/:id/exclusions               create exclusion
POST   /deals/:id/exclusions/:exId/map     AI exclusion-impact mapping
GET    /deals/:id/exclusions               list exclusions with impacts
```

### A typical session

1. `POST /deals` → get a `dealId`.
2. `POST /deals/:id/documents` with the SPA file → parsing kicks off in the background.
3. Poll `GET /deals/:id/warranties` until warranties appear (each with `aiCategory` + `aiConfidence`).
4. Review: `PATCH .../category` where the AI was wrong; `PATCH .../position` to record decisions.
5. `POST /deals/:id/suggestions/generate` → each undecided warranty gets an `aiPosition` drawn from precedent.
6. `POST /deals/:id/exclusions` then `.../map` to see which warranties an exclusion hits.

---

## 9. Gotchas worth knowing

- **`spaReference` is verbatim.** It's the original SPA numbering from the source document — never regenerate or normalise it.
- **`aiCategory` / `aiConfidence` / `aiPosition*` are immutable** once set. Human changes go to `category` / `decidedPosition` etc. This separation is what keeps the learning signal clean.
- **Suggestions can legitimately skip warranties** when there's no decided precedent in the same category from other deals. That's correct behaviour, not a bug.
- **Category accuracy drives suggestion quality** — retrieval is category-scoped.
- **Confidence has two meanings**: parsing/categorisation confidence comes *from Claude*; position-suggestion confidence comes *from vector distance* to the nearest precedent.

---

*Generated as a project orientation guide. For coding-assistant conventions and deeper wiring notes, see [CLAUDE.md](CLAUDE.md).*
