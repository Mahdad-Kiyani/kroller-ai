import { DeleteDealHandler } from '@modules/deals/application/commands/delete-deal.handler';
import { DeleteDealCommand } from '@modules/deals/application/commands/delete-deal.command';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { FakeStoragePort, FakeAuditLogger } from '../support/fakes';
import { AuditLogger } from '@shared/infrastructure/audit/audit-logger.service';

describe('DeleteDealHandler (integration)', () => {
  it('deletes every document object, the deal, and returns removal counts', async () => {
    const storage = new FakeStoragePort();
    await storage.putObject('deals/deal-1/a.docx', Buffer.from('a'));
    await storage.putObject('deals/deal-1/b.docx', Buffer.from('b'));
    const audit = new FakeAuditLogger();

    let deletedId: string | null = null;
    const fakePrisma = {
      deal: {
        findUnique: async () => ({ id: 'deal-1', name: 'Project Fujitsu', externalRef: 'PANEL-1' }),
        delete: async ({ where }: { where: { id: string } }) => {
          deletedId = where.id;
          return {};
        },
      },
      document: {
        findMany: async () => [{ storageKey: 'deals/deal-1/a.docx' }, { storageKey: 'deals/deal-1/b.docx' }],
      },
      warranty: { count: async () => 12 },
      exclusion: { count: async () => 3 },
    } as unknown as PrismaService;

    const handler = new DeleteDealHandler(storage, fakePrisma, audit as unknown as AuditLogger);
    const result = await handler.execute(new DeleteDealCommand('deal-1'));

    expect(result).toEqual({ deleted: true, documentsRemoved: 2, warrantiesRemoved: 12, exclusionsRemoved: 3 });
    expect(deletedId).toBe('deal-1');
    expect(storage.deleted.sort()).toEqual(['deals/deal-1/a.docx', 'deals/deal-1/b.docx']);
    expect(storage.store.size).toBe(0);

    expect(audit.entries).toHaveLength(1);
    expect(audit.entries[0].action).toBe('DEAL_DELETED');
    expect(audit.entries[0].entityId).toBe('deal-1');
  });

  it('throws NotFoundException for a missing deal', async () => {
    const storage = new FakeStoragePort();
    const audit = new FakeAuditLogger();
    const fakePrisma = {
      deal: { findUnique: async () => null },
    } as unknown as PrismaService;

    const handler = new DeleteDealHandler(storage, fakePrisma, audit as unknown as AuditLogger);
    await expect(handler.execute(new DeleteDealCommand('missing'))).rejects.toThrow('Deal not found.');
  });
});
