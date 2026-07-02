import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/configuration';
import { EmbeddingPort } from './embedding.port';

/**
 * Calls any OpenAI-compatible /v1/embeddings endpoint (OpenAI, Azure, Together, a local
 * server, or a Voyage-compatible proxy). Provider choice is config — the rest of the
 * service only knows the port.
 */
@Injectable()
export class HttpEmbeddingAdapter implements EmbeddingPort {
  private readonly logger = new Logger(HttpEmbeddingAdapter.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  readonly dimension: number;

  private readonly timeoutMs = 30_000;

  constructor(config: ConfigService<AppConfig, true>) {
    const e = config.get('embeddings', { infer: true });
    this.apiKey = e.apiKey;
    this.model = e.model;
    this.baseUrl = e.baseUrl;
    this.dimension = e.dim;
    this.logger.log(`Configured: model=${this.model} baseUrl=${this.baseUrl} dim=${this.dimension}`);
    if (!this.apiKey) this.logger.warn('EMBEDDINGS_API_KEY is not set — all embedding calls will fail');
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const start = Date.now();
    this.logger.log(`Embedding ${texts.length} text(s) via ${this.model}`);

    const res = await fetch(`${this.baseUrl}/v1/embeddings`, {
      method: 'POST',
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.model, input: texts }),
    });

    if (!res.ok) {
      this.logger.error(`Embeddings API error: status=${res.status} elapsed=${Date.now() - start}ms`);
      throw new Error(`Embeddings API failed with status ${res.status}`);
    }
    const data = (await res.json()) as { data: { embedding: number[] }[] };
    this.logger.log(
      `Embeddings received: ${data.data.length} vectors dim=${data.data[0]?.embedding.length ?? 0} elapsed=${Date.now() - start}ms`,
    );
    return data.data.map((d) => d.embedding);
  }
}
