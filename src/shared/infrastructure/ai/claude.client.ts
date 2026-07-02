import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { AppConfig } from '../config/configuration';

const ANTHROPIC_VERSION = '2023-06-01';

/**
 * Thin Anthropic Messages client built on axios. The single place HTTP-to-Claude happens;
 * context adapters depend on this, tests replace the adapter (not this) with a fake.
 */
@Injectable()
export class ClaudeClient {
  private readonly logger = new Logger(ClaudeClient.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly http: AxiosInstance;

  constructor(config: ConfigService<AppConfig, true>) {
    const ai = config.get('ai', { infer: true });
    this.apiKey = ai.apiKey;
    this.model = ai.model;
    this.baseUrl = ai.baseUrl;
    this.timeoutMs = ai.timeoutMs;

    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeoutMs,
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      ...this.resolveProxyConfig(),
    });

    this.http.interceptors.request.use((req) => {
      this.logger.debug(`Claude API request → ${req.method?.toUpperCase()} ${req.baseURL}${req.url}`);
      this.logger.debug(`Claude API request headers → ${JSON.stringify(this.redactHeaders(req.headers))}`);
      return req;
    });

    this.logger.log(`Configured: model=${this.model} baseUrl=${this.baseUrl} timeoutMs=${this.timeoutMs}`);
    if (!this.apiKey) this.logger.warn('ANTHROPIC_API_KEY is not set — all Claude calls will fail with 401');
  }

  /** Mirrors the SOCKS/HTTP proxy resolution in main.ts — axios does not share undici's global dispatcher. */
  private resolveProxyConfig(): Pick<AxiosRequestConfig, 'httpsAgent' | 'proxy'> {
    const proxyUrl =
      process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY ?? process.env.https_proxy ?? process.env.http_proxy;
    if (!proxyUrl) return {};

    const url = new URL(proxyUrl);
    if (url.protocol === 'socks5:' || url.protocol === 'socks:') {
      this.logger.log(`Claude client routing through SOCKS5 proxy: ${url.hostname}:${url.port}`);
      return { httpsAgent: new SocksProxyAgent(proxyUrl), proxy: false };
    }

    this.logger.log(`Claude client routing through HTTP proxy: ${url.hostname}:${url.port}`);
    return { proxy: { protocol: url.protocol.replace(':', ''), host: url.hostname, port: Number(url.port) } };
  }

  /** Redacts x-api-key so the secret never reaches the logs. */
  private redactHeaders(headers: unknown): Record<string, string> {
    const withToJson = headers as { toJSON?: () => Record<string, unknown> };
    const plain: Record<string, unknown> =
      typeof withToJson.toJSON === 'function' ? withToJson.toJSON() : (headers as Record<string, unknown>);

    const redacted: Record<string, string> = {};
    for (const [key, value] of Object.entries(plain)) {
      if (value === undefined || value === null) continue;
      redacted[key] = /^x-api-key$/i.test(key) ? this.maskSecret(String(value)) : String(value);
    }
    return redacted;
  }

  private maskSecret(value: string): string {
    if (!value) return '(empty)';
    return value.length <= 10 ? '***' : `${value.slice(0, 6)}...${value.slice(-4)}`;
  }

  /** Send a system + user prompt, return concatenated text content. */
  async complete(system: string, user: string, maxTokens = 8192): Promise<string> {
    const start = Date.now();
    this.logger.log(`Claude request → model=${this.model} maxTokens=${maxTokens} userLen=${user.length}chars`);

    type MessagesResponse = {
      content: { type: string; text?: string }[];
      usage?: { input_tokens: number; output_tokens: number };
    };

    let data: MessagesResponse;
    try {
      const res = await this.http.post<MessagesResponse>('/v1/messages', {
        model: this.model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
      });
      data = res.data;
    } catch (err) {
      const elapsed = Date.now() - start;
      if (axios.isAxiosError(err)) {
        const axiosErr = err as AxiosError<{ error?: { type?: string; message?: string } }>;
        if (axiosErr.code === 'ECONNABORTED') {
          this.logger.error(`Claude API timed out after ${elapsed}ms (limit=${this.timeoutMs}ms)`);
          throw new Error(
            `Claude API timed out after ${this.timeoutMs}ms — raise CLAUDE_TIMEOUT_MS or lower maxTokens for this call`,
          );
        }
        const status = axiosErr.response?.status;
        const apiMessage = axiosErr.response?.data?.error?.message;
        this.logger.error(`Claude API error: status=${status ?? 'network'} elapsed=${elapsed}ms message=${axiosErr.message}`);
        throw new Error(`Claude API failed with status ${status ?? 'network error'}${apiMessage ? `: ${apiMessage}` : ''}`);
      }
      throw err;
    }

    const elapsed = Date.now() - start;
    const text = data.content.filter((c) => c.type === 'text').map((c) => c.text ?? '').join('');

    if (data.usage) {
      this.logger.log(
        `Claude response ← elapsed=${elapsed}ms inputTokens=${data.usage.input_tokens} outputTokens=${data.usage.output_tokens} responseLen=${text.length}chars`,
      );
    } else {
      this.logger.log(`Claude response ← elapsed=${elapsed}ms responseLen=${text.length}chars`);
    }

    return text;
  }

  /**
   * Parse a JSON array from a model response, tolerating a wrapping ```json ... ``` fence.
   * The fence is stripped only at the string boundaries (anchored) — never globally — so a
   * literal ``` sequence inside a string value (e.g. verbatim SPA text) is preserved.
   */
  static parseJsonArray<T>(text: string): T[] {
    const cleaned = text
      .trim()
      .replace(/^```[a-zA-Z]*\s*/, '')
      .replace(/\s*```$/, '')
      .trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) throw new Error('Expected a JSON array from the model.');
    return parsed as T[];
  }
}
