export class CreateDealCommand {
  constructor(
    readonly externalRef: string,
    readonly name: string,
    readonly governingLaw?: string,
  ) {}
}
