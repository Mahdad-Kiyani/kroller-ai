import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateExclusionDto {
  @ApiProperty({ example: 'Known Issues' })
  @IsString() @MinLength(1)
  label!: string;

  @ApiProperty({ example: 'Any liability arising from matters fairly disclosed in the data room.' })
  @IsString() @MinLength(1)
  text!: string;

  @ApiProperty({ example: true, required: false, default: true })
  @IsOptional() @IsBoolean()
  isStandard?: boolean;
}
export class CreatedExclusionDto {
  @ApiProperty({ format: 'uuid', example: 'e1a2b3c4-5d6e-7f80-9a1b-2c3d4e5f6071' })
  id!: string;
}
export class MapResultDto {
  @ApiProperty({ example: 4, description: 'Number of warranties the exclusion was mapped onto.' })
  mapped!: number;
}

class ImpactDto {
  @ApiProperty({ format: 'uuid', example: '77b9c770-76f0-43c0-a42f-03f6e88adc16' })
  warrantyId!: string;
  @ApiProperty({ example: '16.2' })
  spaReference!: string;
  @ApiProperty({ enum: ['FULL', 'PARTIAL', 'CARVE_OUT'], example: 'CARVE_OUT', description: 'Coverage-effect of the exclusion on this warranty.' })
  type!: 'FULL' | 'PARTIAL' | 'CARVE_OUT';
  @ApiProperty({ example: 'Disclosure carve-out directly limits this tax warranty.' })
  rationale!: string;
  @ApiProperty({ example: 0.88 })
  confidence!: number;
}
export class ExclusionResponseDto {
  @ApiProperty({ format: 'uuid', example: 'e1a2b3c4-5d6e-7f80-9a1b-2c3d4e5f6071' })
  id!: string;
  @ApiProperty({ example: 'Known Issues' })
  label!: string;
  @ApiProperty({ example: 'Any liability arising from matters fairly disclosed in the data room.' })
  text!: string;
  @ApiProperty({ example: true })
  isStandard!: boolean;
  @ApiProperty({ example: 4, description: 'Number of warranties this exclusion affects — drives the clickable count badge.' })
  affectedCount!: number;
  @ApiProperty({ type: [String], format: 'uuid', description: 'IDs of the affected warranties, for expand-on-click.' })
  warrantyIds!: string[];
  @ApiProperty({
    type: String,
    nullable: true,
    example: '2026-01-01T12:00:00.000Z',
    description: 'When this exclusion was mapped, or null if never mapped. Drives the "N mapped" table badge.',
  })
  mappedAt!: string | null;
  @ApiProperty({ type: [ImpactDto] })
  impacts!: ImpactDto[];
}
