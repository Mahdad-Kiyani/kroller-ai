import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ScrapeStatus } from '@prisma/client';

export class OverrideScrapesDto {
  @ApiProperty({
    enum: ScrapeStatus,
    example: ScrapeStatus.YES,
    description: 'New effective knowledge-scrape status.',
  })
  @IsEnum(ScrapeStatus)
  knowledgeScrape!: ScrapeStatus;

  @ApiProperty({
    enum: ScrapeStatus,
    example: ScrapeStatus.NO,
    description: 'New effective materiality-scrape status.',
  })
  @IsEnum(ScrapeStatus)
  materialityScrape!: ScrapeStatus;
}

export class ScrapesResultDto {
  @ApiProperty({ enum: ScrapeStatus, example: ScrapeStatus.YES })
  knowledgeScrape!: ScrapeStatus;

  @ApiProperty({ enum: ScrapeStatus, example: ScrapeStatus.NO })
  materialityScrape!: ScrapeStatus;
}
