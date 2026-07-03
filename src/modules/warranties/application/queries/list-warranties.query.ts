export class ListWarrantiesByDealQuery {
  constructor(readonly dealId: string, readonly page?: number, readonly pageSize?: number) {}
}
export class GetWarrantyQuery {
  constructor(readonly id: string) {}
}
