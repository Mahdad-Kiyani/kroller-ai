import { Injectable, Logger } from '@nestjs/common';
import { ClaudeClient } from '@shared/infrastructure/ai/claude.client';
import { ExclusionMapperPort, MappableWarranty, MappedImpact } from '../application/ports/exclusion-mapper.port';

/**
 * AI seam for exclusion-impact mapping. Gives Claude the exclusion text plus a compact
 * list of warranties and asks which warranties it affects, with a rationale + confidence.
 * Swappable like every other AI adapter.
 */
@Injectable()
export class ClaudeExclusionMapper implements ExclusionMapperPort {
  private readonly logger = new Logger(ClaudeExclusionMapper.name);

  constructor(private readonly claude: ClaudeClient) {}

  async map(input: { exclusionText: string; warranties: MappableWarranty[] }): Promise<MappedImpact[]> {
    if (input.warranties.length === 0) {
      this.logger.warn('Exclusion map called with 0 warranties — returning empty');
      return [];
    }

    this.logger.log(`Mapping exclusion against ${input.warranties.length} warranties via Claude`);

    const system =
      'You map an insurance exclusion to the warranties it affects. Return ONLY a JSON array of ' +
      '{warrantyId, rationale, confidence}. Include ONLY warranties genuinely affected. ' +
      'confidence is 0..1. Use the exact warrantyId values provided. No prose, no markdown.';

    const user = JSON.stringify({
      exclusion: input.exclusionText,
      warranties: input.warranties.map((w) => ({ warrantyId: w.id, spaReference: w.spaReference, title: w.title, text: w.fullText })),
    });

    const raw = await this.claude.complete(system, user);
    const allowed = new Set(input.warranties.map((w) => w.id));
    const results = ClaudeClient.parseJsonArray<MappedImpact>(raw)
      .map((m) => ({ warrantyId: String(m.warrantyId), rationale: String(m.rationale ?? ''), confidence: Number(m.confidence ?? 0) }))
      .filter((m) => allowed.has(m.warrantyId)); // guard against hallucinated ids

    this.logger.log(`Exclusion mapped: ${results.length}/${input.warranties.length} warranties affected`);
    return results;
  }
}
