import { AggregateRoot as NestAggregateRoot } from '@nestjs/cqrs';
import { UniqueEntityID } from './unique-entity-id';
import { DomainEvent } from './domain-event';

/** Consistency boundary. Extends Nest's CQRS aggregate so events publish on commit(). */
export abstract class AggregateRoot<TProps> extends NestAggregateRoot {
  protected readonly _id: UniqueEntityID;
  protected props: TProps;

  protected constructor(props: TProps, id?: UniqueEntityID) {
    super();
    this._id = id ?? new UniqueEntityID();
    this.props = props;
  }
  get id(): UniqueEntityID {
    return this._id;
  }
  protected addDomainEvent(event: DomainEvent): void {
    this.apply(event);
  }
  equals(other?: AggregateRoot<TProps>): boolean {
    return other instanceof AggregateRoot && this._id.equals(other._id);
  }
}
