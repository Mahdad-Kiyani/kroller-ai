/**
 * Knowledge "scrape" detector — pure, deterministic, dependency-free.
 *
 * A "knowledge scrape" is a knowledge qualifier a seller inserts into a warranty so the
 * statement is only given "to the seller's knowledge" (a.k.a. an awareness/knowledge
 * carve-out). These materially narrow coverage, so the WSS one-eye-view must flag them.
 *
 * Historically the detector only matched the plural "Sellers' knowledge" and missed the
 * SINGULAR "Seller's knowledge" (and several other real-world phrasings). This detector
 * catches both possessive forms, the "to the knowledge of the Seller(s)" construction, and
 * bare "aware/awareness" qualifiers, while NOT firing on incidental uses of the word
 * "knowledge" (e.g. "knowledge transfer", "knowledge base").
 *
 * Marker kinds:
 *   - 'K' (knowledge)  — an explicit knowledge/awareness qualifier tied to the seller.
 *   - 'M' (materiality) — a materiality qualifier ("in all material respects", "material
 *                         adverse effect") that similarly waters down the statement.
 */
export type ScrapeKind = 'K' | 'M';

export interface ScrapeMarker {
  kind: ScrapeKind;
  /** The verbatim substring from the warranty text that triggered the match. */
  match: string;
}

// Possessive forms: "Seller's", "Sellers'", "Seller´s" (unicode acute), "Vendor's", "Warrantor's".
// The party token is a small closed set of SPA counterparties who give warranties.
const PARTY = "(?:seller|sellers|vendor|vendors|warrantor|warrantors|company|management)";
// Apostrophe variants: straight ', curly ’, backtick-ish ´, or none (possessive sometimes dropped).
const APOS = "(?:['’´`]s|s['’´`]|['’´`])?";

const KNOWLEDGE_PATTERNS: RegExp[] = [
  // "Seller's knowledge" / "Sellers' knowledge" / "Seller knowledge" — possessive, either number.
  new RegExp(`\\b${PARTY}${APOS}\\s+(?:actual\\s+|constructive\\s+)?knowledge\\b`, 'i'),
  // "Seller's awareness" / "Seller's belief".
  new RegExp(`\\b${PARTY}${APOS}\\s+(?:awareness|belief)\\b`, 'i'),
  // "to the (best of the )knowledge of the Seller(s)".
  new RegExp(`\\bknowledge\\s+of\\s+the\\s+${PARTY}\\b`, 'i'),
  // "to the best of the Seller's knowledge" (best-of variant, possessive).
  new RegExp(`\\bbest\\s+of\\s+the\\s+${PARTY}${APOS}\\s+knowledge\\b`, 'i'),
  // "so far as the Seller is aware" / "so far as the Sellers are aware".
  new RegExp(`\\bso\\s+far\\s+as\\s+the\\s+${PARTY}\\s+(?:is|are)\\s+aware\\b`, 'i'),
  // "to the Seller's actual awareness/knowledge" already covered; bare "is/are aware" tied to party.
  new RegExp(`\\b${PARTY}\\s+(?:is|are|being)\\s+(?:not\\s+)?aware\\b`, 'i'),
];

const MATERIALITY_PATTERNS: RegExp[] = [
  /\bin\s+all\s+material\s+respects\b/i,
  /\bmaterial\s+adverse\s+(?:effect|change)\b/i,
  /\bin\s+any\s+material\s+respect\b/i,
];

/**
 * Returns every knowledge/materiality marker found in the warranty text.
 * De-duplicates by (kind, lowercased match) so repeated phrasings collapse to one marker each.
 */
export function detectScrapes(text: string): ScrapeMarker[] {
  if (!text) return [];
  const seen = new Set<string>();
  const markers: ScrapeMarker[] = [];

  const scan = (patterns: RegExp[], kind: ScrapeKind): void => {
    for (const re of patterns) {
      const m = re.exec(text);
      if (!m) continue;
      const match = m[0].replace(/\s+/g, ' ').trim();
      const key = `${kind}:${match.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      markers.push({ kind, match });
    }
  };

  scan(KNOWLEDGE_PATTERNS, 'K');
  scan(MATERIALITY_PATTERNS, 'M');
  return markers;
}

/** Convenience: does this warranty carry a knowledge ('K') qualifier? */
export function hasKnowledgeScrape(text: string): boolean {
  return detectScrapes(text).some((m) => m.kind === 'K');
}

/** Convenience: does this warranty carry a materiality ('M') qualifier? */
export function hasMaterialityScrape(text: string): boolean {
  return detectScrapes(text).some((m) => m.kind === 'M');
}
