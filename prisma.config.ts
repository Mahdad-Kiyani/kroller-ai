import { defineConfig } from 'prisma/config';

// Prisma 7 skips .env auto-load when prisma.config.ts is present; load it here
// so `prisma migrate` / `prisma generate` pick up DATABASE_URL in dev.
try {
  process.loadEnvFile('.env');
} catch {
  // CI / Docker: env vars already in shell, no .env needed
}

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
