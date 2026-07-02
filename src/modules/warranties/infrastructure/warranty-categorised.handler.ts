import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { WarrantyCategorisedEvent } from '../domain/events/warranty-events';

/** On categorisation, enqueue embedding so the warranty becomes retrievable precedent. */
@EventsHandler(WarrantyCategorisedEvent)
export class WarrantyCategorisedHandler implements IEventHandler<WarrantyCategorisedEvent> {
  private readonly logger = new Logger(WarrantyCategorisedHandler.name);

  constructor(@InjectQueue('warranty-embed') private readonly queue: Queue) {}

  async handle(event: WarrantyCategorisedEvent): Promise<void> {
    this.logger.log(`WarrantyCategorised event: warrantyId=${event.aggregateId} → queuing embed job`);
    await this.queue.add('embed', { warrantyId: event.aggregateId });
  }
}
