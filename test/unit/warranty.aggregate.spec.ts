import { Warranty } from '@modules/warranties/domain/warranty.aggregate';
import { Category } from '@modules/warranties/domain/value-objects/warranty-category.vo';
import { ConfidenceScore } from '@modules/warranties/domain/value-objects/confidence-score.vo';
import { WarrantyCategory, CoveragePosition } from '@prisma/client';

function makeWarranty(confidence = 0.9) {
  return Warranty.fromParsedRow({
    dealId: 'deal-1',
    spaReference: '16.2',
    title: 'Tax returns filed',
    fullText: 'The Company has filed all tax returns.',
    aiCategory: Category.of(WarrantyCategory.BUSINESS),
    aiConfidence: ConfidenceScore.create(confidence).getValue(),
  }).getValue();
}

describe('Warranty aggregate', () => {
  it('starts with effective category equal to the AI suggestion', () => {
    const w = makeWarranty();
    expect(w.aiCategory).toBe(WarrantyCategory.BUSINESS);
    expect(w.category).toBe(WarrantyCategory.BUSINESS);
    expect(w.overriddenBy).toBeNull();
  });

  it('keeps the AI category immutable when a human overrides', () => {
    const w = makeWarranty();
    const res = w.overrideCategory(WarrantyCategory.TAX, 'user-7');
    expect(res.isSuccess).toBe(true);
    expect(w.aiCategory).toBe(WarrantyCategory.BUSINESS); // unchanged
    expect(w.category).toBe(WarrantyCategory.TAX); // effective changed
    expect(w.overriddenBy).toBe('user-7');
  });

  it('rejects a no-op override to the same value', () => {
    const w = makeWarranty();
    expect(w.overrideCategory(WarrantyCategory.BUSINESS, 'user-7').isFailure).toBe(true);
  });

  it('records the human decision separately from the AI suggestion', () => {
    const w = makeWarranty();
    w.applySuggestedPosition(CoveragePosition.PARTIAL, 'precedent says partial', 0.8);
    w.decidePosition(CoveragePosition.COVERED, 'Covered after negotiation', 'user-7');
    expect(w.aiPosition).toBe(CoveragePosition.PARTIAL); // AI suggestion preserved
    expect(w.decidedPosition).toBe(CoveragePosition.COVERED); // human decision distinct
    expect(w.decidedBy).toBe('user-7');
  });

  it('flags low-confidence rows for manual review', () => {
    expect(makeWarranty(0.55).needsReview()).toBe(true);
    expect(makeWarranty(0.9).needsReview()).toBe(false);
  });

  it('emits a WarrantyCategorised domain event on creation', () => {
    const w = makeWarranty();
    expect(w.getUncommittedEvents()).toHaveLength(1);
  });
});
