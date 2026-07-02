import { CoveragePosition } from '@prisma/client';
import { Result } from '@shared/domain/result';

/** Insurer coverage stance on a warranty. */
export class Position {
  private constructor(public readonly value: CoveragePosition) {}
  static fromString(raw: string): Result<Position> {
    const n = raw.trim().toUpperCase();
    if (!(n in CoveragePosition)) {
      return Result.fail(`Unknown position "${raw}". Allowed: ${Object.keys(CoveragePosition).join(', ')}.`);
    }
    return Result.ok(new Position(CoveragePosition[n as keyof typeof CoveragePosition]));
  }
  static of(v: CoveragePosition): Position { return new Position(v); }
}
