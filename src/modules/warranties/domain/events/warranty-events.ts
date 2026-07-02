import { DomainEvent } from '@shared/domain/domain-event';
import { WarrantyCategory, CoveragePosition } from '@prisma/client';

export class WarrantyCategorisedEvent implements DomainEvent {
  readonly occurredAt = new Date();
  constructor(readonly aggregateId: string, readonly dealId: string, readonly category: WarrantyCategory, readonly confidence: number) {}
}

export class WarrantyCategoryOverriddenEvent implements DomainEvent {
  readonly occurredAt = new Date();
  constructor(
    readonly aggregateId: string,
    readonly dealId: string,
    readonly aiCategory: WarrantyCategory | null,
    readonly humanCategory: WarrantyCategory,
    readonly actorId: string,
  ) {}
}

export class WarrantyPositionDecidedEvent implements DomainEvent {
  readonly occurredAt = new Date();
  constructor(
    readonly aggregateId: string,
    readonly dealId: string,
    readonly aiPosition: CoveragePosition | null,
    readonly humanPosition: CoveragePosition,
    readonly actorId: string,
  ) {}
}
