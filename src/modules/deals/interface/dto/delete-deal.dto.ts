import { ApiProperty } from '@nestjs/swagger';

export class DeleteDealResultDto {
  @ApiProperty({ example: true })
  deleted!: boolean;
  @ApiProperty({ example: 2 })
  documentsRemoved!: number;
  @ApiProperty({ example: 18 })
  warrantiesRemoved!: number;
  @ApiProperty({ example: 4 })
  exclusionsRemoved!: number;
}
