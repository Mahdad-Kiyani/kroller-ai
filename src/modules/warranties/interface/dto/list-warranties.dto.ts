import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { WarrantyResponseDto } from './warranty-response.dto';

// Bounds skip = (page - 1) * pageSize away from pathological OFFSET values reaching Postgres.
const MAX_PAGE = 1_000_000;

export class ListWarrantiesQueryDto {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_PAGE,
    example: 1,
    description: 'Page number (1-based). Omit together with pageSize to fetch the full unpaginated list.',
  })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(MAX_PAGE)
  page?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 100,
    example: 20,
    description: 'Items per page (max 100). Omit together with page to fetch the full unpaginated list.',
  })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize?: number;
}

export class PaginatedWarrantiesDto {
  @ApiProperty({ type: [WarrantyResponseDto] })
  data!: WarrantyResponseDto[];
  @ApiProperty({ example: 42, description: 'Total warranties on the deal, across all pages.' })
  total!: number;
  @ApiProperty({ example: 1 })
  page!: number;
  @ApiProperty({ example: 20 })
  pageSize!: number;
  @ApiProperty({ example: 3 })
  totalPages!: number;
}
