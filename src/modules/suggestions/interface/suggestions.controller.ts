import { Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiSecurity, ApiTags, ApiOkResponse, ApiCreatedResponse, ApiQuery } from '@nestjs/swagger';
import { GenerateSuggestionsCommand } from '../application/commands/generate-suggestions.command';
import { GetSimilarWarrantiesQuery } from '../application/queries/get-similar.query';
import { GenerateSuggestionsResultDto, SimilarWarrantyResponseDto } from './dto/suggestions.dto';

const ACTOR = 'service';

@ApiTags('suggestions')
@ApiSecurity('service-key')
@Controller()
export class SuggestionsController {
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}

  @Post('deals/:dealId/suggestions/generate')
  @ApiOperation({ summary: 'Generate AI coverage-position suggestions from precedent (learning loop)' })
  @ApiCreatedResponse({ type: GenerateSuggestionsResultDto })
  generate(@Param('dealId', ParseUUIDPipe) dealId: string): Promise<GenerateSuggestionsResultDto> {
    return this.commandBus.execute(new GenerateSuggestionsCommand(dealId, ACTOR));
  }

  @Get('warranties/:id/similar')
  @ApiOperation({ summary: 'Nearest past warranties with a human decision (retrieval demo)' })
  @ApiQuery({ name: 'limit', required: false, example: 5 })
  @ApiOkResponse({ type: [SimilarWarrantyResponseDto] })
  similar(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: string,
  ): Promise<SimilarWarrantyResponseDto[]> {
    return this.queryBus.execute(new GetSimilarWarrantiesQuery(id, limit ? parseInt(limit, 10) : 5));
  }
}
