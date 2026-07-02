# W&I AI Service

An **AI microservice** for the W&I (Warranty & Indemnity) insurance platform. It is consumed
over a service API key by the panel, the insurer portal, and any other internal service — it
owns no UI of its own. It covers the platform's AI surface end to end:

| Capability | What it does | Endpoint(s) |
|---|---|---|
| **Parse** | Extract warranties from an SPA document (title, text, SPA reference) via Claude | `POST /deals/:id/documents` |
| **Categorise** | Classify each warranty into the **4 buckets** (`FUNDAMENTAL`, `BUSINESS`, `TAX`, `TAX_INDEMNITY`) with a per-row confidence | (same upload flow) |
| **Override** | Human corrects a category — AI suggestion preserved, change audited | `PATCH /warranties/:id/category` |
| **Exclusion impact** | AI maps an exclusion onto the warranties it affects, with rationale + confidence | `POST /deals/:id/exclusions/:exId/map` |
| **Suggest** | Suggest a coverage position + comment from precedent, via pgvector retrieval | `POST /deals/:id/suggestions/generate` |
| **Decide** | Human decides the position — audited; the warranty becomes precedent | `PATCH /warranties/:id/position` |
| **Learning loop** | Every AI-suggestion-vs-human-decision is recorded; suggestions sharpen as decided history grows — **no retraining** | (audit + embeddings, automatic) |

Interactive API docs (Swagger UI) with sample data on every endpoint: **`/api/docs`**.

---

## Architecture

Domain-Driven Design with CQRS (NestJS + `@nestjs/cqrs`). Four bounded contexts plus a shared
kernel; AI and infrastructure live strictly behind **ports**, so swapping a provider is a
one-class change.

```
src/
├── shared/
│   ├── domain/                 # kernel: Result, Guard, AggregateRoot, ValueObject, events
│   └── infrastructure/
│       ├── prisma/             # PrismaService (the only place that imports Prisma)
│       ├── config/             # typed AppConfig
│       ├── audit/              # AuditLogger — the AI-vs-human trail (learning loop)
│       ├── storage/            # StoragePort  ← MinioStorageAdapter (S3-compatible)
│       ├── ai/                 # ClaudeClient (the single HTTP-to-Claude seam)
│       └── embeddings/         # EmbeddingPort + VectorStore (pgvector cosine search)
└── modules/
    ├── auth/                   # service API-key guard (x-api-key), @Public() opt-out
    ├── deals/                  # lightweight engagement grouping (panel owns the real deal)
    ├── warranties/             # parse · categorise · override · decide   (AI core)
    ├── exclusions/             # AI exclusion-impact mapping
    └── suggestions/            # coverage-position suggestions (retrieval over precedent)
```

Each context is layered:

```
interface/        Controllers + DTOs (Swagger). HTTP only — no business logic.
application/      Commands, Queries, Handlers, Ports. Orchestration.
domain/           Aggregates, Value Objects, domain events. Pure — no framework, no I/O.
infrastructure/   Prisma repositories, AI adapters, BullMQ processors.
```

### Where the AI actually lives

The whole service touches AI in exactly **four swappable classes**:

- `warranties/infrastructure/claude-warranty-parser.adapter.ts` — parsing & categorisation
- `exclusions/infrastructure/claude-exclusion-mapper.adapter.ts` — exclusion-impact mapping
- `suggestions/domain/suggestion-policy.ts` — turns retrieved precedent into a suggestion
- `shared/infrastructure/embeddings/http-embedding.adapter.ts` — embeddings provider

Want self-hosting, an enterprise zero-retention endpoint, or a different model? Replace one
adapter; nothing else in the codebase knows or cares.

### The learning loop

1. A warranty is categorised → it is **embedded** (async, BullMQ) and stored as a pgvector.
2. To suggest a position, the service runs a **category-filtered cosine search** over warranties
   from *other* deals that already carry a **human-decided** position.
3. `SuggestionPolicy` aggregates that precedent (similarity-weighted majority) into a suggested
   position + comment + confidence.
4. The human decision is recorded in `AuditLog` (AI suggestion *before* vs human decision *after*)
   and the decided warranty itself becomes precedent for the next deal.

More decided deals ⇒ better suggestions, with **no model training**. Everything lives in one
PostgreSQL instance (relational + `vector` + full-text + audit).

---

## Running it

### With Docker (everything: app + Postgres/pgvector + Redis + MinIO)

```bash
# optional: provide real keys (otherwise AI calls will fail but the service still boots)
export ANTHROPIC_API_KEY=sk-ant-...
export EMBEDDINGS_API_KEY=sk-...

docker compose up --build
```

This starts Postgres (with `pgvector`), Redis, MinIO (console on `:9001`), creates the
`wi-documents` bucket, applies migrations, and launches the service on **`http://localhost:3000`**
(`/api/docs`).

### Locally (Node 22)

```bash
npm install
cp .env.example .env                 # then edit keys
npx prisma migrate deploy            # or: npx prisma db push
npm run start:dev
```

---

## Tests

```bash
npm run test:unit          # pure domain: value objects, aggregate, suggestion policy
npm run test:integration   # application handlers with in-memory fakes (audit, AI behaviour)
npm test                   # unit + integration
npm run test:e2e           # boots the real app vs Postgres, fakes external AI/storage/embeddings
npm run typecheck          # tsc --noEmit
```

- **Unit** — no I/O; the 4-bucket taxonomy, confidence threshold, the override/decide invariants,
  and the similarity-weighted suggestion vote.
- **Integration** — handlers wired to in-memory repositories and fake adapters; asserts that
  overrides/decisions write the correct AI-vs-human audit entries and that suggestions are
  computed from precedent.
- **E2E** — real HTTP against a real Postgres; Claude/embeddings/MinIO are replaced with
  deterministic fakes so the suite is hermetic. Covers auth, the full warranty lifecycle, the
  suggestion path, and exclusion mapping. (`docker compose` provides the test Postgres + Redis.)

---

## API at a glance

All routes are versioned under `/api/v1` (health is `/api/health`). Send the key as `x-api-key`.

```
POST   /api/v1/deals                                   register an engagement
GET    /api/v1/deals            GET /api/v1/deals/:id
POST   /api/v1/deals/:id/documents                     upload SPA → MinIO → async AI parse
GET    /api/v1/deals/:id/warranties
GET    /api/v1/warranties/:id
PATCH  /api/v1/warranties/:id/category                 human override (audited)
PATCH  /api/v1/warranties/:id/position                 human decision (audited, learning signal)
POST   /api/v1/deals/:id/suggestions/generate          AI positions from precedent
GET    /api/v1/warranties/:id/similar                  nearest decided precedent (retrieval demo)
POST   /api/v1/deals/:id/exclusions                    create exclusion
POST   /api/v1/deals/:id/exclusions/:exId/map          AI impact mapping (audited)
GET    /api/v1/deals/:id/exclusions                     exclusions with mapped impacts
```

---

## Production hardening (documented TODOs)

The architecture is complete; these are deployment concerns, not missing pieces:

- **Identity** — controllers use a placeholder `actorId = 'service'`. Wire the authenticated
  principal (panel/portal user) through so the audit trail names the real human.
- **Presigned URLs** — when MinIO sits behind a reverse proxy, set the public-facing endpoint so
  signed URLs match the host the browser sees (server-side fetch already works as-is).
- **Embedding dimension** — schema and config default to **1536** (`text-embedding-3-small`). If
  you switch providers, set `EMBEDDING_DIM` *and* the `vector(N)` column to match.
- **Claude/embeddings keys** — provide real `ANTHROPIC_API_KEY` / `EMBEDDINGS_API_KEY`; for
  sensitive M&A data, point the adapters at a zero-retention or self-hosted endpoint.
- **Rate limiting / retries** — BullMQ already retries parse jobs; add provider-side backoff and
  a dead-letter queue for repeated AI failures.
#   k r o l l e r - a i  
 