---
name: prisma-wi-ai-service
description: Prisma setup, schema, migration, adapter pattern, pgvector raw SQL, and advanced Prisma engineering for wi-ai-service. Use when asked to change the schema, add a migration, work with the vector column, query raw SQL, debug Prisma config, or understand how PrismaService is wired.
---

# Prisma — wi-ai-service

Prisma **7.8.0** with `@prisma/adapter-pg` (driver-adapter mode). PostgreSQL 16 + pgvector extension. DDD architecture: domain aggregates never import Prisma — only `infrastructure/` repositories do.

## Configuration files

| File | Role |
|---|---|
| `prisma/schema.prisma` | Schema + enums + models. **No `url =` in datasource** (Prisma 7 moved this). |
| `prisma.config.ts` | Connection URL for CLI commands (`prisma migrate`, `prisma generate`). |
| `src/shared/infrastructure/prisma/prisma.service.ts` | Runtime: creates `pg.Pool`, passes `PrismaPg` adapter to `PrismaClient` constructor. |
| `src/shared/infrastructure/prisma/prisma.module.ts` | `@Global()` NestJS module — exports `PrismaService` project-wide. |

## schema.prisma — key decisions

```prisma
datasource db {
  provider   = "postgresql"
  extensions = [pgvector(map: "vector")]
  // NO url here — Prisma 7 removed url from schema. Connection lives in prisma.config.ts.
}

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]  // required for extensions block above
}
```

**Unsupported columns** (pgvector + tsvector — no native Prisma type):
```prisma
embedding    Unsupported("vector(1536)")?
searchVector Unsupported("tsvector")?
```
These columns exist in the DB but Prisma cannot read/write them via its typed API.
All operations on them use `prisma.$executeRawUnsafe` / `prisma.$queryRawUnsafe` (see VectorStore below).

**`spaReference` invariant**: never regenerate or normalise — verbatim from source SPA doc.
**`aiCategory` / `aiConfidence`**: immutable once set (AI suggestion). `category` is the effective value after optional human `overriddenBy`.
**`decidedPosition`**: human signal — the learning loop input.

## prisma.config.ts — CLI connection

```typescript
import { defineConfig } from 'prisma/config';

// Prisma 7 skips .env auto-load when this file is present.
// process.loadEnvFile (Node 20+) bridges the gap for local dev.
try {
  process.loadEnvFile('.env');
} catch { /* CI: env vars already in shell */ }

export default defineConfig({
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
```

**Why**: Prisma 7 requires the datasource URL to live in `prisma.config.ts` (not `schema.prisma`). The CLI reads this file; the runtime (`PrismaService`) reads it through the adapter passed to the constructor.

Valid `defineConfig` keys in 7.8.0: `datasource`, `migrate`, `generate`, `studio`. **`engine` was removed** — do not add it.

## PrismaService — runtime adapter

```typescript
// src/shared/infrastructure/prisma/prisma.service.ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;

  constructor() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    super({ adapter: new PrismaPg(pool) });  // Prisma 7: adapter replaces datasourceUrl
    this.pool = pool;
  }

  async onModuleInit(): Promise<void> { await this.$connect(); }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    await this.pool.end();   // must end pool explicitly — otherwise Node hangs on shutdown
  }
}
```

**Why `adapter` and not `datasourceUrl`**: Prisma 7 removed `datasourceUrl` from `PrismaClientOptions`. The only valid runtime connection paths are `adapter` (direct DB, via `@prisma/adapter-pg`) or `accelerateUrl` (Prisma Accelerate). The adapter owns the `pg.Pool` lifecycle; the service must call `pool.end()` on destroy.

**Do not** pass a connection string to `PrismaClient` directly — it will throw `PrismaClientInitializationError: needs non-empty PrismaClientOptions`.

## VectorStore — pgvector raw SQL

`Warranty.embedding` is `Unsupported("vector(1536)")` — Prisma can't serialize it. All vector ops use raw SQL:

```typescript
// Save an embedding
await this.prisma.$executeRawUnsafe(
  `UPDATE "Warranty" SET embedding = $1::vector WHERE id = $2`,
  `[${vec.join(',')}]`,   // pg expects '[0.1,0.2,...]' string literal, not an array
  warrantyId,
);

// Cosine-distance nearest-neighbour search (pgvector <=> operator)
const rows = await this.prisma.$queryRawUnsafe<SimilarWarranty[]>(
  `SELECT id, "dealId", "spaReference",
          "decidedPosition"::text AS "decidedPosition",
          "category"::text AS category,
          (embedding <=> $1::vector) AS distance
     FROM "Warranty"
    WHERE embedding IS NOT NULL
      AND "decidedPosition" IS NOT NULL
      AND "dealId" <> $2
      AND ($3::text IS NULL OR "category"::text = $3)
    ORDER BY embedding <=> $1::vector
    LIMIT $4`,
  literal, excludeDealId, category, limit,
);
```

**Traps**:
- Pass the vector as a string `[n,n,n]` with `$1::vector` — do NOT pass a JS array, `pg` won't coerce it.
- Enum columns (`decidedPosition`, `category`) come back as strings in raw query results, even though they're Postgres enums. Cast with `::text` in the SELECT and type the result rows accordingly.
- `$queryRaw` (tagged template) does NOT work with `Unsupported` columns and placeholders in the same query. Use `$queryRawUnsafe` with positional `$N` params.

## Migration workflow

```powershell
# Local dev: create + apply a named migration
npm run prisma:migrate -- --name <description>
# e.g.: npm run prisma:migrate -- --name add_search_vector_index

# CI / production: apply existing migrations without creating new ones
npm run prisma:deploy

# Regenerate the Prisma client after schema change (no migration)
npm run prisma:generate

# Sync schema without migration file (prototype only — do not use in prod)
npm run db:push
```

Migration files live at `prisma/migrations/<timestamp>_<name>/migration.sql`. Never edit them after applying — add a new migration instead.

The init migration (`prisma/migrations/0_init/`) was bootstrapped with `--name init` from a pre-existing DB dump. It includes `CREATE EXTENSION IF NOT EXISTS "vector"` (pgvector).

## Adding a new field

1. Edit `prisma/schema.prisma`.
2. `npm run prisma:migrate -- --name <what-changed>` → generates SQL + applies it.
3. `npm run prisma:generate` (migrate already does this, but explicit is safer).
4. Update the relevant repository adapter in `src/modules/<module>/infrastructure/`.
5. Domain aggregate and value objects stay Prisma-free.

**For `Unsupported` columns** (vector, tsvector): add the column via raw SQL in the migration file (Prisma cannot generate DDL for these). After `prisma migrate dev` generates the file, open it and add the `ALTER TABLE ... ADD COLUMN embedding vector(1536)` line manually before applying.

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `PrismaClientInitializationError: needs non-empty PrismaClientOptions` | Prisma 7 with no `adapter` passed | `PrismaService` constructor must call `super({ adapter: new PrismaPg(pool) })` |
| `error TS2353: 'datasourceUrl' does not exist` | Prisma 7 removed this option | Replace with adapter pattern |
| `error TS2353: 'engine' does not exist in PrismaConfig` | Prisma 7.8.0 removed `engine` from `defineConfig` | Remove the `engine` key |
| `Connection url is empty` | Prisma CLI ignores `.env` when `prisma.config.ts` exists | Confirm `prisma.config.ts` calls `process.loadEnvFile('.env')` |
| `P1000: Authentication failed` | Wrong port in `DATABASE_URL` — local Postgres on 5432 intercepts | Use `localhost:5434` (Docker maps `host:5434 → container:5432`) |
| `type "vector" does not exist` | pgvector extension not installed | Run `CREATE EXTENSION IF NOT EXISTS "vector"` or re-apply init migration |
| Raw query enum cast error | Postgres enums come back as opaque types | Add `::text` cast in SELECT for all enum columns |

## Gotchas

**Prisma 7 is a breaking upgrade from v6.** The three changes that affect this project:
1. `url` removed from `schema.prisma` datasource → moved to `prisma.config.ts`
2. `datasourceUrl` removed from `PrismaClientOptions` → replaced by `adapter`
3. `engine: 'classic'` removed from `defineConfig` → just delete it

**`pool.end()` is required** in `onModuleDestroy`. Without it the Node process hangs on shutdown because the `pg.Pool` keeps the event loop alive.

**`previewFeatures = ["postgresqlExtensions"]` is needed** even though pgvector is stable. The `extensions = [...]` block in `datasource` is gated by this preview feature — remove it and schema validation fails.

**`--legacy-peer-deps` on install**: `ts-jest@27` declares a peer dep on `jest@27`; the project uses `jest@30`. npm refuses to install without the flag. This is a pre-existing conflict; do not try to resolve it by downgrading jest.
