import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { EmbeddingPort, EMBEDDING_PORT } from '@shared/infrastructure/embeddings/embedding.port';
import { VectorStore } from '@shared/infrastructure/embeddings/vector-store.service';
import { WarrantyRepository, WARRANTY_REPOSITORY } from '@modules/warranties/domain/warranty.repository';
import { Warranty } from '@modules/warranties/domain/warranty.aggregate';
import { GenerateSuggestionsCommand } from './generate-suggestions.command';
import { SuggestionPolicy } from '../../domain/suggestion-policy';

/**
 * The learning loop in action: for each warranty in the deal, retrieve the nearest PAST
 * warranties that already carry a human-decided position (same category), and attach a
 * similarity-weighted suggested position. More decided history ⇒ better suggestions, with
 * zero retraining.
 */
@CommandHandler(GenerateSuggestionsCommand)
export class GenerateSuggestionsHandler implements ICommandHandler<GenerateSuggestionsCommand> {
  private readonly logger = new Logger(GenerateSuggestionsHandler.name);

  constructor(
    @Inject(WARRANTY_REPOSITORY) private readonly warranties: WarrantyRepository,
    @Inject(EMBEDDING_PORT) private readonly embedder: EmbeddingPort,
    private readonly vectors: VectorStore,
  ) {}

  async execute(cmd: GenerateSuggestionsCommand): Promise<{ suggested: number; skipped: number }> {
    const warranties = await this.warranties.listByDeal(cmd.dealId);
    if (warranties.length === 0) return { suggested: 0, skipped: 0 };

    const embeddings = await this.resolveEmbeddings(warranties);

    const results = await Promise.all(
      warranties.map(async (w) => {
        const embedding = embeddings.get(w.id.toString());
        if (!embedding) return { w, suggestion: null };
        const neighbours = await this.vectors.findDecidedNeighbours({
          embedding,
          excludeDealId: cmd.dealId,
          category: w.category,
          limit: 10,
        });
        return { w, suggestion: SuggestionPolicy.fromNeighbours(neighbours) };
      }),
    );

    let suggested = 0;
    let skipped = 0;
    for (const { w, suggestion } of results) {
      if (!suggestion) {
        skipped += 1;
        continue;
      }
      w.applySuggestedPosition(suggestion.position, suggestion.comment, suggestion.score);
      await this.warranties.save(w);
      suggested += 1;
    }

    this.logger.log(`Deal ${cmd.dealId}: suggested ${suggested}, skipped ${skipped}`);
    return { suggested, skipped };
  }

  /**
   * Reuses embeddings already persisted by the warranty-embed queue (categorisation /
   * decision flows) instead of re-calling the embeddings API on every generate request.
   * Only warranties genuinely missing a stored vector are embedded here, in one batched
   * API call.
   */
  private async resolveEmbeddings(warranties: Warranty[]): Promise<Map<string, number[]>> {
    const ids = warranties.map((w) => w.id.toString());
    const cached = await this.vectors.getEmbeddings(ids);

    const missing = warranties.filter((w) => !cached.has(w.id.toString()));
    if (missing.length === 0) return cached;

    const fresh = await this.embedder.embed(missing.map((w) => `${w.title}\n${w.fullText}`));
    await Promise.all(
      missing.map((w, i) => {
        const embedding = fresh[i];
        cached.set(w.id.toString(), embedding);
        return this.vectors.saveEmbedding(w.id.toString(), embedding).catch((err: unknown) => {
          this.logger.error(
            `Failed to persist embedding for warranty ${w.id.toString()}: ${err instanceof Error ? err.message : String(err)}`,
          );
        });
      }),
    );
    return cached;
  }
}
