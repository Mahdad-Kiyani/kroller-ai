import { AggregateRoot } from '@shared/domain/aggregate-root';
import { UniqueEntityID } from '@shared/domain/unique-entity-id';
import { Result } from '@shared/domain/result';
import { Guard } from '@shared/domain/guard';

interface DealProps {
  externalRef: string; // id from the owning panel/portal
  name: string;
  governingLaw: string | null;
}

/** Lightweight grouping the AI operates within. The panel owns the full deal lifecycle. */
export class Deal extends AggregateRoot<DealProps> {
  private constructor(props: DealProps, id?: UniqueEntityID) {
    super(props, id);
  }

  static create(input: { externalRef: string; name: string; governingLaw?: string | null }): Result<Deal> {
    const refErr = Guard.againstEmpty(input.externalRef, 'External reference');
    if (refErr) return Result.fail(refErr);
    const nameErr = Guard.againstEmpty(input.name, 'Deal name');
    if (nameErr) return Result.fail(nameErr);
    return Result.ok(
      new Deal({
        externalRef: input.externalRef.trim(),
        name: input.name.trim(),
        governingLaw: input.governingLaw?.trim() ?? null,
      }),
    );
  }

  static reconstitute(id: string, props: DealProps): Deal {
    return new Deal(props, new UniqueEntityID(id));
  }

  get externalRef(): string {
    return this.props.externalRef;
  }
  get name(): string {
    return this.props.name;
  }
  get governingLaw(): string | null {
    return this.props.governingLaw;
  }
}
