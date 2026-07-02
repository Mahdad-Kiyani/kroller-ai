import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { Document, DocumentStatus } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { ListDocumentsByDealQuery, GetDocumentQuery } from './list-documents.query';
import { DocumentReadModel } from './document.read-model';

const TERMINAL_STATUSES: DocumentStatus[] = ['PARSED', 'FAILED'];

function toReadModel(doc: Document): DocumentReadModel {
  return {
    id: doc.id,
    dealId: doc.dealId,
    filename: doc.filename,
    mimeType: doc.mimeType,
    status: doc.status,
    error: doc.error,
    isComplete: TERMINAL_STATUSES.includes(doc.status),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/** Backs UI polling for per-document parse progress (upload → parsing → parsed/failed). */
@QueryHandler(ListDocumentsByDealQuery)
export class ListDocumentsByDealHandler implements IQueryHandler<ListDocumentsByDealQuery> {
  constructor(private readonly prisma: PrismaService) {}
  async execute(q: ListDocumentsByDealQuery): Promise<DocumentReadModel[]> {
    const rows = await this.prisma.document.findMany({ where: { dealId: q.dealId }, orderBy: { createdAt: 'asc' } });
    return rows.map(toReadModel);
  }
}

@QueryHandler(GetDocumentQuery)
export class GetDocumentHandler implements IQueryHandler<GetDocumentQuery> {
  constructor(private readonly prisma: PrismaService) {}
  async execute(q: GetDocumentQuery): Promise<DocumentReadModel> {
    const doc = await this.prisma.document.findUnique({ where: { id: q.id } });
    if (!doc) throw new NotFoundException('Document not found.');
    return toReadModel(doc);
  }
}
