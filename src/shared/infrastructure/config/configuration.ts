export interface AppConfig {
  port: number;
  serviceApiKey: string;
  redis: { host: string; port: number; username?: string; password?: string };
  storage: {
    endpoint: string;
    region: string;
    bucket: string;
    accessKey: string;
    secretKey: string;
    forcePathStyle: boolean;
  };
  ai: {
    apiKey: string;
    model: string;
    baseUrl: string;
    timeoutMs: number;
    // SPA parsing is chunked: large documents are split and classified in parallel
    // so a single request can't time out or truncate its JSON output mid-array.
    parseChunkChars: number; // target size of each text chunk (0 disables chunking)
    parseMaxConcurrency: number; // how many chunk requests run at once
    parseMaxTokens: number; // max output tokens per chunk request
  };
  embeddings: { apiKey: string; model: string; baseUrl: string; dim: number };
}

export default (): AppConfig => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  serviceApiKey: process.env.SERVICE_API_KEY ?? 'dev-service-key',
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    ...(process.env.REDIS_USERNAME ? { username: process.env.REDIS_USERNAME } : {}),
    ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
  },
  storage: {
    endpoint: process.env.STORAGE_ENDPOINT ?? 'http://localhost:9000',
    region: process.env.STORAGE_REGION ?? 'us-east-1',
    bucket: process.env.STORAGE_BUCKET ?? 'wi-documents',
    accessKey: process.env.STORAGE_ACCESS_KEY ?? 'minioadmin',
    secretKey: process.env.STORAGE_SECRET_KEY ?? 'minioadmin',
    forcePathStyle: (process.env.STORAGE_FORCE_PATH_STYLE ?? 'true') === 'true',
  },
  ai: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    model: process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6',
    baseUrl: process.env.CLAUDE_BASE_URL ?? 'https://api.anthropic.com',
    timeoutMs: parseInt(process.env.CLAUDE_TIMEOUT_MS ?? '180000', 10),
    parseChunkChars: parseInt(process.env.CLAUDE_PARSE_CHUNK_CHARS ?? '12000', 10),
    parseMaxConcurrency: parseInt(process.env.CLAUDE_PARSE_MAX_CONCURRENCY ?? '5', 10),
    parseMaxTokens: parseInt(process.env.CLAUDE_PARSE_MAX_TOKENS ?? '8192', 10),
  },
  embeddings: {
    apiKey: process.env.EMBEDDINGS_API_KEY ?? '',
    model: process.env.EMBEDDINGS_MODEL ?? 'text-embedding-3-small',
    baseUrl: process.env.EMBEDDINGS_BASE_URL ?? 'https://api.openai.com',
    dim: parseInt(process.env.EMBEDDING_DIM ?? '1536', 10),
  },
});
