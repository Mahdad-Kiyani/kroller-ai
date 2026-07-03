export class UpdateDealCommand {
  constructor(
    readonly dealId: string,
    readonly name?: string,
    readonly governingLaw?: string | null,
  ) {}
}
