#!/usr/bin/env bash
set -e

# Migrations whose history row was recorded as "applied" but whose SQL never ran
# against some databases (the original files were lost and later reconstructed).
# `prisma migrate deploy` skips anything already in _prisma_migrations, so on those
# DBs the ALTER TABLEs never execute and columns like Warranty.aiKnowledgeScrape stay
# missing (Postgres 42703 / Prisma P2022). Every reconstructed migration is fully
# idempotent (ADD COLUMN / CREATE INDEX ... IF NOT EXISTS), so re-marking them as
# rolled-back forces migrate deploy to re-run them harmlessly. This is a no-op on a
# healthy DB where the columns already exist.
RECONCILE_MIGRATIONS=(
  "20260721072918_add_warranty_sortkey_ordinal_and_scrapes"
  "20260721072919_add_warranty_ordering_indexes"
  "20260721100000_add_warranty_scrape_text_columns"
)

echo "Reconciling potentially-drifted migrations..."
for m in "${RECONCILE_MIGRATIONS[@]}"; do
  # Ignore failures: the migration may be genuinely unapplied (nothing to roll back)
  # or not present yet on a fresh DB. Either way migrate deploy below is authoritative.
  npx prisma migrate resolve --rolled-back "$m" 2>/dev/null \
    && echo "  re-queued $m for re-apply" \
    || echo "  $m already pending or absent, skipping"
done

echo "Applying database migrations..."
npx prisma migrate deploy

echo "Starting AI service..."
exec node dist/main.js
