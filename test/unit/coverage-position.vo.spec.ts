import { Position } from '@modules/warranties/domain/value-objects/coverage-position.vo';
import { CoveragePosition } from '@prisma/client';

describe('Position', () => {
  it('parses valid positions case-insensitively', () => {
    expect(Position.fromString('covered').getValue().value).toBe(CoveragePosition.COVERED);
    expect(Position.fromString('EXCLUDED').getValue().value).toBe(CoveragePosition.EXCLUDED);
  });
  it('rejects invalid positions', () => {
    expect(Position.fromString('maybe').isFailure).toBe(true);
  });
});
