---
name: run-wi-ai-service
description: Run, start, build, test, screenshot, launch, or smoke-test the wi-ai-service NestJS API. Use when asked to verify the server starts, test endpoints, confirm a fix works, or exercise the API surface.
---

# run-wi-ai-service

NestJS REST API for W&I (Warranties & Indemnities) insurance AI. Driven by `smoke.ps1`, a PowerShell script that builds, starts, exercises all live endpoints, and stops the server. Infrastructure (Postgres, Redis, MinIO) runs in Docker.

All commands below were verified on this machine (Windows 10, Node 22, Windows PowerShell 5.1).

## Prerequisites

- Docker Desktop running
- Node 22 + npm installed
- `.env` present (copy from `.env.example` and fill `ANTHROPIC_API_KEY`, `EMBEDDINGS_API_KEY`)

**Gotcha — port 5432 conflict:** a local Postgres installation also binds 5432. The docker-compose uses host port **5434** to avoid the clash. `DATABASE_URL` in `.env` must use `localhost:5434`.

## Infrastructure

```powershell
docker compose up -d
# postgres (pgvector) on host:5434, redis on 6379, minio on 9000/9001
```

Wait for all three to show `(healthy)`:
```powershell
docker compose ps
```

## Database migration (first run / schema change)

```powershell
npm run prisma:migrate -- --name <description>
# or to apply without naming: npm run prisma:deploy
```

`prisma.config.ts` at the repo root loads `.env` automatically (Prisma 7 skips `.env` auto-load when this file exists; the file handles it via `process.loadEnvFile`).

## Run (agent path) — smoke script

```powershell
. .\.claude\skills\run-wi-ai-service\smoke.ps1
```

What it does:
1. `npm run build` → compiles to `dist/src/`
2. Clears port 3000 if occupied
3. Starts `node dist/src/main.js` in the background
4. Waits up to 20 s for "successfully started"
5. Exercises: health, auth guard (no key → 401, bad key → 401), create deal, list deals, get deal, list warranties, create exclusion, list exclusions
6. Stops the server; exits 0 on all green, 1 on any failure

To leave the server running after the smoke run:
```powershell
. .\.claude\skills\run-wi-ai-service\smoke.ps1 -KeepAlive
```

API key for manual follow-up requests (matches `.env` default):
```powershell
$H = @{ "x-api-key" = "dev-service-key-change-me"; "Content-Type" = "application/json" }
Invoke-RestMethod http://localhost:3000/api/health
Invoke-RestMethod http://localhost:3000/api/v1/deals -Headers $H
```

Swagger UI: http://localhost:3000/api/docs (no auth required to browse)

## Run (human path)

```powershell
npm run start:dev   # watch mode, port 3000
```

Press Ctrl-C to stop. Same port-conflict note applies.

## Build only

```powershell
npm run build          # compiles src/ → dist/src/
npm run typecheck      # tsc --noEmit, no emit
npm run lint           # eslint src/**/*.ts
```

Entry point after build: `dist/src/main.js` (not `dist/main.js` — `sourceRoot: "src"` in `nest-cli.json` means output is nested).

## Gotchas

**Port 5432 conflict — always use 5434.** A local Postgres listens on 5432. Docker forwards `host:5434 → container:5432`. If you use 5432 in `DATABASE_URL` you'll hit the local Postgres with wrong credentials and get `28P01 invalid_password`. The `docker-compose.yml` uses `POSTGRES_HOST_AUTH_METHOD: trust` to allow connections without password from non-loopback Docker bridge IPs.

**Entry point is `dist/src/main.js`, not `dist/main.js`.** `nest-cli.json` sets `sourceRoot: "src"`, so the compiled output is one level deeper. `npm run start:prod` uses the correct path; manual `node dist/main.js` will fail.

**`npm run build` writes to stderr** (npm verbose logs). Scripts that set `$ErrorActionPreference = "Stop"` will treat this as a failure. Use `cmd /c "npm run build 2>&1"` to capture both streams and check `$LASTEXITCODE`.

**`pwsh` (PowerShell 7) is not installed** — only Windows PowerShell 5.1 (`powershell`). The smoke script uses 5.1-compatible syntax (no `??` null-coalescing, no `pwsh`-only features).

**Prisma 7 skips `.env` on CLI commands.** `prisma migrate dev` / `prisma generate` ignore `.env` when `prisma.config.ts` exists. The config file calls `process.loadEnvFile('.env')` to bridge this. If you see "Connection url is empty", the `.env` file is missing or `DATABASE_URL` is unset.

**`$queryRaw` for pgvector** — `VectorStore` uses `prisma.$queryRaw` for vector similarity queries. The `@prisma/adapter-pg` driver handles serialization; raw SQL results come back as plain objects (no Prisma typed rows), which is what the code expects.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `P1000: Authentication failed` | Wrong port — check `DATABASE_URL` uses `5434`, not `5432`. Also confirm `docker compose ps` shows postgres healthy. |
| `EADDRINUSE :::3000` | Another process (or a previous run) holds port 3000. The smoke script clears it automatically. Manual: `Get-NetTCPConnection -LocalPort 3000 -State Listen \| Select OwningProcess \| Stop-Process -Force`. |
| `Cannot find module 'dist/main.js'` | Wrong entry point. Use `dist/src/main.js`. |
| `Connection url is empty` | `.env` missing or Prisma 7 not loading it. Check `prisma.config.ts` exists at repo root. |
| `PrismaClientInitializationError: needs non-empty PrismaClientOptions` | Prisma 7 removed `datasourceUrl` from constructor. `PrismaService` must pass `adapter: new PrismaPg(pool)`. |
