import {
  detectScrapes,
  hasKnowledgeScrape,
  hasMaterialityScrape,
} from '@modules/warranties/domain/scrape-detector';

describe('scrape-detector', () => {
  describe('knowledge (K) qualifiers', () => {
    // The core regression: the old detector only matched the plural "Sellers' knowledge".
    it("catches the SINGULAR possessive \"Seller's knowledge\"", () => {
      expect(hasKnowledgeScrape("To the Seller's knowledge, no litigation is pending.")).toBe(true);
    });

    it("catches the plural possessive \"Sellers' knowledge\"", () => {
      expect(hasKnowledgeScrape("To the Sellers' knowledge, the accounts are accurate.")).toBe(true);
    });

    it('catches a curly-apostrophe possessive (’)', () => {
      expect(hasKnowledgeScrape('So far as the Seller’s knowledge extends, the assets are owned.')).toBe(true);
    });

    it('catches "knowledge of the Seller" construction', () => {
      expect(hasKnowledgeScrape('To the best of the knowledge of the Seller, there are no disputes.')).toBe(true);
    });

    it('catches "best of the Seller\'s knowledge"', () => {
      expect(hasKnowledgeScrape("To the best of the Seller's knowledge and belief, all filings are made.")).toBe(true);
    });

    it('catches "so far as the Seller is aware"', () => {
      expect(hasKnowledgeScrape('So far as the Seller is aware, there are no environmental breaches.')).toBe(true);
    });

    it('catches "so far as the Sellers are aware" (plural)', () => {
      expect(hasKnowledgeScrape('So far as the Sellers are aware, the company complies with law.')).toBe(true);
    });

    it("catches other warrantors (Vendor's / Warrantor's / Company's)", () => {
      expect(hasKnowledgeScrape("To the Vendor's knowledge, no claims exist.")).toBe(true);
      expect(hasKnowledgeScrape("To the Warrantor's awareness, the IP is unencumbered.")).toBe(true);
      expect(hasKnowledgeScrape("To the Company's knowledge, tax has been paid.")).toBe(true);
    });

    it('is case-insensitive', () => {
      expect(hasKnowledgeScrape("TO THE SELLER'S KNOWLEDGE, NO EVENT HAS OCCURRED.")).toBe(true);
    });
  });

  describe('materiality (M) qualifiers', () => {
    it('catches "in all material respects"', () => {
      expect(hasMaterialityScrape('The accounts are true in all material respects.')).toBe(true);
    });
    it('catches "material adverse effect"', () => {
      expect(hasMaterialityScrape('No fact would have a material adverse effect on the business.')).toBe(true);
    });
  });

  describe('negatives — must NOT fire', () => {
    it('does not fire on incidental "knowledge" (knowledge transfer / base)', () => {
      expect(hasKnowledgeScrape('The Company operates a knowledge base and runs knowledge transfer sessions.')).toBe(
        false,
      );
    });
    it('does not fire on a clean unqualified warranty', () => {
      expect(hasKnowledgeScrape('The Company owns all of the assets listed in Schedule 3.')).toBe(false);
      expect(hasMaterialityScrape('The Company owns all of the assets listed in Schedule 3.')).toBe(false);
    });
    it('handles empty / whitespace text', () => {
      expect(detectScrapes('')).toEqual([]);
      expect(detectScrapes('   ')).toEqual([]);
    });
  });

  describe('detectScrapes shape + de-dup', () => {
    it('returns typed markers with the verbatim match', () => {
      const markers = detectScrapes("To the Seller's knowledge, and in all material respects, true.");
      expect(markers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: 'K' }),
          expect.objectContaining({ kind: 'M' }),
        ]),
      );
    });
    it('de-duplicates repeated phrasings of the same kind+match', () => {
      const text = "Seller's knowledge here. Seller's knowledge there.";
      const kMarkers = detectScrapes(text).filter((m) => m.kind === 'K');
      expect(kMarkers).toHaveLength(1);
    });
  });
});
