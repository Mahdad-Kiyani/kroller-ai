export class ListWarrantiesByDealQuery {
  constructor(readonly dealId: string, readonly page?: number, readonly pageSize?: number) {}
}
export class GetWarrantyQuery {
  constructor(readonly id: string) {}
}
export class GetOneEyeViewQuery {
  constructor(readonly dealId: string) {}
}
