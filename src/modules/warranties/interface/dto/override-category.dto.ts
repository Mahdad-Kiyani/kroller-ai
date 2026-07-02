import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { WarrantyCategory } from '@prisma/client';

export class OverrideCategoryDto {
  @ApiProperty({ enum: WarrantyCategory, example: WarrantyCategory.TAX, description: 'New effective category.' })
  @IsEnum(WarrantyCategory)
  category!: WarrantyCategory;
}
export class CategoryResultDto {
  @ApiProperty({ enum: WarrantyCategory, example: WarrantyCategory.TAX })
  category!: WarrantyCategory;
}
