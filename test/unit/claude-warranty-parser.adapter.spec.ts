// ClaudeClient (pulled in transitively by the adapter) imports socks-proxy-agent, which ships
// as ESM and ts-jest can't parse. The parser under test never exercises the proxy path, so stub it.
jest.mock('socks-proxy-agent', () => ({ SocksProxyAgent: class {} }));

import { ConfigService } from '@nestjs/config';
import { ClaudeWarrantyParser } from '@modules/warranties/infrastructure/claude-warranty-parser.adapter';
import { DocumentTextExtractor } from '@modules/warranties/infrastructure/document-text-extractor.service';
import { ClaudeClient } from '@shared/infrastructure/ai/claude.client';
import { AppConfig } from '@shared/infrastructure/config/configuration';
import { FakeStoragePort } from '../support/fakes';

type Ai = AppConfig['ai'];

/** Minimal ConfigService whose `get('ai')` returns the chunking knobs the parser reads. */
function configWith(ai: Partial<Ai>): ConfigService<AppConfig, true> {
  const value: Ai = {
    apiKey: '',
    model: 'm',
    baseUrl: 'b',
    timeoutMs: 0,
    parseChunkChars: 40,
    parseMaxConcurrency: 3,
    parseMaxTokens: 8192,
    ...ai,
  };
  return { get: () => value } as unknown as ConfigService<AppConfig, true>;
}

/** Build a parser wired to a fake Claude `complete` and an in-memory document. */
function makeParser(text: string, complete: jest.Mock, ai: Partial<Ai> = {}) {
  const storage = new FakeStoragePort();
  storage.store.set('doc', Buffer.from(text, 'utf-8'));
  const claude = { complete } as unknown as ClaudeClient;
  return new ClaudeWarrantyParser(claude, storage, new DocumentTextExtractor(), configWith(ai));
}

const row = (ref: string, cat = 'FUNDAMENTAL') =>
  `{"spaReference":"${ref}","title":"t","fullText":"f","category":"${cat}","confidence":0.9}`;

describe('ClaudeWarrantyParser.salvageObjects', () => {
  it('recovers complete objects from a response truncated mid-array', () => {
    // Mirrors the real symptom: token cap cuts the array off inside the last object.
    const truncated =
      '```json\n[\n  ' + row('1.1') + ',\n  {"spaReference":"1.2","title":"cut","fullText":"incomplete';
    const objs = ClaudeWarrantyParser.salvageObjects<{ spaReference: string }>(truncated);
    expect(objs).toHaveLength(1);
    expect(objs[0].spaReference).toBe('1.1');
  });

  it('is not fooled by braces or escaped quotes inside string values', () => {
    const tricky =
      '[' +
      '{"spaReference":"2.1","fullText":"a \\"quoted\\" clause with {braces} and , commas","category":"TAX"},' +
      '{"spaReference":"2.2","fullText":"also } fine","category":"BUSINESS"}' +
      ']';
    const objs = ClaudeWarrantyParser.salvageObjects<{ spaReference: string }>(tricky);
    expect(objs.map((o) => o.spaReference)).toEqual(['2.1', '2.2']);
  });

  it('preserves ``` fence sequences that appear inside a value', () => {
    // A ```json / ``` sequence in the verbatim SPA text must NOT be stripped.
    const wrapped =
      '```json\n[{"spaReference":"3.1","fullText":"clause referencing ```json blocks``` verbatim","category":"BUSINESS"}]\n```';
    const objs = ClaudeWarrantyParser.salvageObjects<{ spaReference: string; fullText: string }>(wrapped);
    expect(objs).toHaveLength(1);
    expect(objs[0].fullText).toBe('clause referencing ```json blocks``` verbatim');
  });
});

describe('ClaudeClient.parseJsonArray', () => {
  it('strips a wrapping ```json fence but keeps ``` inside a value', () => {
    const wrapped =
      '```json\n[{"spaReference":"4.1","fullText":"has ``` fence inside","category":"TAX"}]\n```';
    const rows = ClaudeClient.parseJsonArray<{ fullText: string }>(wrapped);
    expect(rows).toHaveLength(1);
    expect(rows[0].fullText).toBe('has ``` fence inside');
  });

  it('parses a bare array with no fence', () => {
    const rows = ClaudeClient.parseJsonArray<{ spaReference: string }>(`[${row('5.1')}]`);
    expect(rows[0].spaReference).toBe('5.1');
  });
});

describe('ClaudeWarrantyParser.parse', () => {
  it('sends one request for a small document (no chunking)', async () => {
    const complete = jest.fn().mockResolvedValue(`[${row('1.1')}]`);
    const parser = makeParser('short spa text', complete, { parseChunkChars: 1000 });

    const rows = await parser.parse({ storageKey: 'doc', mimeType: 'text/plain' });

    expect(complete).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(1);
  });

  it('splits a large document into parallel chunk requests and merges the results', async () => {
    const lineA = 'DUPE clause one padding xxxxxxx'; // ~31 chars, own chunk under 40
    const lineB = 'DUPE clause two padding yyyyyyy';
    const lineC = 'PLAIN clause three padding zzzz';
    const text = [lineA, lineB, lineC].join('\n');

    const complete = jest.fn(async (_sys: string, user: string) => {
      if (user.includes('DUPE')) return `[${row('1.1')}]`; // same ref from two chunks
      return `[${row('3.3', 'BUSINESS')}]`;
    });
    const parser = makeParser(text, complete, { parseChunkChars: 40 });

    const rows = await parser.parse({ storageKey: 'doc', mimeType: 'text/plain' });

    expect(complete).toHaveBeenCalledTimes(3); // one call per chunk
    // "1.1" appears in two chunks but is de-duplicated; "3.3" survives.
    expect(rows.map((r) => r.spaReference).sort()).toEqual(['1.1', '3.3']);
  });

  it('salvages a truncated chunk instead of dropping the whole document', async () => {
    const complete = jest.fn(async (_sys: string, user: string) => {
      if (user.includes('GOOD')) return `[${row('1.1')}]`;
      // truncated mid-object: one complete row, one cut off
      return `[${row('9.9', 'TAX')},{"spaReference":"9.10","title":"cut`;
    });
    const text = ['GOOD clause padding aaaaaaaaaa', 'TRUNC clause padding bbbbbbbbb'].join('\n');
    const parser = makeParser(text, complete, { parseChunkChars: 40 });

    const rows = await parser.parse({ storageKey: 'doc', mimeType: 'text/plain' });

    expect(complete).toHaveBeenCalledTimes(2);
    expect(rows.map((r) => r.spaReference).sort()).toEqual(['1.1', '9.9']);
  });

  it('normalises missing/loose fields into typed rows', async () => {
    const complete = jest.fn().mockResolvedValue('[{"spaReference":1.4,"confidence":"0.5","pageRef":"3"}]');
    const parser = makeParser('short', complete, { parseChunkChars: 1000 });

    const [r] = await parser.parse({ storageKey: 'doc', mimeType: 'text/plain' });

    expect(r.spaReference).toBe('1.4');
    expect(r.confidence).toBe(0.5);
    expect(r.pageRef).toBe(3);
    expect(r.title).toBe('');
  });
});
