import { AggregateRoot } from '@shared/domain/aggregate-root';
import { UniqueEntityID } from '@shared/domain/unique-entity-id';
import { Result } from '@shared/domain/result';
import { Guard } from '@shared/domain/guard';
import { WarrantyCategory, CoveragePosition, ScrapeStatus } from '@prisma/client';
import { Category } from './value-objects/warranty-category.vo';
import { ConfidenceScore } from './value-objects/confidence-score.vo';
import { Position } from './value-objects/coverage-position.vo';
import {
  WarrantyCategorisedEvent,
  WarrantyCategoryOverriddenEvent,
  WarrantyPositionDecidedEvent,
  WarrantyScrapesOverriddenEvent,
} from './events/warranty-events';

export interface WarrantyProps {
  dealId: string;
  documentId: string | null;
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
  // AI scrape detection (immutable suggestion) — tri-state: NO / PARTIAL / YES
  aiKnowledgeScrape: ScrapeStatus;
  aiMaterialityScrape: ScrapeStatus;
  aiKnowledgeScrapeText: string | null;
  aiMaterialityScrapeText: string | null;
  // effective scrape status (after optional override)
  knowledgeScrape: ScrapeStatus;
  materialityScrape: ScrapeStatus;
  scrapesOverriddenBy: string | null;
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
    documentId?: string | null;
    spaReference: string;
    title: string;
    fullText: string;
    aiCategory: Category;
    aiConfidence: ConfidenceScore;
    pageRef?: number | null;
    aiKnowledgeScrape?: ScrapeStatus;
    aiMaterialityScrape?: ScrapeStatus;
    aiKnowledgeScrapeText?: string | null;
    aiMaterialityScrapeText?: string | null;
  }): Result<Warranty> {
    const refErr = Guard.againstEmpty(input.spaReference, 'SPA reference');
    if (refErr) return Result.fail(refErr);
    const textErr = Guard.againstEmpty(input.fullText, 'Warranty text');
    if (textErr) return Result.fail(textErr);

    const w = new Warranty({
      dealId: input.dealId,
      documentId: input.documentId ?? null,
      spaReference: input.spaReference.trim(),
      title: input.title.trim(),
      fullText: input.fullText.trim(),
      aiCategory: input.aiCategory,
      aiConfidence: input.aiConfidence,
      pageRef: input.pageRef ?? null,
      category: input.aiCategory,
      overriddenBy: null,
      aiKnowledgeScrape: input.aiKnowledgeScrape ?? ScrapeStatus.NO,
      aiMaterialityScrape: input.aiMaterialityScrape ?? ScrapeStatus.NO,
      aiKnowledgeScrapeText: input.aiKnowledgeScrapeText ?? null,
      aiMaterialityScrapeText: input.aiMaterialityScrapeText ?? null,
      knowledgeScrape: input.aiKnowledgeScrape ?? ScrapeStatus.NO,
      materialityScrape: input.aiMaterialityScrape ?? ScrapeStatus.NO,
      scrapesOverriddenBy: null,
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

  /**
   * Human override of the AI scrape detection. AI detection preserved on ai* props.
   * Each qualifier type can be independently set to NO / PARTIAL / YES.
   */
  overrideScrapes(
    target: { knowledgeScrape: ScrapeStatus; materialityScrape: ScrapeStatus },
    actorId: string,
  ): Result<void> {
    if (
      this.props.knowledgeScrape === target.knowledgeScrape &&
      this.props.materialityScrape === target.materialityScrape
    ) {
      return Result.fail('Scrape status is already set to those values.');
    }
    this.props.knowledgeScrape = target.knowledgeScrape;
    this.props.materialityScrape = target.materialityScrape;
    this.props.scrapesOverriddenBy = actorId;
    this.addDomainEvent(
      new WarrantyScrapesOverriddenEvent(
        this.id.toString(),
        this.props.dealId,
        this.props.aiKnowledgeScrape,
        this.props.aiMaterialityScrape,
        target.knowledgeScrape,
        target.materialityScrape,
        actorId,
      ),
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
  get documentId(): string | null { return this.props.documentId; }
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
  // scrape accessors — AI detection is immutable; effective status reflects any human override
  get aiKnowledgeScrape(): ScrapeStatus { return this.props.aiKnowledgeScrape; }
  get aiMaterialityScrape(): ScrapeStatus { return this.props.aiMaterialityScrape; }
  get aiKnowledgeScrapeText(): string | null { return this.props.aiKnowledgeScrapeText; }
  get aiMaterialityScrapeText(): string | null { return this.props.aiMaterialityScrapeText; }
  get knowledgeScrape(): ScrapeStatus { return this.props.knowledgeScrape; }
  get materialityScrape(): ScrapeStatus { return this.props.materialityScrape; }
  get scrapesOverriddenBy(): string | null { return this.props.scrapesOverriddenBy; }
}
