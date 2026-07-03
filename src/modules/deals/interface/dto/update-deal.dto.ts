import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export class UpdateDealDto {
  @ApiProperty({ example: 'Project Fujitsu', required: false })
  @IsOptional() @IsString() @MinLength(1)
  name?: string;

  @ApiProperty({ example: 'Netherlands', required: false, nullable: true })
  @IsOptional() @ValidateIf((o) => o.governingLaw !== null) @IsString()
  governingLaw?: string | null;
}
