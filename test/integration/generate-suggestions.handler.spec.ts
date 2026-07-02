import { GenerateSuggestionsHandler } from '@modules/suggestions/application/commands/generate-suggestions.handler';
import { GenerateSuggestionsCommand } from '@modules/suggestions/application/commands/generate-suggestions.command';
import { Warranty } from '@modules/warranties/domain/warranty.aggregate';
import { Category } from '@modules/warranties/domain/value-objects/warranty-category.vo';
import { ConfidenceScore } from '@modules/warranties/domain/value-objects/confidence-score.vo';
import { WarrantyCategory, CoveragePosition } from '@prisma/client';
import { InMemoryWarrantyRepository } from '../support/in-memory-warranty.repository';
import { FakeEmbeddingPort, FakeVectorStore } from '../support/fakes';
import { VectorStore, SimilarWarranty } from '@shared/infrastructure/embeddings/vector-store.service';

function seedWarranty(repo: InMemoryWarrantyRepository, dealId: string) {
  const w = Warranty.fromParsedRow({
    dealId, spaReference: '16.2', title: 'Tax returns', fullText: 'Filed.',
    aiCategory: Category.of(WarrantyCategory.BUSINESS),
    aiConfidence: ConfidenceScore.create(0.9).getValue(),
  }).getValue();
  return repo.save(w).then(() => w);
}

describe('GenerateSuggestionsHandler (integration / learning loop)', () => {
  it('attaches a suggested position from decided precedent', async () => {
    const repo = new InMemoryWarrantyRepository();
    const w = await seedWarranty(repo, 'deal-new');
    const neighbours: SimilarWarranty[] = [
      { id: 'p1', dealId: 'deal-old', spaReference: '1', decidedPosition: 'COVERED', decidedComment: 'ok', category: 'BUSINESS', distance: 0.05 },
      { id: 'p2', dealId: 'deal-old', spaReference: '2', decidedPosition: 'COVERED', decidedComment: 'ok', category: 'BUSINESS', distance: 0.2 },
      { id: 'p3', dealId: 'deal-old', spaReference: '3', decidedPosition: 'EXCLUDED', decidedComment: 'no', category: 'BUSINESS', distance: 0.95 },
    ];
    const vectors = new FakeVectorStore(neighbours) as unknown as VectorStore;
    const handler = new GenerateSuggestionsHandler(repo, new FakeEmbeddingPort(), vectors);

    const result = await handler.execute(new GenerateSuggestionsCommand('deal-new', 'service'));
    expect(result.suggested).toBe(1);
    expect((await repo.findById(w.id.toString()))!.aiPosition).toBe(CoveragePosition.COVERED);
  });

  it('skips warranties with no precedent', async () => {
    const repo = new InMemoryWarrantyRepository();
    const w = await seedWarranty(repo, 'deal-new');
    const vectors = new FakeVectorStore([]) as unknown as VectorStore;
    const handler = new GenerateSuggestionsHandler(repo, new FakeEmbeddingPort(), vectors);

    const result = await handler.execute(new GenerateSuggestionsCommand('deal-new', 'service'));
    expect(result.suggested).toBe(0);
    expect(result.skipped).toBe(1);
    expect((await repo.findById(w.id.toString()))!.aiPosition).toBeNull();
  });
});
