import { ApiProperty } from '@nestjs/swagger';

export class GenerateSuggestionsResultDto {
  @ApiProperty({ example: 12, description: 'Warranties that received an AI position suggestion.' })
  suggested!: number;
  @ApiProperty({ example: 3, description: 'Warranties with no comparable precedent yet.' })
  skipped!: number;
}
export class SimilarWarrantyResponseDto {
  @ApiProperty({ format: 'uuid', example: '0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0' })
  warrantyId!: string;
  @ApiProperty({ example: 'Project Fujitsu', description: 'Name of the deal the precedent warranty belongs to.' })
  dealName!: string;
  @ApiProperty({ example: '16.2' })
  spaReference!: string;
  @ApiProperty({ example: 'Tax returns filed and accurate' })
  title!: string;
  @ApiProperty({ example: 'BUSINESS', nullable: true })
  category!: string | null;
  @ApiProperty({ example: 'COVERED', nullable: true })
  decidedPosition!: string | null;
  @ApiProperty({ example: 0.86, description: 'Cosine similarity 0..1.' })
  similarity!: number;
}
