import { SuggestionPolicy } from '@modules/suggestions/domain/suggestion-policy';
import { CoveragePosition } from '@prisma/client';

describe('SuggestionPolicy', () => {
  it('returns null when there is no decided precedent', () => {
    expect(SuggestionPolicy.fromNeighbours([])).toBeNull();
    expect(
      SuggestionPolicy.fromNeighbours([{ decidedPosition: null, decidedComment: null, distance: 0.1 }]),
    ).toBeNull();
  });

  it('picks the similarity-weighted majority position', () => {
    const s = SuggestionPolicy.fromNeighbours([
      { decidedPosition: 'COVERED', decidedComment: 'c1', distance: 0.05 },
      { decidedPosition: 'COVERED', decidedComment: 'c2', distance: 0.2 },
      { decidedPosition: 'EXCLUDED', decidedComment: 'c3', distance: 0.9 },
    ]);
    expect(s?.position).toBe(CoveragePosition.COVERED);
    expect(s?.comment).toContain('2/3');
    expect(s?.score).toBeGreaterThan(0);
    expect(s?.score).toBeLessThanOrEqual(1);
  });

  it('lets a very close minority outweigh distant majority', () => {
    const s = SuggestionPolicy.fromNeighbours([
      { decidedPosition: 'EXCLUDED', decidedComment: 'near', distance: 0.01 },
      { decidedPosition: 'COVERED', decidedComment: 'far', distance: 5 },
      { decidedPosition: 'COVERED', decidedComment: 'far', distance: 5 },
    ]);
    expect(s?.position).toBe(CoveragePosition.EXCLUDED);
  });
});
