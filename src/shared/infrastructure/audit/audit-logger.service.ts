import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  actorId?: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}

/** Writes the immutable AI-vs-human trail. The load-bearing piece of the learning loop. */
@Injectable()
export class AuditLogger {
  constructor(private readonly prisma: PrismaService) {}
  async record(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        beforeJson: (entry.before ?? null) as object,
        afterJson: (entry.after ?? null) as object,
      },
    });
  }
}
