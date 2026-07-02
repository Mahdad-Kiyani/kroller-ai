# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`wi-ai-service` is a NestJS microservice for the W&I (Warranties & Indemnities) insurance platform. It handles AI-driven SPA document parsing, warranty categorisation, exclusion impact mapping, and coverage-position suggestions via a learning loop. It is one microservice in a larger platform — it stores only what AI needs; business state lives upstream.

## Commands

```bash
# Dev
npm run start:dev        # watch mode
npm run typecheck        # tsc --noEmit (no emit)
npm run lint             # eslint src/**/*.ts

# Tests
npm run test:unit        # test/unit/**/*.spec.ts
npm run test:integration # test/integration/**/*.spec.ts (requires real DB + Redis)
npm test                 # both projects

# Database (Prisma)
npm run prisma:generate  # regenerate client after schema change
npm run prisma:migrate   # create + apply migration (dev)
npm run prisma:deploy    # apply migrations (prod/CI)

# Infrastructure
docker compose up -d     # postgres (pgvector), redis, minio + bucket setup
```

Copy `.env.example` to `.env` and fill in `ANTHROPIC_API_KEY` and `EMBEDDINGS_API_KEY` before running locally.

### Gotchas

- **Port 5432 conflict**: a local Postgres install also binds 5432. `docker-compose.yml` forwards host **5434** → container 5432 to avoid the clash — `DATABASE_URL` must use `localhost:5434`. Using 5432 hits the local Postgres with wrong credentials (`28P01 invalid_password`).
- **Build entry point is `dist/src/main.js`, not `dist/main.js`** — `nest-cli.json` sets `sourceRoot: "src"`, so compiled output nests one level deeper. `npm run start:prod` already uses the right path; a manual `node dist/main.js` will fail.
- **Prisma 7 skips `.env` auto-load on CLI commands.** `prisma.config.ts` at the repo root bridges this via `process.loadEnvFile('.env')`. "Connection url is empty" means `.env` is missing or this file isn't being picked up.
- `.claude/skills/run-wi-ai-service/smoke.ps1` builds, boots the server, exercises every live endpoint (health, auth guard, deals, warranties, exclusions), and tears down — use it to verify the service end-to-end after a change instead of manual curl/Invoke-RestMethod calls.

## Architecture

**DDD + CQRS** with NestJS `@nestjs/cqrs`. Every module has four layers:

```
src/modules/<name>/
  domain/          ← aggregates, value objects, repository PORT (interface). No Prisma, no NestJS.
  application/     ← command handlers, query handlers, application port interfaces
  infrastructure/  ← Prisma repository ADAPTERS, Claude AI adapters, BullMQ processors
  interface/       ← NestJS controllers, DTOs
```

`src/shared/` holds cross-cutting infrastructure: `prisma/` (service + module), `ai/` (ClaudeClient), `embeddings/` (EmbeddingPort, VectorStore, HttpEmbeddingAdapter), `storage/` (MinIO adapter), `config/configuration.ts` (typed AppConfig), `audit/`.

**Path aliases** (`tsconfig.json` + `jest.config.js`):
- `@shared/*` → `src/shared/*`
- `@modules/*` → `src/modules/*`

## Modules

| Module | Responsibility |
|--------|---------------|
| `deals` | Lightweight deal container (externalRef, name, governingLaw). Owned by the panel; this service only references it. |
| `warranties` | Core: upload doc → MinIO → `warranty-parse` BullMQ queue → Claude parsing → ingest warranties → `warranty-embed` queue → embed. Human override of category or position triggers domain events. |
| `exclusions` | Create exclusions; `map-exclusion-impact` uses Claude to score which warranties each exclusion touches. |
| `suggestions` | Learning loop: embed each undecided warranty, vector-search past decided warranties (same category, different deal), apply `SuggestionPolicy.fromNeighbours()` to produce a suggested coverage position. |

## Key design decisions

**Repository pattern**: Domain repositories are interfaces in `domain/`; Prisma implementations live in `infrastructure/`. Aggregates never import Prisma.

**AI seam**: `ClaudeClient` (`src/shared/infrastructure/ai/claude.client.ts`) is the single HTTP-to-Claude point. Module-level adapters (e.g. `ClaudeWarrantyParser`, `ClaudeExclusionMapper`) implement application ports and consume `ClaudeClient`. To swap the AI provider, replace those adapters only.

**Learning loop**: `VectorStore` wraps pgvector raw SQL (`Unsupported("vector(1536)")` column on `Warranty`). `GenerateSuggestionsHandler` does embedding → `findDecidedNeighbours` → `SuggestionPolicy.fromNeighbours()` — no retraining needed, improves with every human `decidedPosition`.

**Background processing**: Two BullMQ queues in warranties (`warranty-parse`, `warranty-embed`). Processors are thin — they dispatch to `CommandBus`. Do not put business logic in processors.

**Auth**: `ApiKeyGuard` validates `x-api-key` header against `SERVICE_API_KEY`. Mark public endpoints with `@Public()` decorator.

**AuditLog**: Immutable append-only table captures AI suggestion vs human decision for every override/position decision (7-year retention per schema comment).

## Infrastructure dependencies

| Service | Purpose | Default local port |
|---------|---------|-------------------|
| PostgreSQL 16 + pgvector | Main DB + vector search | 5432 |
| Redis 7 | BullMQ job queues | 6379 |
| MinIO | Document object storage | 9000 (API), 9001 (console) |

`docker-compose.yml` includes a `minio-setup` one-shot that creates the `wi-documents` bucket on first start.

## API surface (all prefixed `/api/v1`)

```
POST   /deals                              create deal
GET    /deals, GET /deals/:id             list / get deal
POST   /deals/:id/documents               upload SPA doc → MinIO → async parse
GET    /deals/:id/documents               list documents + live parse status (poll for per-doc loading state)
GET    /documents/:id                     get one document's parse status
GET    /deals/:id/warranties              list warranties
GET    /warranties/:id                    get warranty
PATCH  /warranties/:id/category           human override (audited)
PATCH  /warranties/:id/position           human decision (learning signal)
POST   /deals/:id/suggestions/generate    compute positions via pgvector precedent
GET    /warranties/:id/similar            nearest decided precedent
POST   /deals/:id/exclusions              create exclusion
POST   /deals/:id/exclusions/:exId/map    AI exclusion impact mapping
GET    /deals/:id/exclusions              list exclusions with impacts
```

## Testing

Unit tests (`test/unit/`) cover domain value objects and aggregates — no I/O.

Integration tests (`test/integration/`) wire real command handlers but replace all external I/O with fakes from `test/support/fakes.ts` (`FakeWarrantyParser`, `FakeEmbeddingPort`, `FakeVectorStore`, `FakeStoragePort`) and in-memory repositories (`test/support/in-memory-*.repository.ts`). These tests require a real Postgres + Redis from `docker compose up -d`.

To add a new port, provide a fake in `test/support/fakes.ts` following the existing pattern.

## Schema notes

- `Warranty.embedding` is `Unsupported("vector(1536)")` — raw pgvector, not a Prisma type. Vector operations use `prisma.$queryRaw`.
- `Warranty.spaReference` is the verbatim SPA numbering from the source document — never regenerate or normalise it.
- `aiCategory`/`aiConfidence` are immutable once set (AI suggestion); `category` is the effective value after optional human `overriddenBy`.
- Similarly `aiPosition*` is the suggestion; `decidedPosition` is the human signal used for the learning loop.
