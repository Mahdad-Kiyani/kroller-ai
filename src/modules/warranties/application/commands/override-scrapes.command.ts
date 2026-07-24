import { ScrapeStatus } from '@prisma/client';
export class OverrideScrapesCommand {
  constructor(
    readonly warrantyId: string,
    readonly knowledgeScrape: ScrapeStatus,
    readonly materialityScrape: ScrapeStatus,
    readonly actorId: string,
  ) {}
}
