import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { DealsController } from "./interface/deals.controller";
import { DEAL_REPOSITORY } from "./domain/deal.repository";
import { PrismaDealRepository } from "./infrastructure/prisma-deal.repository";
import { CreateDealHandler } from "./application/commands/create-deal.handler";
import {
  GetDealHandler,
  ListDealsHandler,
} from "./application/queries/get-deal.handler";

@Module({
  imports: [CqrsModule],
  controllers: [DealsController],
  providers: [
    { provide: DEAL_REPOSITORY, useClass: PrismaDealRepository },
    CreateDealHandler,
    GetDealHandler,
    ListDealsHandler,
  ],
  exports: [DEAL_REPOSITORY],
})
export class DealsModule {}
