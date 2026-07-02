import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import configuration, { AppConfig } from '@shared/infrastructure/config/configuration';
import { PrismaModule } from '@shared/infrastructure/prisma/prisma.module';
import { AuditModule } from '@shared/infrastructure/audit/audit.module';
import { StorageModule } from '@shared/infrastructure/storage/storage.module';
import { AiModule } from '@shared/infrastructure/ai/ai.module';
import { EmbeddingsModule } from '@shared/infrastructure/embeddings/embeddings.module';
import { HealthController } from '@shared/interface/health.controller';
import { AuthModule } from '@modules/auth/auth.module';
import { DealsModule } from '@modules/deals/deals.module';
import { WarrantiesModule } from '@modules/warranties/warranties.module';
import { ExclusionsModule } from '@modules/exclusions/exclusions.module';
import { SuggestionsModule } from '@modules/suggestions/suggestions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        connection: config.get('redis', { infer: true }),
      }),
    }),
    PrismaModule,
    AuditModule,
    StorageModule,
    AiModule,
    EmbeddingsModule,
    AuthModule,
    DealsModule,
    WarrantiesModule,
    ExclusionsModule,
    SuggestionsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
