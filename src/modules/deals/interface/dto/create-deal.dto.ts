import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateDealDto {
  @ApiProperty({ example: 'PANEL-2026-0042', description: 'Reference id from the panel/portal.' })
  @IsString() @MinLength(1)
  externalRef!: string;

  @ApiProperty({ example: 'Project Fujitsu' })
  @IsString() @MinLength(1)
  name!: string;

  @ApiProperty({ example: 'Netherlands', required: false })
  @IsOptional() @IsString()
  governingLaw?: string;
}

export class DealResponseDto {
  @ApiProperty({ format: 'uuid', example: '6be65189-d80f-48c0-9f91-c7823d9cf449' })
  id!: string;
  @ApiProperty({ example: 'PANEL-2026-0042' })
  externalRef!: string;
  @ApiProperty({ example: 'Project Fujitsu' })
  name!: string;
  @ApiProperty({ example: 'Netherlands', nullable: true })
  governingLaw!: string | null;
  @ApiProperty({ example: '2026-06-28T13:54:10.290Z' })
  createdAt!: Date;
}

export class CreatedDealDto {
  @ApiProperty({ format: 'uuid', example: '6be65189-d80f-48c0-9f91-c7823d9cf449' })
  id!: string;
}
