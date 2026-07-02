import {
  Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post,
  UploadedFile, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBody, ApiConsumes, ApiOperation, ApiSecurity, ApiTags, ApiOkResponse, ApiCreatedResponse,
} from '@nestjs/swagger';
import { UploadDocumentCommand } from '../application/commands/upload-document.command';
import { OverrideCategoryCommand } from '../application/commands/override-category.command';
import { DecidePositionCommand } from '../application/commands/decide-position.command';
import { ListWarrantiesByDealQuery, GetWarrantyQuery } from '../application/queries/list-warranties.query';
import { ListDocumentsByDealQuery, GetDocumentQuery } from '../application/queries/list-documents.query';
import { UploadResponseDto } from './dto/upload-response.dto';
import { OverrideCategoryDto, CategoryResultDto } from './dto/override-category.dto';
import { DecidePositionDto, PositionResultDto } from './dto/decide-position.dto';
import { WarrantyResponseDto } from './dto/warranty-response.dto';
import { DocumentResponseDto } from './dto/document-response.dto';

const ACTOR = 'service'; // replace with authenticated principal once portal identity is wired

@ApiTags('warranties')
@ApiSecurity('service-key')
@Controller()
export class WarrantiesController {
  constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}

  @Post('deals/:dealId/documents')
  @ApiOperation({ summary: 'Upload an SPA/warranty file → MinIO, then async AI parse' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiCreatedResponse({ type: UploadResponseDto })
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Param('dealId', ParseUUIDPipe) dealId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadResponseDto> {
    if (!file) throw new BadRequestException('A file is required.');
    const res = await this.commandBus.execute(
      new UploadDocumentCommand(dealId, file.originalname, file.mimetype, file.buffer),
    );
    return { documentId: res.documentId, storageKey: res.storageKey, status: 'queued' };
  }

  @Get('deals/:dealId/documents')
  @ApiOperation({ summary: 'List documents for a deal with live parse status (poll this to drive a per-document loading state)' })
  @ApiOkResponse({ type: [DocumentResponseDto] })
  listDocuments(@Param('dealId', ParseUUIDPipe) dealId: string): Promise<DocumentResponseDto[]> {
    return this.queryBus.execute(new ListDocumentsByDealQuery(dealId));
  }

  @Get('documents/:id')
  @ApiOperation({ summary: 'Get one document and its parse status' })
  @ApiOkResponse({ type: DocumentResponseDto })
  getDocument(@Param('id', ParseUUIDPipe) id: string): Promise<DocumentResponseDto> {
    return this.queryBus.execute(new GetDocumentQuery(id));
  }

  @Get('deals/:dealId/warranties')
  @ApiOperation({ summary: 'List warranties for a deal (AI vs effective category + position)' })
  @ApiOkResponse({ type: [WarrantyResponseDto] })
  list(@Param('dealId', ParseUUIDPipe) dealId: string): Promise<WarrantyResponseDto[]> {
    return this.queryBus.execute(new ListWarrantiesByDealQuery(dealId));
  }

  @Get('warranties/:id')
  @ApiOperation({ summary: 'Get one warranty' })
  @ApiOkResponse({ type: WarrantyResponseDto })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<WarrantyResponseDto> {
    return this.queryBus.execute(new GetWarrantyQuery(id));
  }

  @Patch('warranties/:id/category')
  @ApiOperation({ summary: 'Override AI category (audited AI-vs-human)' })
  @ApiOkResponse({ type: CategoryResultDto })
  override(@Param('id', ParseUUIDPipe) id: string, @Body() dto: OverrideCategoryDto): Promise<CategoryResultDto> {
    return this.commandBus.execute(new OverrideCategoryCommand(id, dto.category, ACTOR));
  }

  @Patch('warranties/:id/position')
  @ApiOperation({ summary: 'Decide coverage position (audited; feeds the learning loop)' })
  @ApiOkResponse({ type: PositionResultDto })
  decide(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DecidePositionDto): Promise<PositionResultDto> {
    return this.commandBus.execute(new DecidePositionCommand(id, dto.position, dto.comment ?? null, ACTOR));
  }
}
