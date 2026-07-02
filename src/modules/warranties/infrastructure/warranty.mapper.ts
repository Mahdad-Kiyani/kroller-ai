import { Warranty as Rec } from '@prisma/client';
import { Warranty } from '../domain/warranty.aggregate';
import { Category } from '../domain/value-objects/warranty-category.vo';
import { ConfidenceScore } from '../domain/value-objects/confidence-score.vo';
import { Position } from '../domain/value-objects/coverage-position.vo';

export class WarrantyMapper {
  static toDomain(r: Rec): Warranty {
    return Warranty.reconstitute(r.id, {
      dealId: r.dealId,
      spaReference: r.spaReference,
      title: r.title,
      fullText: r.fullText,
      aiCategory: r.aiCategory ? Category.of(r.aiCategory) : null,
      aiConfidence: r.aiConfidence !== null ? ConfidenceScore.create(r.aiConfidence).getValue() : null,
      pageRef: r.pageRef,
      category: r.category ? Category.of(r.category) : null,
      overriddenBy: r.overriddenBy,
      aiPosition: r.aiPosition ? Position.of(r.aiPosition) : null,
      aiComment: r.aiComment,
      aiPositionScore: r.aiPositionScore,
      decidedPosition: r.decidedPosition ? Position.of(r.decidedPosition) : null,
      decidedComment: r.decidedComment,
      decidedBy: r.decidedBy,
    });
  }

  /** Fields safe for create/update via Prisma (embedding/searchVector handled by raw SQL). */
  static toCreate(w: Warranty) {
    return {
      id: w.id.toString(),
      dealId: w.dealId,
      spaReference: w.spaReference,
      title: w.title,
      fullText: w.fullText,
      aiCategory: w.aiCategory,
      aiConfidence: w.aiConfidence,
      pageRef: w.pageRef,
      category: w.category,
    };
  }

  static toUpdate(w: Warranty) {
    return {
      category: w.category,
      overriddenBy: w.overriddenBy,
      overriddenAt: w.overriddenBy ? new Date() : null,
      aiPosition: w.aiPosition,
      aiComment: w.aiComment,
      aiPositionScore: w.aiPositionScore,
      decidedPosition: w.decidedPosition,
      decidedComment: w.decidedComment,
      decidedBy: w.decidedBy,
      decidedAt: w.decidedBy ? new Date() : null,
    };
  }
}
