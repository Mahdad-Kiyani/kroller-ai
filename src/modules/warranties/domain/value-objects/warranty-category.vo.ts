import { WarrantyCategory } from '@prisma/client';
import { Result } from '@shared/domain/result';

/** The four-bucket taxonomy — deliberately flat (no sub-categories). */
export class Category {
  private constructor(public readonly value: WarrantyCategory) {}
  static fromString(raw: string): Result<Category> {
    const n = raw.trim().toUpperCase().replace(/[\s-]+/g, '_');
    if (!(n in WarrantyCategory)) {
      return Result.fail(`Unknown category "${raw}". Allowed: ${Object.keys(WarrantyCategory).join(', ')}.`);
    }
    return Result.ok(new Category(WarrantyCategory[n as keyof typeof WarrantyCategory]));
  }
  static of(v: WarrantyCategory): Category { return new Category(v); }
  equals(o: Category): boolean { return this.value === o.value; }
}
