import { ValueObject } from '@shared/domain/value-object';
import { Result } from '@shared/domain/result';
import { Guard } from '@shared/domain/guard';

interface P { value: number }
/** Per-row AI confidence (0..1). Below threshold ⇒ flagged for manual review. */
export class ConfidenceScore extends ValueObject<P> {
  static readonly REVIEW_THRESHOLD = 0.7;
  get value(): number { return this.props.value; }
  isLow(): boolean { return this.props.value < ConfidenceScore.REVIEW_THRESHOLD; }
  static create(value: number): Result<ConfidenceScore> {
    const err = Guard.inRange(value, 0, 1, 'Confidence score');
    if (err) return Result.fail(err);
    return Result.ok(new ConfidenceScore({ value }));
  }
}
