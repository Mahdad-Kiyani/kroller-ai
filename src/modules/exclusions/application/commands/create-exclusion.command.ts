export class CreateExclusionCommand {
  constructor(
    readonly dealId: string,
    readonly label: string,
    readonly text: string,
    readonly isStandard: boolean,
  ) {}
}
