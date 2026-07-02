import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { WarrantiesModule } from '@modules/warranties/warranties.module';
import { SuggestionsController } from './interface/suggestions.controller';
import { GenerateSuggestionsHandler } from './application/commands/generate-suggestions.handler';
import { GetSimilarWarrantiesHandler } from './application/queries/get-similar.handler';

@Module({
  imports: [CqrsModule, WarrantiesModule], // reuses WARRANTY_REPOSITORY
  controllers: [SuggestionsController],
  providers: [GenerateSuggestionsHandler, GetSimilarWarrantiesHandler],
})
export class SuggestionsModule {}
