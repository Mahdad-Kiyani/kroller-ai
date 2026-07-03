import { DeleteDocumentHandler } from '@modules/warranties/application/commands/delete-document.handler';
import { DeleteDocumentCommand } from '@modules/warranties/application/commands/delete-document.command';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { FakeStoragePort, FakeAuditLogger } from '../support/fakes';
import { AuditLogger } from '@shared/infrastructure/audit/audit-logger.service';

describe('DeleteDocumentHandler (integration)', () => {
  it('deletes the storage object, the document, and returns the warranty count', async () => {
    const storage = new FakeStoragePort();
    await storage.putObject('deals/deal-1/spa.docx', Buffer.from('pdf'));
    const audit = new FakeAuditLogger();

    let deletedId: string | null = null;
    const fakePrisma = {
      document: {
        findUnique: async () => ({ id: 'doc-1', dealId: 'deal-1', storageKey: 'deals/deal-1/spa.docx', filename: 'spa.docx' }),
        delete: async ({ where }: { where: { id: string } }) => {
          deletedId = where.id;
          return {};
        },
      },
      warranty: {
        count: async () => 7,
      },
    } as unknown as PrismaService;

    const handler = new DeleteDocumentHandler(storage, fakePrisma, audit as unknown as AuditLogger);
    const result = await handler.execute(new DeleteDocumentCommand('doc-1'));

    expect(result).toEqual({ deleted: true, warrantiesRemoved: 7 });
    expect(deletedId).toBe('doc-1');
    expect(storage.deleted).toEqual(['deals/deal-1/spa.docx']);
    expect(storage.store.has('deals/deal-1/spa.docx')).toBe(false);

    expect(audit.entries).toHaveLength(1);
    expect(audit.entries[0].action).toBe('DOCUMENT_DELETED');
    expect(audit.entries[0].entityId).toBe('doc-1');
  });

  it('throws NotFoundException for a missing document', async () => {
    const storage = new FakeStoragePort();
    const audit = new FakeAuditLogger();
    const fakePrisma = {
      document: { findUnique: async () => null },
    } as unknown as PrismaService;

    const handler = new DeleteDocumentHandler(storage, fakePrisma, audit as unknown as AuditLogger);
    await expect(handler.execute(new DeleteDocumentCommand('missing'))).rejects.toThrow('Document not found.');
  });
});
