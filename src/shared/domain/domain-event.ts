import { IEvent } from '@nestjs/cqrs';

/** Domain events are recorded by aggregates and published after persistence. */
export interface DomainEvent extends IEvent {
  readonly occurredAt: Date;
  readonly aggregateId: string;
}
