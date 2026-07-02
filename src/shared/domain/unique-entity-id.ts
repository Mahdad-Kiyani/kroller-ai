import { v4 as uuidv4 } from 'uuid';

export class UniqueEntityID {
  private readonly value: string;
  constructor(id?: string) {
    this.value = id ?? uuidv4();
  }
  toString(): string {
    return this.value;
  }
  equals(other?: UniqueEntityID): boolean {
    return !!other && other.value === this.value;
  }
}
