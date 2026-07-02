import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiSecurity, ApiTags, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { CreateExclusionCommand } from '../application/commands/create-exclusion.command';
import { MapExclusionImpactCommand } from '../application/commands/map-exclusion-impact.command';
import { ListExclusionsByDealQuery } from '../application/queries/list-exclusions.query';
import { CreateExclusionDto, CreatedExclusionDto, MapResultDto, ExclusionResponseDto } from './dto/create-exclusion.dto';

const ACTOR = 'service';

@ApiTags('exclusions')
@ApiSecurity('service-key')
@Controller('deals/:dealId/exclusions')
export class ExclusionsController {
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}

  @Post()
  @ApiOperation({ summary: 'Create an exclusion for a deal' })
  @ApiCreatedResponse({ type: CreatedExclusionDto })
  create(@Param('dealId', ParseUUIDPipe) dealId: string, @Body() dto: CreateExclusionDto): Promise<CreatedExclusionDto> {
    return this.commandBus.execute(new CreateExclusionCommand(dealId, dto.label, dto.text, dto.isStandard ?? true));
  }

  @Post(':exclusionId/map')
  @ApiOperation({ summary: 'Run AI impact mapping → affected warranties (audited)' })
  @ApiCreatedResponse({ type: MapResultDto })
  map(@Param('exclusionId', ParseUUIDPipe) exclusionId: string): Promise<MapResultDto> {
    return this.commandBus.execute(new MapExclusionImpactCommand(exclusionId, ACTOR));
  }

  @Get()
  @ApiOperation({ summary: 'List exclusions with their mapped warranty impacts' })
  @ApiOkResponse({ type: [ExclusionResponseDto] })
  list(@Param('dealId', ParseUUIDPipe) dealId: string): Promise<ExclusionResponseDto[]> {
    return this.queryBus.execute(new ListExclusionsByDealQuery(dealId));
  }
}
