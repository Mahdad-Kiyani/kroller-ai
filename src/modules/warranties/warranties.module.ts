import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { BullModule } from '@nestjs/bullmq';
import { WarrantiesController } from './interface/warranties.controller';
import { WARRANTY_REPOSITORY } from './domain/warranty.repository';
import { WARRANTY_PARSER } from './application/ports/warranty-parser.port';
import { PrismaWarrantyRepository } from './infrastructure/prisma-warranty.repository';
import { ClaudeWarrantyParser } from './infrastructure/claude-warranty-parser.adapter';
import { DocumentTextExtractor } from './infrastructure/document-text-extractor.service';
import { WarrantyParseProcessor } from './infrastructure/warranty-parse.processor';
import { WarrantyEmbedProcessor } from './infrastructure/warranty-embed.processor';
import { WarrantyCategorisedHandler } from './infrastructure/warranty-categorised.handler';
import { UploadDocumentHandler } from './application/commands/upload-document.handler';
import { IngestParsedWarrantiesHandler } from './application/commands/ingest-parsed-warranties.handler';
import { OverrideCategoryHandler } from './application/commands/override-category.handler';
import { DecidePositionHandler } from './application/commands/decide-position.handler';
import { ListWarrantiesByDealHandler, GetWarrantyHandler } from './application/queries/list-warranties.handler';
import { ListDocumentsByDealHandler, GetDocumentHandler } from './application/queries/list-documents.handler';

const CommandHandlers = [UploadDocumentHandler, IngestParsedWarrantiesHandler, OverrideCategoryHandler, DecidePositionHandler];
const QueryHandlers = [ListWarrantiesByDealHandler, GetWarrantyHandler, ListDocumentsByDealHandler, GetDocumentHandler];
const EventHandlers = [WarrantyCategorisedHandler];
const Workers = [WarrantyParseProcessor, WarrantyEmbedProcessor];

@Module({
  imports: [
    CqrsModule,
    BullModule.registerQueue({ name: 'warranty-parse' }, { name: 'warranty-embed' }),
  ],
  controllers: [WarrantiesController],
  providers: [
    { provide: WARRANTY_REPOSITORY, useClass: PrismaWarrantyRepository },
    { provide: WARRANTY_PARSER, useClass: ClaudeWarrantyParser },
    DocumentTextExtractor,
    ...CommandHandlers, ...QueryHandlers, ...EventHandlers, ...Workers,
  ],
  exports: [WARRANTY_REPOSITORY],
})
export class WarrantiesModule {}
