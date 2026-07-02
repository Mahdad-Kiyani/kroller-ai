import { AggregateRoot } from '@shared/domain/aggregate-root';
import { UniqueEntityID } from '@shared/domain/unique-entity-id';
import { Result } from '@shared/domain/result';
import { Guard } from '@shared/domain/guard';
import { WarrantyCategory, CoveragePosition } from '@prisma/client';
import { Category } from './value-objects/warranty-category.vo';
import { ConfidenceScore } from './value-objects/confidence-score.vo';
import { Position } from './value-objects/coverage-position.vo';
import {
  WarrantyCategorisedEvent,
  WarrantyCategoryOverriddenEvent,
  WarrantyPositionDecidedEvent,
} from './events/warranty-events';

export interface WarrantyProps {
  dealId: string;
  spaReference: string;
  title: string;
  fullText: string;
  // AI categorisation (immutable suggestion)
  aiCategory: Category | null;
  aiConfidence: ConfidenceScore | null;
  pageRef: number | null;
  // effective category (after optional override)
  category: Category | null;
  overriddenBy: string | null;
  // AI position suggestion + human decision
  aiPosition: Position | null;
  aiComment: string | null;
  aiPositionScore: number | null;
  decidedPosition: Position | null;
  decidedComment: string | null;
  decidedBy: string | null;
}

/**
 * Core invariant: AI outputs (aiCategory/aiConfidence, aiPosition/aiComment) are never
 * mutated by humans. Overrides and decisions are stored separately, so the AI suggestion
 * and the human decision are always distinguishable for the audit trail / learning loop.
 */
export class Warranty extends AggregateRoot<WarrantyProps> {
  private constructor(props: WarrantyProps, id?: UniqueEntityID) {
    super(props, id);
  }

  static fromParsedRow(input: {
    dealId: string;
    spaReference: string;
    title: string;
    fullText: string;
    aiCategory: Category;
    aiConfidence: ConfidenceScore;
    pageRef?: number | null;
  }): Result<Warranty> {
    const refErr = Guard.againstEmpty(input.spaReference, 'SPA reference');
    if (refErr) return Result.fail(refErr);
    const textErr = Guard.againstEmpty(input.fullText, 'Warranty text');
    if (textErr) return Result.fail(textErr);

    const w = new Warranty({
      dealId: input.dealId,
      spaReference: input.spaReference.trim(),
      title: input.title.trim(),
      fullText: input.fullText.trim(),
      aiCategory: input.aiCategory,
      aiConfidence: input.aiConfidence,
      pageRef: input.pageRef ?? null,
      category: input.aiCategory,
      overriddenBy: null,
      aiPosition: null,
      aiComment: null,
      aiPositionScore: null,
      decidedPosition: null,
      decidedComment: null,
      decidedBy: null,
    });
    w.addDomainEvent(
      new WarrantyCategorisedEvent(w.id.toString(), input.dealId, input.aiCategory.value, input.aiConfidence.value),
    );
    return Result.ok(w);
  }

  static reconstitute(id: string, props: WarrantyProps): Warranty {
    return new Warranty(props, new UniqueEntityID(id));
  }

  /** Human override of the AI category. AI suggestion preserved. */
  overrideCategory(target: WarrantyCategory, actorId: string): Result<void> {
    const next = Category.of(target);
    if (this.props.category && this.props.category.equals(next)) {
      return Result.fail('Category is already set to that value.');
    }
    this.props.category = next;
    this.props.overriddenBy = actorId;
    this.addDomainEvent(
      new WarrantyCategoryOverriddenEvent(this.id.toString(), this.props.dealId, this.props.aiCategory?.value ?? null, target, actorId),
    );
    return Result.ok();
  }

  /** Attach the retrieval-derived AI position suggestion. No human involved yet. */
  applySuggestedPosition(position: CoveragePosition, comment: string, score: number): void {
    this.props.aiPosition = Position.of(position);
    this.props.aiComment = comment;
    this.props.aiPositionScore = score;
  }

  /** Human decides the coverage position — the training signal for the learning loop. */
  decidePosition(position: CoveragePosition, comment: string | null, actorId: string): Result<void> {
    this.props.decidedPosition = Position.of(position);
    this.props.decidedComment = comment;
    this.props.decidedBy = actorId;
    this.addDomainEvent(
      new WarrantyPositionDecidedEvent(this.id.toString(), this.props.dealId, this.props.aiPosition?.value ?? null, position, actorId),
    );
    return Result.ok();
  }

  needsReview(): boolean {
    return this.props.aiConfidence?.isLow() ?? true;
  }

  // accessors
  get dealId(): string { return this.props.dealId; }
  get spaReference(): string { return this.props.spaReference; }
  get title(): string { return this.props.title; }
  get fullText(): string { return this.props.fullText; }
  get aiCategory(): WarrantyCategory | null { return this.props.aiCategory?.value ?? null; }
  get aiConfidence(): number | null { return this.props.aiConfidence?.value ?? null; }
  get pageRef(): number | null { return this.props.pageRef; }
  get category(): WarrantyCategory | null { return this.props.category?.value ?? null; }
  get overriddenBy(): string | null { return this.props.overriddenBy; }
  get aiPosition(): CoveragePosition | null { return this.props.aiPosition?.value ?? null; }
  get aiComment(): string | null { return this.props.aiComment; }
  get aiPositionScore(): number | null { return this.props.aiPositionScore; }
  get decidedPosition(): CoveragePosition | null { return this.props.decidedPosition?.value ?? null; }
  get decidedComment(): string | null { return this.props.decidedComment; }
  get decidedBy(): string | null { return this.props.decidedBy; }
}
