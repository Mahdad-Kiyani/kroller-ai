import { IngestParsedWarrantiesHandler } from '@modules/warranties/application/commands/ingest-parsed-warranties.handler';
import { IngestParsedWarrantiesCommand } from '@modules/warranties/application/commands/ingest-parsed-warranties.command';
import { InMemoryWarrantyRepository } from '../support/in-memory-warranty.repository';
import { FakeWarrantyParser, fakeEventPublisher } from '../support/fakes';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

describe('IngestParsedWarrantiesHandler (integration)', () => {
  it('builds warranties from parser output and flags low-confidence rows', async () => {
    const repo = new InMemoryWarrantyRepository();
    const parser = new FakeWarrantyParser([
      { spaReference: '16.2', title: 'Tax returns', fullText: 'Filed all returns.', category: 'TAX', confidence: 0.95 },
      { spaReference: '4.1', title: 'Capacity', fullText: 'Has full capacity.', category: 'FUNDAMENTAL', confidence: 0.55 },
      { spaReference: 'X', title: 'Junk', fullText: 'bad', category: 'NOT_A_CATEGORY', confidence: 0.9 }, // dropped
    ]);

    const statuses: string[] = [];
    const fakePrisma = {
      document: {
        findUnique: async () => ({ id: 'doc-1', dealId: 'deal-1', storageKey: 'k', mimeType: 'text/plain' }),
        update: async ({ data }: { data: { status: string } }) => {
          statuses.push(data.status);
          return {};
        },
      },
    } as unknown as PrismaService;

    const handler = new IngestParsedWarrantiesHandler(repo, parser, fakePrisma, fakeEventPublisher);
    const result = await handler.execute(new IngestParsedWarrantiesCommand('doc-1'));

    expect(result.ingested).toBe(2); // the unknown-category row is skipped
    expect(result.flagged).toBe(1); // the 0.55-confidence row
    expect((await repo.listByDeal('deal-1')).length).toBe(2);
    expect(statuses).toEqual(['PARSING', 'PARSED']);
  });
});
