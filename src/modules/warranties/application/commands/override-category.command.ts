import { WarrantyCategory } from '@prisma/client';
export class OverrideCategoryCommand {
  constructor(readonly warrantyId: string, readonly category: WarrantyCategory, readonly actorId: string) {}
}
