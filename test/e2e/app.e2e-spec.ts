import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { STORAGE_PORT } from '@shared/infrastructure/storage/storage.port';
import { EMBEDDING_PORT } from '@shared/infrastructure/embeddings/embedding.port';
import { VectorStore, SimilarWarranty } from '@shared/infrastructure/embeddings/vector-store.service';
import { WARRANTY_PARSER } from '@modules/warranties/application/ports/warranty-parser.port';
import { WARRANTY_REPOSITORY } from '@modules/warranties/domain/warranty.repository';
import { EXCLUSION_MAPPER } from '@modules/exclusions/application/ports/exclusion-mapper.port';
import { Warranty } from '@modules/warranties/domain/warranty.aggregate';
import { Category } from '@modules/warranties/domain/value-objects/warranty-category.vo';
import { ConfidenceScore } from '@modules/warranties/domain/value-objects/confidence-score.vo';
import { WarrantyCategory } from '@prisma/client';
import {
  FakeStoragePort, FakeEmbeddingPort, FakeWarrantyParser, FakeExclusionMapper, FakeVectorStore,
} from '../support/fakes';

const KEY = process.env.SERVICE_API_KEY ?? 'test-key';
const PRECEDENT: SimilarWarranty[] = [
  { id: 'p1', dealId: 'old', spaReference: '1', decidedPosition: 'COVERED', decidedComment: 'ok', category: 'TAX', distance: 0.05 },
  { id: 'p2', dealId: 'old', spaReference: '2', decidedPosition: 'COVERED', decidedComment: 'ok', category: 'TAX', distance: 0.3 },
];

describe('W&I AI Service (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let dealId: string;
  let warrantyId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(STORAGE_PORT).useValue(new FakeStoragePort())
      .overrideProvider(WARRANTY_PARSER).useValue(new FakeWarrantyParser([]))
      .overrideProvider(EMBEDDING_PORT).useValue(new FakeEmbeddingPort())
      .overrideProvider(VectorStore).useValue(new FakeVectorStore(PRECEDENT))
      .overrideProvider(EXCLUSION_MAPPER).useValue(
        new FakeExclusionMapper([{ warrantyId: 'PLACEHOLDER', rationale: 'disclosed', confidence: 0.8 }]),
      )
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, transformOptions: { enableImplicitConversion: true } }));
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.auditLog.deleteMany();
    await prisma.deal.deleteMany();
  });

  afterAll(async () => {
    await app?.close();
  });

  const http = () => request(app.getHttpServer());

  it('GET /api/health is public and reports DB up', async () => {
    const res = await http().get('/api/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', db: 'up' });
  });

  it('rejects requests without the service API key', async () => {
    await http().get('/api/v1/deals').expect(401);
  });

  it('POST /api/v1/deals creates a deal', async () => {
    const res = await http()
      .post('/api/v1/deals')
      .set('x-api-key', KEY)
      .send({ externalRef: `E2E-${Date.now()}`, name: 'Project E2E', governingLaw: 'Netherlands' })
      .expect(201);
    expect(res.body.id).toBeDefined();
    dealId = res.body.id;
  });

  it('seeds warranties and lists them over HTTP', async () => {
    const repo = app.get(WARRANTY_REPOSITORY) as { saveMany: (w: Warranty[]) => Promise<void> };
    const w = Warranty.fromParsedRow({
      dealId, spaReference: '16.2', title: 'Tax returns filed', fullText: 'The Company has filed all tax returns.',
      aiCategory: Category.of(WarrantyCategory.BUSINESS), aiConfidence: ConfidenceScore.create(0.92).getValue(),
    }).getValue();
    await repo.saveMany([w]);

    const res = await http().get(`/api/v1/deals/${dealId}/warranties`).set('x-api-key', KEY).expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].aiCategory).toBe('BUSINESS');
    warrantyId = res.body[0].id;
  });

  it('PATCH category override writes an AI-vs-human audit row', async () => {
    await http()
      .patch(`/api/v1/warranties/${warrantyId}/category`)
      .set('x-api-key', KEY)
      .send({ category: 'TAX' })
      .expect(200);

    const w = await prisma.warranty.findUnique({ where: { id: warrantyId } });
    expect(w!.category).toBe('TAX');
    expect(w!.aiCategory).toBe('BUSINESS'); // AI suggestion preserved

    const audit = await prisma.auditLog.findFirst({ where: { entityId: warrantyId, action: 'WARRANTY_CATEGORY_OVERRIDDEN' } });
    expect(audit).not.toBeNull();
    expect((audit!.afterJson as { source: string }).source).toBe('HUMAN');
  });

  it('POST suggestions/generate attaches a position from precedent', async () => {
    const res = await http()
      .post(`/api/v1/deals/${dealId}/suggestions/generate`)
      .set('x-api-key', KEY)
      .expect(201);
    expect(res.body.suggested).toBe(1);

    const w = await prisma.warranty.findUnique({ where: { id: warrantyId } });
    expect(w!.aiPosition).toBe('COVERED'); // majority of TAX precedent
  });

  it('PATCH position decide writes an audit row (learning signal)', async () => {
    await http()
      .patch(`/api/v1/warranties/${warrantyId}/position`)
      .set('x-api-key', KEY)
      .send({ position: 'PARTIAL', comment: 'Covered subject to cap.' })
      .expect(200);

    const w = await prisma.warranty.findUnique({ where: { id: warrantyId } });
    expect(w!.decidedPosition).toBe('PARTIAL');
    const audit = await prisma.auditLog.findFirst({ where: { entityId: warrantyId, action: 'WARRANTY_POSITION_DECIDED' } });
    expect(audit).not.toBeNull();
  });

  it('creates an exclusion and runs AI impact mapping', async () => {
    const created = await http()
      .post(`/api/v1/deals/${dealId}/exclusions`)
      .set('x-api-key', KEY)
      .send({ label: 'Known Issues', text: 'Matters fairly disclosed in the data room.' })
      .expect(201);
    const exclusionId = created.body.id;

    // point the fake mapper at the real warranty id
    const mapper = app.get(EXCLUSION_MAPPER) as FakeExclusionMapper;
    (mapper as unknown as { impacts: { warrantyId: string; rationale: string; confidence: number }[] }).impacts = [
      { warrantyId, rationale: 'disclosure carve-out', confidence: 0.85 },
    ];

    const mapped = await http().post(`/api/v1/deals/${dealId}/exclusions/${exclusionId}/map`).set('x-api-key', KEY).expect(201);
    expect(mapped.body.mapped).toBe(1);

    const list = await http().get(`/api/v1/deals/${dealId}/exclusions`).set('x-api-key', KEY).expect(200);
    expect(list.body[0].impacts).toHaveLength(1);
    expect(list.body[0].impacts[0].spaReference).toBe('16.2');
  });
});
