export class GetSimilarWarrantiesQuery {
  constructor(readonly warrantyId: string, readonly limit = 5) {}
}
