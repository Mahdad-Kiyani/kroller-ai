import { Result } from '@shared/domain/result';

describe('Result', () => {
  it('carries a value on success', () => {
    const r = Result.ok<number>(42);
    expect(r.isSuccess).toBe(true);
    expect(r.getValue()).toBe(42);
  });
  it('throws when reading the value of a failure', () => {
    const r = Result.fail<number>('nope');
    expect(r.isFailure).toBe(true);
    expect(() => r.getValue()).toThrow();
  });
  it('combine returns the first failure', () => {
    const combined = Result.combine([Result.ok(), Result.fail('bad'), Result.ok()]);
    expect(combined.isFailure).toBe(true);
    expect(combined.error).toBe('bad');
  });
});
