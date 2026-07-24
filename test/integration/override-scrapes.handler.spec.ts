import { OverrideScrapesHandler } from '@modules/warranties/application/commands/override-scrapes.handler';
import { OverrideScrapesCommand } from '@modules/warranties/application/commands/override-scrapes.command';
import { Warranty } from '@modules/warranties/domain/warranty.aggregate';
import { Category } from '@modules/warranties/domain/value-objects/warranty-category.vo';
import { ConfidenceScore } from '@modules/warranties/domain/value-objects/confidence-score.vo';
import { WarrantyCategory, ScrapeStatus } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InMemoryWarrantyRepository } from '../support/in-memory-warranty.repository';
import { FakeAuditLogger, fakeEventPublisher } from '../support/fakes';
import { AuditLogger } from '@shared/infrastructure/audit/audit-logger.service';

/** Seeds a warranty whose AI detection is K=YES / M=NO. */
function seedWarranty(repo: InMemoryWarrantyRepository) {
  const w = Warranty.fromParsedRow({
    dealId: 'deal-1',
    spaReference: '16.2',
    title: 'Tax returns',
    fullText: "To the Seller's knowledge, all returns are filed.",
    aiCategory: Category.of(WarrantyCategory.TAX),
    aiConfidence: ConfidenceScore.create(0.9).getValue(),
    aiKnowledgeScrape: ScrapeStatus.YES,
    aiMaterialityScrape: ScrapeStatus.NO,
    aiKnowledgeScrapeText: "To the Seller's knowledge",
  }).getValue();
  return w;
}

describe('OverrideScrapesHandler (integration)', () => {
  it('overrides the effective scrape status and records an AI-vs-human audit entry', async () => {
    const repo = new InMemoryWarrantyRepository();
    const audit = new FakeAuditLogger();
    const w = seedWarranty(repo);
    await repo.save(w);

    const handler = new OverrideScrapesHandler(repo, fakeEventPublisher, audit as unknown as AuditLogger);
    const result = await handler.execute(
      new OverrideScrapesCommand(w.id.toString(), ScrapeStatus.NO, ScrapeStatus.YES, 'user-7'),
    );

    expect(result).toEqual({ knowledgeScrape: ScrapeStatus.NO, materialityScrape: ScrapeStatus.YES });

    const reloaded = (await repo.findById(w.id.toString()))!;
    // Effective status reflects the human override…
    expect(reloaded.knowledgeScrape).toBe(ScrapeStatus.NO);
    expect(reloaded.materialityScrape).toBe(ScrapeStatus.YES);
    expect(reloaded.scrapesOverriddenBy).toBe('user-7');
    // …but the AI detection stays immutable.
    expect(reloaded.aiKnowledgeScrape).toBe(ScrapeStatus.YES);
    expect(reloaded.aiMaterialityScrape).toBe(ScrapeStatus.NO);

    expect(audit.entries).toHaveLength(1);
    const entry = audit.entries[0];
    expect(entry.action).toBe('WARRANTY_SCRAPES_OVERRIDDEN');
    expect(entry.before).toEqual({
      knowledgeScrape: ScrapeStatus.YES,
      materialityScrape: ScrapeStatus.NO,
      source: 'AI',
    });
    expect(entry.after).toEqual({
      knowledgeScrape: ScrapeStatus.NO,
      materialityScrape: ScrapeStatus.YES,
      source: 'HUMAN',
    });
  });

  it('rejects a no-op override (target equals current effective status)', async () => {
    const repo = new InMemoryWarrantyRepository();
    const audit = new FakeAuditLogger();
    const w = seedWarranty(repo);
    await repo.save(w);

    const handler = new OverrideScrapesHandler(repo, fakeEventPublisher, audit as unknown as AuditLogger);
    // Current effective status is K=YES / M=NO — re-submitting it must fail.
    await expect(
      handler.execute(new OverrideScrapesCommand(w.id.toString(), ScrapeStatus.YES, ScrapeStatus.NO, 'user-7')),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(audit.entries).toHaveLength(0);
  });

  it('throws NotFound for an unknown warranty', async () => {
    const repo = new InMemoryWarrantyRepository();
    const audit = new FakeAuditLogger();
    const handler = new OverrideScrapesHandler(repo, fakeEventPublisher, audit as unknown as AuditLogger);

    await expect(
      handler.execute(new OverrideScrapesCommand('missing-id', ScrapeStatus.YES, ScrapeStatus.NO, 'user-7')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
