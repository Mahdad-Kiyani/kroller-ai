import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ExclusionsController } from './interface/exclusions.controller';
import { EXCLUSION_REPOSITORY } from './domain/exclusion.repository';
import { EXCLUSION_MAPPER } from './application/ports/exclusion-mapper.port';
import { PrismaExclusionRepository } from './infrastructure/prisma-exclusion.repository';
import { ClaudeExclusionMapper } from './infrastructure/claude-exclusion-mapper.adapter';
import { CreateExclusionHandler } from './application/commands/create-exclusion.handler';
import { MapExclusionImpactHandler } from './application/commands/map-exclusion-impact.handler';
import { ListExclusionsByDealHandler } from './application/queries/list-exclusions.handler';

@Module({
  imports: [CqrsModule],
  controllers: [ExclusionsController],
  providers: [
    { provide: EXCLUSION_REPOSITORY, useClass: PrismaExclusionRepository },
    { provide: EXCLUSION_MAPPER, useClass: ClaudeExclusionMapper },
    CreateExclusionHandler, MapExclusionImpactHandler, ListExclusionsByDealHandler,
  ],
})
export class ExclusionsModule {}
