import { ApiProperty } from '@nestjs/swagger';

export class UploadResponseDto {
  @ApiProperty({ format: 'uuid', example: 'b2c3d4e5-1111-2222-3333-444455556666' })
  documentId!: string;
  @ApiProperty({ example: 'deals/6be65189.../a1b2-spa.docx' })
  storageKey!: string;
  @ApiProperty({ example: 'queued', description: 'Parsing runs asynchronously on a worker.' })
  status!: string;
}
