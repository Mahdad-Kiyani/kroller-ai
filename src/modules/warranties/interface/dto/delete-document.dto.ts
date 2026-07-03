import { ApiProperty } from '@nestjs/swagger';

export class DeleteDocumentResultDto {
  @ApiProperty({ example: true })
  deleted!: boolean;
  @ApiProperty({ example: 12, description: 'Warranties extracted from this document that were removed with it.' })
  warrantiesRemoved!: number;
}
