import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiSecurity, ApiTags, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { CreateDealCommand } from '../application/commands/create-deal.command';
import { DeleteDealCommand } from '../application/commands/delete-deal.command';
import { GetDealQuery, ListDealsQuery } from '../application/queries/get-deal.query';
import { CreateDealDto, DealResponseDto, CreatedDealDto } from './dto/create-deal.dto';
import { DeleteDealResultDto } from './dto/delete-deal.dto';

@ApiTags('deals')
@ApiSecurity('service-key')
@Controller('deals')
export class DealsController {
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}

  @Post()
  @ApiOperation({ summary: 'Register a deal/engagement for AI analysis' })
  @ApiCreatedResponse({ type: CreatedDealDto })
  create(@Body() dto: CreateDealDto): Promise<CreatedDealDto> {
    return this.commandBus.execute(new CreateDealCommand(dto.externalRef, dto.name, dto.governingLaw));
  }

  @Get()
  @ApiOperation({ summary: 'List deals' })
  @ApiOkResponse({ type: [DealResponseDto] })
  list(): Promise<DealResponseDto[]> {
    return this.queryBus.execute(new ListDealsQuery());
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a deal' })
  @ApiOkResponse({ type: DealResponseDto })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<DealResponseDto> {
    return this.queryBus.execute(new GetDealQuery(id));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Permanently delete a deal: every document (+ MinIO objects), warranty, and exclusion under it' })
  @ApiOkResponse({ type: DeleteDealResultDto })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<DeleteDealResultDto> {
    return this.commandBus.execute(new DeleteDealCommand(id));
  }
}
