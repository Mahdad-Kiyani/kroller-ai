# ---- build stage ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ---- runtime stage ----
FROM node:22-bookworm-slim AS runtime

# App
ARG PORT=3000
ARG SERVICE_API_KEY

# Database
ARG DATABASE_URL

# Redis
ARG REDIS_HOST=localhost
ARG REDIS_PORT=6379
ARG REDIS_USERNAME
ARG REDIS_PASSWORD

# Object storage
ARG STORAGE_ENDPOINT
ARG STORAGE_REGION=us-east-1
ARG STORAGE_BUCKET=wi-documents
ARG STORAGE_ACCESS_KEY
ARG STORAGE_SECRET_KEY
ARG STORAGE_FORCE_PATH_STYLE=true

# AI
ARG ANTHROPIC_API_KEY
ARG CLAUDE_MODEL=claude-sonnet-4-6
ARG CLAUDE_BASE_URL=https://api.anthropic.com

# Embeddings
ARG EMBEDDINGS_API_KEY
ARG EMBEDDINGS_MODEL=text-embedding-3-small
ARG EMBEDDINGS_BASE_URL=https://api.openai.com
ARG EMBEDDING_DIM=1536

ENV NODE_ENV=production
ENV PORT=$PORT
ENV SERVICE_API_KEY=$SERVICE_API_KEY
ENV DATABASE_URL=$DATABASE_URL
ENV REDIS_HOST=$REDIS_HOST
ENV REDIS_PORT=$REDIS_PORT
ENV REDIS_USERNAME=$REDIS_USERNAME
ENV REDIS_PASSWORD=$REDIS_PASSWORD
ENV STORAGE_ENDPOINT=$STORAGE_ENDPOINT
ENV STORAGE_REGION=$STORAGE_REGION
ENV STORAGE_BUCKET=$STORAGE_BUCKET
ENV STORAGE_ACCESS_KEY=$STORAGE_ACCESS_KEY
ENV STORAGE_SECRET_KEY=$STORAGE_SECRET_KEY
ENV STORAGE_FORCE_PATH_STYLE=$STORAGE_FORCE_PATH_STYLE
ENV ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
ENV CLAUDE_MODEL=$CLAUDE_MODEL
ENV CLAUDE_BASE_URL=$CLAUDE_BASE_URL
ENV EMBEDDINGS_API_KEY=$EMBEDDINGS_API_KEY
ENV EMBEDDINGS_MODEL=$EMBEDDINGS_MODEL
ENV EMBEDDINGS_BASE_URL=$EMBEDDINGS_BASE_URL
ENV EMBEDDING_DIM=$EMBEDDING_DIM

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl curl \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh
EXPOSE 3000
HEALTHCHECK --interval=20s --timeout=5s --start-period=30s --retries=5 \
  CMD curl -fsS http://localhost:3000/api/health || exit 1
ENTRYPOINT ["./entrypoint.sh"]
