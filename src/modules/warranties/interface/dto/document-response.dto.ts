import { ApiProperty } from '@nestjs/swagger';
import { DocumentStatus } from '@prisma/client';

export class DocumentResponseDto {
  @ApiProperty({ format: 'uuid', example: 'b2c3d4e5-1111-2222-3333-444455556666' })
  id!: string;
  @ApiProperty({ format: 'uuid', example: '6be65189-d80f-48c0-9f91-c7823d9cf449' })
  dealId!: string;
  @ApiProperty({ example: 'SPA_final.docx' })
  filename!: string;
  @ApiProperty({ example: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
  mimeType!: string;
  @ApiProperty({ enum: DocumentStatus, example: DocumentStatus.PARSING })
  status!: DocumentStatus;
  @ApiProperty({ example: null, nullable: true, description: 'Parse failure reason, set only when status is FAILED.' })
  error!: string | null;
  @ApiProperty({ example: false, description: 'True once status is PARSED or FAILED — safe to stop polling/hide the loading state.' })
  isComplete!: boolean;
  @ApiProperty()
  createdAt!: Date;
  @ApiProperty()
  updatedAt!: Date;
}
