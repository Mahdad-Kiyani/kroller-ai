import { UpdateDealHandler } from '@modules/deals/application/commands/update-deal.handler';
import { UpdateDealCommand } from '@modules/deals/application/commands/update-deal.command';
import { Deal } from '@modules/deals/domain/deal.aggregate';
import { InMemoryDealRepository } from '../support/in-memory-deal.repository';
import { FakeAuditLogger } from '../support/fakes';
import { AuditLogger } from '@shared/infrastructure/audit/audit-logger.service';

describe('UpdateDealHandler (integration)', () => {
  it('updates the deal name and records an audit entry', async () => {
    const repo = new InMemoryDealRepository();
    const deal = Deal.create({ externalRef: 'PANEL-1', name: 'Project Fujitsu', governingLaw: 'Netherlands' }).getValue();
    await repo.save(deal);
    const audit = new FakeAuditLogger();

    const handler = new UpdateDealHandler(repo, audit as unknown as AuditLogger);
    const result = await handler.execute(new UpdateDealCommand(deal.id.toString(), 'Project Meridian'));

    expect(result).toEqual({ id: deal.id.toString() });
    expect((await repo.findById(deal.id.toString()))?.name).toBe('Project Meridian');

    expect(audit.entries).toHaveLength(1);
    expect(audit.entries[0].action).toBe('DEAL_UPDATED');
    expect(audit.entries[0].before).toEqual({ name: 'Project Fujitsu', governingLaw: 'Netherlands' });
    expect(audit.entries[0].after).toEqual({ name: 'Project Meridian', governingLaw: 'Netherlands' });
  });

  it('throws NotFoundException for a missing deal', async () => {
    const repo = new InMemoryDealRepository();
    const audit = new FakeAuditLogger();
    const handler = new UpdateDealHandler(repo, audit as unknown as AuditLogger);
    await expect(handler.execute(new UpdateDealCommand('missing', 'X'))).rejects.toThrow('Deal not found.');
  });

  it('rejects an empty name', async () => {
    const repo = new InMemoryDealRepository();
    const deal = Deal.create({ externalRef: 'PANEL-1', name: 'Project Fujitsu', governingLaw: 'Netherlands' }).getValue();
    await repo.save(deal);
    const audit = new FakeAuditLogger();
    const handler = new UpdateDealHandler(repo, audit as unknown as AuditLogger);
    await expect(handler.execute(new UpdateDealCommand(deal.id.toString(), '   '))).rejects.toThrow();
  });
});
