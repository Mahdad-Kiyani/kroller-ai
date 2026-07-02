import { AggregateRoot } from '@shared/domain/aggregate-root';
import { UniqueEntityID } from '@shared/domain/unique-entity-id';
import { Result } from '@shared/domain/result';
import { Guard } from '@shared/domain/guard';

interface ExclusionProps {
  dealId: string;
  label: string;
  text: string;
  isStandard: boolean;
}

/** A policy exclusion whose impact on warranties the AI maps. */
export class Exclusion extends AggregateRoot<ExclusionProps> {
  private constructor(props: ExclusionProps, id?: UniqueEntityID) {
    super(props, id);
  }

  static create(input: { dealId: string; label: string; text: string; isStandard?: boolean }): Result<Exclusion> {
    const labelErr = Guard.againstEmpty(input.label, 'Exclusion label');
    if (labelErr) return Result.fail(labelErr);
    const textErr = Guard.againstEmpty(input.text, 'Exclusion text');
    if (textErr) return Result.fail(textErr);
    return Result.ok(
      new Exclusion({
        dealId: input.dealId,
        label: input.label.trim(),
        text: input.text.trim(),
        isStandard: input.isStandard ?? true,
      }),
    );
  }

  static reconstitute(id: string, props: ExclusionProps): Exclusion {
    return new Exclusion(props, new UniqueEntityID(id));
  }

  get dealId(): string { return this.props.dealId; }
  get label(): string { return this.props.label; }
  get text(): string { return this.props.text; }
  get isStandard(): boolean { return this.props.isStandard; }
}
