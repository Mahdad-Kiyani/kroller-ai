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
  @ApiProperty({ type: [ImpactDto] })
  impacts!: ImpactDto[];
}
