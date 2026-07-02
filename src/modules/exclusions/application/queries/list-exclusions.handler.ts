import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ListExclusionsByDealQuery } from './list-exclusions.query';
import { ExclusionRepository, EXCLUSION_REPOSITORY, ExclusionWithImpacts } from '../../domain/exclusion.repository';

@QueryHandler(ListExclusionsByDealQuery)
export class ListExclusionsByDealHandler implements IQueryHandler<ListExclusionsByDealQuery> {
  constructor(@Inject(EXCLUSION_REPOSITORY) private readonly repo: ExclusionRepository) {}
  execute(q: ListExclusionsByDealQuery): Promise<ExclusionWithImpacts[]> {
    return this.repo.listByDeal(q.dealId);
  }
}
