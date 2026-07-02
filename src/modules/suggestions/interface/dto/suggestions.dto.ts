import { ApiProperty } from '@nestjs/swagger';

export class GenerateSuggestionsResultDto {
  @ApiProperty({ example: 12, description: 'Warranties that received an AI position suggestion.' })
  suggested!: number;
  @ApiProperty({ example: 3, description: 'Warranties with no comparable precedent yet.' })
  skipped!: number;
}
export class SimilarWarrantyResponseDto {
  @ApiProperty({ format: 'uuid', example: '0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0' })
  id!: string;
  @ApiProperty({ format: 'uuid', example: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' })
  dealId!: string;
  @ApiProperty({ example: '16.2' })
  spaReference!: string;
  @ApiProperty({ example: 'COVERED', nullable: true })
  decidedPosition!: string | null;
  @ApiProperty({ example: 0.86, description: 'Cosine similarity 0..1.' })
  similarity!: number;
}
