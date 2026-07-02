import { OverrideCategoryHandler } from '@modules/warranties/application/commands/override-category.handler';
import { OverrideCategoryCommand } from '@modules/warranties/application/commands/override-category.command';
import { Warranty } from '@modules/warranties/domain/warranty.aggregate';
import { Category } from '@modules/warranties/domain/value-objects/warranty-category.vo';
import { ConfidenceScore } from '@modules/warranties/domain/value-objects/confidence-score.vo';
import { WarrantyCategory } from '@prisma/client';
import { InMemoryWarrantyRepository } from '../support/in-memory-warranty.repository';
import { FakeAuditLogger, fakeEventPublisher } from '../support/fakes';
import { AuditLogger } from '@shared/infrastructure/audit/audit-logger.service';

describe('OverrideCategoryHandler (integration)', () => {
  it('overrides the effective category and records an AI-vs-human audit entry', async () => {
    const repo = new InMemoryWarrantyRepository();
    const audit = new FakeAuditLogger();
    const w = Warranty.fromParsedRow({
      dealId: 'deal-1', spaReference: '16.2', title: 'Tax returns', fullText: 'Filed.',
      aiCategory: Category.of(WarrantyCategory.BUSINESS),
      aiConfidence: ConfidenceScore.create(0.9).getValue(),
    }).getValue();
    await repo.save(w);

    const handler = new OverrideCategoryHandler(repo, fakeEventPublisher, audit as unknown as AuditLogger);
    const result = await handler.execute(new OverrideCategoryCommand(w.id.toString(), WarrantyCategory.TAX, 'user-7'));

    expect(result.category).toBe(WarrantyCategory.TAX);
    expect((await repo.findById(w.id.toString()))!.category).toBe(WarrantyCategory.TAX);

    expect(audit.entries).toHaveLength(1);
    const entry = audit.entries[0];
    expect(entry.action).toBe('WARRANTY_CATEGORY_OVERRIDDEN');
    expect(entry.before).toEqual({ category: WarrantyCategory.BUSINESS, source: 'AI' });
    expect(entry.after).toEqual({ category: WarrantyCategory.TAX, source: 'HUMAN' });
  });
});
