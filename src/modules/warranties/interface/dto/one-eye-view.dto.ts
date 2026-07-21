import { ApiProperty } from '@nestjs/swagger';
import { CoverageBucket } from '../../application/queries/one-eye-view.read-model';

const BUCKET_VALUES: CoverageBucket[] = ['COVERED', 'PARTIAL', 'EXCLUDED', 'UNMAPPED'];

export class OneEyeWarrantyDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ description: 'Verbatim SPA numbering.' })
  spaReference!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ enum: BUCKET_VALUES })
  bucket!: CoverageBucket;

  @ApiProperty({ description: 'True when a human decided the position; false when it is the AI suggestion.' })
  decided!: boolean;

  @ApiProperty({ description: "Seller's-knowledge / awareness qualifier present in the warranty text." })
  hasKnowledgeScrape!: boolean;

  @ApiProperty({ description: 'Materiality qualifier ("in all material respects" / MAE) present.' })
  hasMaterialityScrape!: boolean;
}

export class OneEyeViewDto {
  @ApiProperty()
  dealId!: string;

  @ApiProperty({
    description: 'Warranties grouped by bucket. Keys are COVERED, PARTIAL, EXCLUDED, UNMAPPED.',
    type: 'object',
    additionalProperties: { type: 'array', items: { $ref: '#/components/schemas/OneEyeWarrantyDto' } },
  })
  buckets!: Record<CoverageBucket, OneEyeWarrantyDto[]>;

  @ApiProperty({
    description: 'Per-bucket counts. Keys are COVERED, PARTIAL, EXCLUDED, UNMAPPED.',
    type: 'object',
    additionalProperties: { type: 'number' },
  })
  counts!: Record<CoverageBucket, number>;

  @ApiProperty()
  total!: number;

  @ApiProperty({ description: 'How many warranties carry a knowledge scrape, across all buckets.' })
  knowledgeScrapeCount!: number;

  @ApiProperty({ description: 'How many warranties carry a materiality scrape, across all buckets.' })
  materialityScrapeCount!: number;
}
