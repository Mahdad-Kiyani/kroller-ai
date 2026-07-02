import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CoveragePosition } from '@prisma/client';

export class DecidePositionDto {
  @ApiProperty({ enum: CoveragePosition, example: CoveragePosition.COVERED })
  @IsEnum(CoveragePosition)
  position!: CoveragePosition;

  @ApiProperty({ example: 'Covered subject to standard tax exclusion.', required: false })
  @IsOptional() @IsString()
  comment?: string;
}
export class PositionResultDto {
  @ApiProperty({ enum: CoveragePosition, example: CoveragePosition.COVERED })
  position!: CoveragePosition;
}
