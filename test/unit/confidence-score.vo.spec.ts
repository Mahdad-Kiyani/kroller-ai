import { ConfidenceScore } from '@modules/warranties/domain/value-objects/confidence-score.vo';

describe('ConfidenceScore', () => {
  it('accepts values within 0..1', () => {
    expect(ConfidenceScore.create(0.5).isSuccess).toBe(true);
  });
  it('rejects out-of-range values', () => {
    expect(ConfidenceScore.create(1.4).isFailure).toBe(true);
    expect(ConfidenceScore.create(-0.1).isFailure).toBe(true);
  });
  it('flags low confidence below the review threshold', () => {
    expect(ConfidenceScore.create(0.6).getValue().isLow()).toBe(true);
    expect(ConfidenceScore.create(0.7).getValue().isLow()).toBe(false);
    expect(ConfidenceScore.create(0.95).getValue().isLow()).toBe(false);
  });
});
