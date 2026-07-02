import { Category } from '@modules/warranties/domain/value-objects/warranty-category.vo';
import { WarrantyCategory } from '@prisma/client';

describe('Category (4-bucket taxonomy)', () => {
  it('parses canonical names', () => {
    expect(Category.fromString('FUNDAMENTAL').getValue().value).toBe(WarrantyCategory.FUNDAMENTAL);
  });
  it('normalises spacing/casing/hyphens', () => {
    expect(Category.fromString('tax indemnity').getValue().value).toBe(WarrantyCategory.TAX_INDEMNITY);
    expect(Category.fromString('Tax-Indemnity').getValue().value).toBe(WarrantyCategory.TAX_INDEMNITY);
  });
  it('rejects unknown categories (no sub-categories allowed)', () => {
    expect(Category.fromString('ENVIRONMENTAL').isFailure).toBe(true);
  });
});
