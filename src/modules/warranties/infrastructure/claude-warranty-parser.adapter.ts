import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClaudeClient } from '@shared/infrastructure/ai/claude.client';
import { AppConfig } from '@shared/infrastructure/config/configuration';
import { StoragePort, STORAGE_PORT } from '@shared/infrastructure/storage/storage.port';
import { WarrantyParserPort, ParsedWarrantyRow } from '../application/ports/warranty-parser.port';
import { DocumentTextExtractor } from './document-text-extractor.service';

/**
 * The single AI seam for parsing. Pulls the document from MinIO, extracts its text, and
 * asks Claude for STRUCTURED JSON (the 4-bucket taxonomy is re-validated in the domain).
 *
 * Large SPAs run to many pages. Sending the whole document in one request is slow and, worse,
 * makes Claude echo every warranty's fullText back in a single JSON array that can exceed the
 * output-token cap and truncate mid-object (unparseable). So the text is split into
 * size-based chunks that are classified IN PARALLEL, each with its own token budget, and the
 * per-chunk results are merged and de-duplicated. Replacing this one class swaps the AI provider.
 */
@Injectable()
export class ClaudeWarrantyParser implements WarrantyParserPort {
  private readonly logger = new Logger(ClaudeWarrantyParser.name);
  private readonly chunkChars: number;
  private readonly maxConcurrency: number;
  private readonly maxTokens: number;

  private static readonly SYSTEM =
    'You extract warranties from an SPA (or a fragment of one). Return ONLY a JSON array. Each item: ' +
    '{spaReference, title, fullText, category, confidence, pageRef}. ' +
    'category is exactly one of FUNDAMENTAL, BUSINESS, TAX, TAX_INDEMNITY. ' +
    'Preserve original SPA numbering verbatim in spaReference. confidence is 0..1. ' +
    'Only extract warranties that appear in the text provided; if it contains none, return []. ' +
    'No prose, no markdown.';

  constructor(
    private readonly claude: ClaudeClient,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly extractor: DocumentTextExtractor,
    config: ConfigService<AppConfig, true>,
  ) {
    const ai = config.get('ai', { infer: true });
    this.chunkChars = ai.parseChunkChars;
    this.maxConcurrency = Math.max(1, ai.parseMaxConcurrency);
    this.maxTokens = ai.parseMaxTokens;
  }

  async parse(input: { storageKey: string; mimeType: string }): Promise<ParsedWarrantyRow[]> {
    this.logger.log(`Fetching document from MinIO: ${input.storageKey}`);
    const buffer = await this.storage.getObject(input.storageKey);
    this.logger.debug(`Document fetched: ${buffer.length}B`);

    this.logger.log(`Extracting text (mimeType=${input.mimeType})`);
    const text = await this.extractor.extract(buffer, input.mimeType);

    const chunks = this.chunkText(text);
    this.logger.log(
      `Chunking SPA: ${text.length} chars → ${chunks.length} chunk(s) ` +
        `(targetChars=${this.chunkChars}, maxConcurrency=${this.maxConcurrency}, maxTokens/chunk=${this.maxTokens})`,
    );
    chunks.forEach((c, i) => this.logger.log(`  chunk[${i + 1}/${chunks.length}] ${c.length} chars`));

    const started = Date.now();
    const perChunkRows = await this.mapWithConcurrency(chunks, this.maxConcurrency, (chunk, i) =>
      this.parseChunk(chunk, i, chunks.length),
    );

    const rawRows = perChunkRows.flat().map((r) => ({
      spaReference: String(r.spaReference ?? ''),
      title: String(r.title ?? ''),
      fullText: String(r.fullText ?? ''),
      category: String(r.category ?? ''),
      confidence: Number(r.confidence ?? 0),
      pageRef: r.pageRef !== undefined ? Number(r.pageRef) : undefined,
    }));

    const rows = this.dedupe(rawRows);
    this.logger.log(
      `All ${chunks.length} chunk(s) done in ${Date.now() - started}ms → ` +
        `${rows.length} warranties (${rawRows.length} raw rows, ${rawRows.length - rows.length} duplicates dropped)`,
    );
    return rows;
  }

  /** Classify one chunk. Never throws: a chunk that fails to parse contributes zero rows. */
  private async parseChunk(chunk: string, index: number, total: number): Promise<ParsedWarrantyRow[]> {
    const label = `chunk[${index + 1}/${total}]`;
    const started = Date.now();
    this.logger.log(`→ ${label} sending to Claude (${chunk.length} chars)`);
    let raw: string;
    try {
      raw = await this.claude.complete(ClaudeWarrantyParser.SYSTEM, chunk, this.maxTokens);
    } catch (err) {
      this.logger.error(`✗ ${label} Claude call failed (${(err as Error).message}) — skipping this chunk`);
      return [];
    }

    let rows: ParsedWarrantyRow[];
    try {
      rows = ClaudeClient.parseJsonArray<ParsedWarrantyRow>(raw);
    } catch {
      // Most often a truncated response (output hit the token cap mid-array). Salvage every
      // complete object rather than dropping the whole chunk.
      rows = ClaudeWarrantyParser.salvageObjects<ParsedWarrantyRow>(raw);
      this.logger.warn(`⚠ ${label} response was not valid JSON — salvaged ${rows.length} complete object(s) from ${raw.length} chars`);
    }

    this.logger.log(`← ${label} ${rows.length} row(s) in ${Date.now() - started}ms`);
    return rows;
  }

  /**
   * Split text into chunks no larger than `chunkChars`, breaking only on line boundaries so a
   * warranty clause is never cut in half. Returns a single chunk when the SPA is small enough
   * (or chunking is disabled), preserving the original one-shot behaviour.
   */
  private chunkText(text: string): string[] {
    if (this.chunkChars <= 0 || text.length <= this.chunkChars) return [text];

    const chunks: string[] = [];
    let current = '';
    for (const line of text.split('\n')) {
      const candidate = current.length === 0 ? line : `${current}\n${line}`;
      if (candidate.length > this.chunkChars && current.length > 0) {
        chunks.push(current);
        current = line;
      } else {
        current = candidate;
      }
    }
    if (current.trim().length > 0) chunks.push(current);
    return chunks.length > 0 ? chunks : [text];
  }

  /** Run `fn` over `items` with at most `limit` in flight; results keep input order. */
  private async mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    fn: (item: T, index: number) => Promise<R>,
  ): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let next = 0;
    const worker = async (): Promise<void> => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        results[i] = await fn(items[i], i);
      }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
  }

  /** Drop rows that repeat a spaReference — the same clause can surface in two adjacent chunks. */
  private dedupe(rows: ParsedWarrantyRow[]): ParsedWarrantyRow[] {
    const seen = new Set<string>();
    return rows.filter((r) => {
      const key = r.spaReference.trim() || `${r.title}::${r.fullText.slice(0, 60)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Recover every complete top-level `{...}` object from a possibly-truncated JSON array,
   * tracking string/escape state so a `}` inside a fullText value doesn't fool the scanner.
   * A trailing object cut off by the token cap is simply never closed, so it's dropped cleanly.
   * Scans the raw text directly — markdown fences and any other non-object text sit outside the
   * objects and are skipped, while fences that appear INSIDE a value are preserved verbatim.
   */
  static salvageObjects<T>(text: string): T[] {
    const out: T[] = [];
    let depth = 0;
    let start = -1;
    let inStr = false;
    let esc = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0 && start >= 0) {
          try {
            out.push(JSON.parse(text.slice(start, i + 1)) as T);
          } catch {
            /* skip a malformed object */
          }
          start = -1;
        }
      }
    }
    return out;
  }
}
