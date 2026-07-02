export class Guard {
  static againstEmpty(value: string, name: string): string | null {
    return !value || value.trim().length === 0 ? `${name} cannot be empty.` : null;
  }
  static inRange(value: number, min: number, max: number, name: string): string | null {
    return value < min || value > max ? `${name} must be between ${min} and ${max}.` : null;
  }
  static isOneOf<T>(value: T, allowed: readonly T[], name: string): string | null {
    return allowed.includes(value) ? null : `${name} must be one of: ${allowed.join(', ')}.`;
  }
}
