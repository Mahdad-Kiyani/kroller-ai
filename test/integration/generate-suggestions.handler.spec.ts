import { GenerateSuggestionsHandler } from '@modules/suggestions/application/commands/generate-suggestions.handler';
import { GenerateSuggestionsCommand } from '@modules/suggestions/application/commands/generate-suggestions.command';
import { Warranty } from '@modules/warranties/domain/warranty.aggregate';
import { Category } from '@modules/warranties/domain/value-objects/warranty-category.vo';
import { ConfidenceScore } from '@modules/warranties/domain/value-objects/confidence-score.vo';
import { WarrantyCategory, CoveragePosition, ScrapeStatus } from '@prisma/client';
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

/** A warranty whose position a human has already decided — must not be re-suggested. */
function seedDecidedWarranty(repo: InMemoryWarrantyRepository, dealId: string) {
  const w = Warranty.fromParsedRow({
    dealId, spaReference: '16.3', title: 'Tax returns', fullText: 'Filed.',
    aiCategory: Category.of(WarrantyCategory.BUSINESS),
    aiConfidence: ConfidenceScore.create(0.9).getValue(),
  }).getValue();
  w.decidePosition(CoveragePosition.EXCLUDED, 'human call', 'reviewer');
  return repo.save(w).then(() => w);
}

/**
 * A warranty with no effective category. fromParsedRow always mirrors aiCategory into
 * category, so reconstitute() is the only way to reach a null-category row — which is a
 * real state (e.g. a row whose category was cleared). findDecidedNeighbours filters by
 * category, so this can only ever retrieve nothing.
 */
function seedUncategorisedWarranty(repo: InMemoryWarrantyRepository, dealId: string) {
  const w = Warranty.reconstitute('w-uncat', {
    dealId, documentId: null, spaReference: '16.4', title: 'Tax returns', fullText: 'Filed.',
    aiCategory: null, aiConfidence: null, pageRef: null,
    category: null, overriddenBy: null,
    aiPosition: null, aiComment: null, aiPositionScore: null,
    decidedPosition: null, decidedComment: null, decidedBy: null,
    aiKnowledgeScrape: ScrapeStatus.NO, aiMaterialityScrape: ScrapeStatus.NO,
    aiKnowledgeScrapeText: null, aiMaterialityScrapeText: null,
    knowledgeScrape: ScrapeStatus.NO, materialityScrape: ScrapeStatus.NO,
    scrapesOverriddenBy: null,
  });
  return repo.save(w).then(() => w);
}

describe('GenerateSuggestionsHandler (integration / learning loop)', () => {
  it('attaches a suggested position from decided precedent', async () => {
    const repo = new InMemoryWarrantyRepository();
    const w = await seedWarranty(repo, 'deal-new');
    const neighbours: SimilarWarranty[] = [
      { id: 'p1', dealId: 'deal-old', dealName: 'Deal Old', spaReference: '1', title: 'Tax returns', decidedPosition: 'COVERED', decidedComment: 'ok', category: 'BUSINESS', distance: 0.05 },
      { id: 'p2', dealId: 'deal-old', dealName: 'Deal Old', spaReference: '2', title: 'Tax returns', decidedPosition: 'COVERED', decidedComment: 'ok', category: 'BUSINESS', distance: 0.2 },
      { id: 'p3', dealId: 'deal-old', dealName: 'Deal Old', spaReference: '3', title: 'Tax returns', decidedPosition: 'EXCLUDED', decidedComment: 'no', category: 'BUSINESS', distance: 0.95 },
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

  const precedent: SimilarWarranty[] = [
    { id: 'p1', dealId: 'deal-old', dealName: 'Deal Old', spaReference: '1', title: 'Tax returns', decidedPosition: 'COVERED', decidedComment: 'ok', category: 'BUSINESS', distance: 0.05 },
    { id: 'p2', dealId: 'deal-old', dealName: 'Deal Old', spaReference: '2', title: 'Tax returns', decidedPosition: 'COVERED', decidedComment: 'ok', category: 'BUSINESS', distance: 0.2 },
  ];

  it('does not re-suggest a warranty a human has already decided', async () => {
    const repo = new InMemoryWarrantyRepository();
    const w = await seedDecidedWarranty(repo, 'deal-new');
    // Strong precedent is available; the scoping filter must still exclude this warranty
    // because re-suggesting would overwrite the human's decided call.
    const vectors = new FakeVectorStore(precedent) as unknown as VectorStore;
    const handler = new GenerateSuggestionsHandler(repo, new FakeEmbeddingPort(), vectors);

    const result = await handler.execute(new GenerateSuggestionsCommand('deal-new', 'service'));
    expect(result.suggested).toBe(0);
    expect(result.skipped).toBe(1);
    // The human-decided position is untouched and no AI suggestion was written over it.
    const after = (await repo.findById(w.id.toString()))!;
    expect(after.decidedPosition).toBe(CoveragePosition.EXCLUDED);
    expect(after.aiPosition).toBeNull();
  });

  it('skips an un-categorised warranty without calling the vector store', async () => {
    const repo = new InMemoryWarrantyRepository();
    const w = await seedUncategorisedWarranty(repo, 'deal-new');
    // A null category can only ever retrieve nothing, so it is filtered out up front —
    // the neighbour lookup should never run for it.
    const vectors = new FakeVectorStore(precedent) as unknown as VectorStore;
    const findSpy = jest.spyOn(vectors, 'findDecidedNeighbours');
    const handler = new GenerateSuggestionsHandler(repo, new FakeEmbeddingPort(), vectors);

    const result = await handler.execute(new GenerateSuggestionsCommand('deal-new', 'service'));
    expect(result.suggested).toBe(0);
    expect(result.skipped).toBe(1);
    expect(findSpy).not.toHaveBeenCalled();
    expect((await repo.findById(w.id.toString()))!.aiPosition).toBeNull();
  });

  it('suggests only the eligible warranty when decided/un-categorised rows are mixed in', async () => {
    const repo = new InMemoryWarrantyRepository();
    const eligible = await seedWarranty(repo, 'deal-new');
    await seedDecidedWarranty(repo, 'deal-new');
    await seedUncategorisedWarranty(repo, 'deal-new');
    const vectors = new FakeVectorStore(precedent) as unknown as VectorStore;
    const handler = new GenerateSuggestionsHandler(repo, new FakeEmbeddingPort(), vectors);

    const result = await handler.execute(new GenerateSuggestionsCommand('deal-new', 'service'));
    expect(result.suggested).toBe(1);
    expect(result.skipped).toBe(2);
    expect((await repo.findById(eligible.id.toString()))!.aiPosition).toBe(CoveragePosition.COVERED);
  });
});
