import { ApiProperty } from '@nestjs/swagger';
import { WarrantyCategory, CoveragePosition } from '@prisma/client';

export class WarrantyResponseDto {
  @ApiProperty({ format: 'uuid', example: '77b9c770-76f0-43c0-a42f-03f6e88adc16' })
  id!: string;
  @ApiProperty({ format: 'uuid', example: '6be65189-d80f-48c0-9f91-c7823d9cf449' })
  dealId!: string;
  @ApiProperty({ example: '16.2', description: 'Verbatim SPA numbering.' })
  spaReference!: string;
  @ApiProperty({ example: 'Tax returns filed' })
  title!: string;
  @ApiProperty({ enum: WarrantyCategory, nullable: true, example: WarrantyCategory.BUSINESS, description: 'AI suggestion (immutable).' })
  aiCategory!: WarrantyCategory | null;
  @ApiProperty({ example: 0.92, nullable: true })
  aiConfidence!: number | null;
  @ApiProperty({ enum: WarrantyCategory, nullable: true, example: WarrantyCategory.TAX, description: 'Effective category after any override.' })
  category!: WarrantyCategory | null;
  @ApiProperty({ example: true })
  overridden!: boolean;
  @ApiProperty({ example: false, description: 'AI confidence below the manual-review threshold.' })
  needsReview!: boolean;
  @ApiProperty({ enum: CoveragePosition, nullable: true, example: CoveragePosition.COVERED, description: 'AI-suggested coverage position.' })
  aiPosition!: CoveragePosition | null;
  @ApiProperty({ example: 'Similar warranties in 7 past deals were Covered.', nullable: true })
  aiComment!: string | null;
  @ApiProperty({ example: 0.84, nullable: true, description: 'Retrieval similarity score 0..1.' })
  aiPositionScore!: number | null;
  @ApiProperty({ enum: CoveragePosition, nullable: true, example: null, description: 'Human-decided position.' })
  decidedPosition!: CoveragePosition | null;
  @ApiProperty({ example: null, nullable: true })
  decidedBy!: string | null;
}
