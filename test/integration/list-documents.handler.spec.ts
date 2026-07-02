import { ListDocumentsByDealHandler, GetDocumentHandler } from '@modules/warranties/application/queries/list-documents.handler';
import { ListDocumentsByDealQuery, GetDocumentQuery } from '@modules/warranties/application/queries/list-documents.query';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

const NOW = new Date('2026-01-01T00:00:00Z');

function fakePrismaWith(docs: Array<Record<string, unknown>>): PrismaService {
  return {
    document: {
      findMany: async ({ where }: { where: { dealId: string } }) =>
        docs.filter((d) => d.dealId === where.dealId),
      findUnique: async ({ where }: { where: { id: string } }) =>
        docs.find((d) => d.id === where.id) ?? null,
    },
  } as unknown as PrismaService;
}

describe('ListDocumentsByDealHandler / GetDocumentHandler (integration)', () => {
  const docs = [
    { id: 'doc-1', dealId: 'deal-1', filename: 'a.docx', mimeType: 'text/plain', status: 'PARSING', error: null, createdAt: NOW, updatedAt: NOW },
    { id: 'doc-2', dealId: 'deal-1', filename: 'b.docx', mimeType: 'text/plain', status: 'PARSED', error: null, createdAt: NOW, updatedAt: NOW },
    { id: 'doc-3', dealId: 'deal-1', filename: 'c.docx', mimeType: 'text/plain', status: 'FAILED', error: 'boom', createdAt: NOW, updatedAt: NOW },
    { id: 'doc-4', dealId: 'deal-2', filename: 'd.docx', mimeType: 'text/plain', status: 'UPLOADED', error: null, createdAt: NOW, updatedAt: NOW },
  ];

  it('lists documents scoped to a deal, marking PARSED/FAILED as complete', async () => {
    const handler = new ListDocumentsByDealHandler(fakePrismaWith(docs));
    const result = await handler.execute(new ListDocumentsByDealQuery('deal-1'));

    expect(result.map((d) => d.id)).toEqual(['doc-1', 'doc-2', 'doc-3']);
    expect(result.find((d) => d.id === 'doc-1')!.isComplete).toBe(false); // still PARSING
    expect(result.find((d) => d.id === 'doc-2')!.isComplete).toBe(true); // PARSED
    expect(result.find((d) => d.id === 'doc-3')!.isComplete).toBe(true); // FAILED
    expect(result.find((d) => d.id === 'doc-3')!.error).toBe('boom');
  });

  it('gets one document by id', async () => {
    const handler = new GetDocumentHandler(fakePrismaWith(docs));
    const result = await handler.execute(new GetDocumentQuery('doc-4'));
    expect(result.status).toBe('UPLOADED');
    expect(result.isComplete).toBe(false);
  });

  it('throws NotFoundException for an unknown document id', async () => {
    const handler = new GetDocumentHandler(fakePrismaWith(docs));
    await expect(handler.execute(new GetDocumentQuery('missing'))).rejects.toThrow('Document not found.');
  });
});
