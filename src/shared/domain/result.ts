/** Explicit success/failure for the domain layer — business-rule violations are values. */
export class Result<T> {
  public readonly isSuccess: boolean;
  public readonly isFailure: boolean;
  public readonly error?: string;
  private readonly _value?: T;

  private constructor(isSuccess: boolean, error?: string, value?: T) {
    if (isSuccess && error) throw new Error('A successful result cannot contain an error.');
    if (!isSuccess && !error) throw new Error('A failing result needs an error message.');
    this.isSuccess = isSuccess;
    this.isFailure = !isSuccess;
    this.error = error;
    this._value = value;
    Object.freeze(this);
  }

  getValue(): T {
    if (!this.isSuccess || this._value === undefined) {
      throw new Error('Cannot get the value of a failed result.');
    }
    return this._value;
  }

  static ok<U>(value?: U): Result<U> {
    return new Result<U>(true, undefined, value);
  }
  static fail<U>(error: string): Result<U> {
    return new Result<U>(false, error);
  }
  static combine(results: Result<unknown>[]): Result<unknown> {
    for (const r of results) if (r.isFailure) return r;
    return Result.ok();
  }
}
