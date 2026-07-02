import { CoveragePosition } from '@prisma/client';
export class DecidePositionCommand {
  constructor(
    readonly warrantyId: string,
    readonly position: CoveragePosition,
    readonly comment: string | null,
    readonly actorId: string,
  ) {}
}
