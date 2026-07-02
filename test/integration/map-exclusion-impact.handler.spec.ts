import { MapExclusionImpactHandler } from '@modules/exclusions/application/commands/map-exclusion-impact.handler';
import { MapExclusionImpactCommand } from '@modules/exclusions/application/commands/map-exclusion-impact.command';
import { Exclusion } from '@modules/exclusions/domain/exclusion.aggregate';
import { InMemoryExclusionRepository } from '../support/in-memory-exclusion.repository';
import { FakeExclusionMapper, FakeAuditLogger } from '../support/fakes';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { AuditLogger } from '@shared/infrastructure/audit/audit-logger.service';

describe('MapExclusionImpactHandler (integration)', () => {
  it('maps an exclusion onto warranties and audits the AI output', async () => {
    const repo = new InMemoryExclusionRepository();
    const exclusion = Exclusion.create({ dealId: 'deal-1', label: 'Known Issues', text: 'Disclosed matters.' }).getValue();
    await repo.save(exclusion);

    const mapper = new FakeExclusionMapper([
      { warrantyId: 'w1', rationale: 'directly limited', confidence: 0.9 },
      { warrantyId: 'w2', rationale: 'partially limited', confidence: 0.6 },
    ]);
    const fakePrisma = {
      warranty: { findMany: async () => [
        { id: 'w1', spaReference: '16.2', title: 'Tax', fullText: 'x' },
        { id: 'w2', spaReference: '16.3', title: 'Tax2', fullText: 'y' },
      ] },
    } as unknown as PrismaService;
    const audit = new FakeAuditLogger();

    const handler = new MapExclusionImpactHandler(repo, mapper, fakePrisma, audit as unknown as AuditLogger);
    const result = await handler.execute(new MapExclusionImpactCommand(exclusion.id.toString(), 'service'));

    expect(result.mapped).toBe(2);
    expect(repo.impacts.get(exclusion.id.toString())).toHaveLength(2);
    expect(audit.entries[0].action).toBe('EXCLUSION_IMPACT_MAPPED');
  });
});
