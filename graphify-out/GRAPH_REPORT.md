# Graph Report - backend  (2026-07-07)

## Corpus Check
- 148 files · ~29,016 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 769 nodes · 1585 edges · 40 communities (29 shown, 11 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.65)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `07e5c202`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_fakes.ts|fakes.ts]]
- [[_COMMUNITY_app.module.ts|app.module.ts]]
- [[_COMMUNITY_Deal|Deal]]
- [[_COMMUNITY_warranties.controller.ts|warranties.controller.ts]]
- [[_COMMUNITY_PrismaService|PrismaService]]
- [[_COMMUNITY_Warranty|Warranty]]
- [[_COMMUNITY_warranties.module.ts|warranties.module.ts]]
- [[_COMMUNITY_CLAUDE|CLAUDE.md]]
- [[_COMMUNITY_NestJS + DDD — wi-ai-service|NestJS + DDD — wi-ai-service]]
- [[_COMMUNITY_deals.controller.ts|deals.controller.ts]]
- [[_COMMUNITY_dependencies|dependencies]]
- [[_COMMUNITY_warranty.aggregate.ts|warranty.aggregate.ts]]
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_Result|Result]]
- [[_COMMUNITY_list-warranties.handler.ts|list-warranties.handler.ts]]
- [[_COMMUNITY_StoragePort|StoragePort]]
- [[_COMMUNITY_devDependencies|devDependencies]]
- [[_COMMUNITY_scripts|scripts]]
- [[_COMMUNITY_ClaudeWarrantyParser|ClaudeWarrantyParser]]
- [[_COMMUNITY_claude-warranty-parser.adapter.ts|claude-warranty-parser.adapter.ts]]
- [[_COMMUNITY_warranty-events.ts|warranty-events.ts]]
- [[_COMMUNITY_Prisma — wi-ai-service|Prisma — wi-ai-service]]
- [[_COMMUNITY_W&I AI Service|W&I AI Service]]
- [[_COMMUNITY_run-wi-ai-service|run-wi-ai-service]]
- [[_COMMUNITY_main.ts|main.ts]]
- [[_COMMUNITY_ClaudeClient|ClaudeClient]]
- [[_COMMUNITY_MinioStorageAdapter|MinioStorageAdapter]]
- [[_COMMUNITY_nest-cli.json|nest-cli.json]]
- [[_COMMUNITY_FakeVectorStore|FakeVectorStore]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_auth.module.ts|auth.module.ts]]
- [[_COMMUNITY_FakeStoragePort|FakeStoragePort]]
- [[_COMMUNITY_Guard|Guard]]
- [[_COMMUNITY_ValueObject|ValueObject]]
- [[_COMMUNITY_SocksProxyAgent|SocksProxyAgent]]
- [[_COMMUNITY_tsconfig.build.json|tsconfig.build.json]]
- [[_COMMUNITY_entrypoint.sh|entrypoint.sh]]
- [[_COMMUNITY_jest.config.js|jest.config.js]]

## God Nodes (most connected - your core abstractions)
1. `PrismaService` - 52 edges
2. `Warranty` - 51 edges
3. `Deal` - 28 edges
4. `Result` - 22 edges
5. `AuditLogger` - 21 edges
6. `Exclusion` - 20 edges
7. `compilerOptions` - 20 edges
8. `WarrantyRepository` - 17 edges
9. `StoragePort` - 17 edges
10. `VectorStore` - 16 edges

## Surprising Connections (you probably didn't know these)
- `FakeWarrantyParser` --implements--> `WarrantyParserPort`  [EXTRACTED]
  test/support/fakes.ts → src/modules/warranties/application/ports/warranty-parser.port.ts
- `InMemoryWarrantyRepository` --implements--> `WarrantyRepository`  [EXTRACTED]
  test/support/in-memory-warranty.repository.ts → src/modules/warranties/domain/warranty.repository.ts
- `FakeEmbeddingPort` --implements--> `EmbeddingPort`  [EXTRACTED]
  test/support/fakes.ts → src/shared/infrastructure/embeddings/embedding.port.ts
- `FakeStoragePort` --implements--> `StoragePort`  [EXTRACTED]
  test/support/fakes.ts → src/shared/infrastructure/storage/storage.port.ts
- `InMemoryDealRepository` --implements--> `DealRepository`  [EXTRACTED]
  test/support/in-memory-deal.repository.ts → src/modules/deals/domain/deal.repository.ts

## Import Cycles
- None detected.

## Communities (40 total, 11 thin omitted)

### Community 0 - "fakes.ts"
Cohesion: 0.06
Nodes (24): CreateExclusionCommand, CreateExclusionHandler, EXCLUSION_MAPPER, ExclusionMapperPort, MappableWarranty, MappedImpact, ListExclusionsByDealHandler, ListExclusionsByDealQuery (+16 more)

### Community 1 - "app.module.ts"
Cohesion: 0.06
Nodes (24): ExclusionsModule, GenerateSuggestionsCommand, GenerateSuggestionsHandler, CacheEntry, GetSimilarWarrantiesHandler, SimilarWarrantyDto, GetSimilarWarrantiesQuery, NeighbourDecision (+16 more)

### Community 2 - "Deal"
Cohesion: 0.07
Nodes (14): CreateDealCommand, CreateDealHandler, UpdateDealCommand, UpdateDealHandler, DealsModule, Deal, DealProps, DEAL_REPOSITORY (+6 more)

### Community 3 - "warranties.controller.ts"
Cohesion: 0.08
Nodes (19): DocumentReadModel, GetDocumentHandler, ListDocumentsByDealHandler, TERMINAL_STATUSES, toReadModel(), GetDocumentQuery, ListDocumentsByDealQuery, DecidePositionDto (+11 more)

### Community 4 - "PrismaService"
Cohesion: 0.11
Nodes (13): Public(), DeleteDealCommand, DeleteDealHandler, DeleteDealResult, MapExclusionImpactCommand, MapExclusionImpactHandler, DeleteDocumentCommand, DeleteDocumentHandler (+5 more)

### Community 5 - "Warranty"
Cohesion: 0.07
Nodes (4): Warranty, PrismaWarrantyRepository, WarrantyMapper, InMemoryWarrantyRepository

### Community 6 - "warranties.module.ts"
Cohesion: 0.10
Nodes (16): DecidePositionCommand, DecidePositionHandler, IngestParsedWarrantiesCommand, IngestParsedWarrantiesHandler, OverrideCategoryCommand, OverrideCategoryHandler, WARRANTY_PARSER, WarrantyParserPort (+8 more)

### Community 7 - "CLAUDE.md"
Cohesion: 0.06
Nodes (29): API surface (all prefixed `/api/v1`), Architecture, Commands, Gotchas, Infrastructure dependencies, Key design decisions, Modules, Schema notes (+21 more)

### Community 8 - "NestJS + DDD — wi-ai-service"
Cohesion: 0.06
Nodes (31): `AggregateRoot<TProps>`, Application layer, Application port (outbound), Auth, BullMQ processor (queue consumer), Claude adapter (application port implementation), Command, Command handler (+23 more)

### Community 9 - "deals.controller.ts"
Cohesion: 0.12
Nodes (11): DealReadModel, GetDealHandler, ListDealsHandler, GetDealQuery, ListDealsQuery, DealsController, CreatedDealDto, CreateDealDto (+3 more)

### Community 10 - "dependencies"
Cohesion: 0.07
Nodes (27): dependencies, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, axios, bullmq, class-transformer, class-validator, ioredis (+19 more)

### Community 11 - "warranty.aggregate.ts"
Cohesion: 0.19
Nodes (7): ConfidenceScore, P, Position, Category, WarrantyProps, PRECEDENT, FakeEmbeddingPort

### Community 12 - "compilerOptions"
Cohesion: 0.08
Nodes (23): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, forceConsistentCasingInFileNames (+15 more)

### Community 13 - "Result"
Cohesion: 0.22
Nodes (3): Result, seedWarranty(), makeWarranty()

### Community 14 - "list-warranties.handler.ts"
Cohesion: 0.17
Nodes (8): GetWarrantyHandler, ListWarrantiesByDealHandler, toReadModel(), GetWarrantyQuery, ListWarrantiesByDealQuery, PaginatedResult, WarrantyReadModel, NOW

### Community 15 - "StoragePort"
Cohesion: 0.18
Nodes (5): UploadDocumentCommand, UploadDocumentHandler, StorageModule, STORAGE_PORT, StoragePort

### Community 16 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, jest, @nestjs/cli, @nestjs/testing, supertest, ts-jest, ts-loader, @types/express (+8 more)

### Community 17 - "scripts"
Cohesion: 0.13
Nodes (15): scripts, build, db:push, lint, prisma:deploy, prisma:generate, prisma:migrate, start (+7 more)

### Community 18 - "ClaudeWarrantyParser"
Cohesion: 0.22
Nodes (3): ParsedWarrantyRow, ClaudeWarrantyParser, FakeWarrantyParser

### Community 19 - "claude-warranty-parser.adapter.ts"
Cohesion: 0.31
Nodes (5): DocumentTextExtractor, AppConfig, Ai, configWith(), makeParser()

### Community 20 - "warranty-events.ts"
Cohesion: 0.23
Nodes (5): WarrantyCategorisedEvent, WarrantyCategoryOverriddenEvent, WarrantyPositionDecidedEvent, WarrantyCategorisedHandler, DomainEvent

### Community 21 - "Prisma — wi-ai-service"
Cohesion: 0.18
Nodes (10): Adding a new field, Common errors, Configuration files, Gotchas, Migration workflow, prisma.config.ts — CLI connection, Prisma — wi-ai-service, PrismaService — runtime adapter (+2 more)

### Community 22 - "W&I AI Service"
Cohesion: 0.18
Nodes (10): API at a glance, Architecture, Locally (Node 22), Production hardening (documented TODOs), Running it, Tests, The learning loop, W&I AI Service (+2 more)

### Community 23 - "run-wi-ai-service"
Cohesion: 0.20
Nodes (9): Build only, Database migration (first run / schema change), Gotchas, Infrastructure, Prerequisites, Run (agent path) — smoke script, Run (human path), run-wi-ai-service (+1 more)

### Community 24 - "main.ts"
Cohesion: 0.38
Nodes (4): AppModule, bootstrap(), startupLogger, LoggingInterceptor

### Community 27 - "nest-cli.json"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 29 - "package.json"
Cohesion: 0.40
Nodes (4): description, license, name, version

## Knowledge Gaps
- **178 isolated node(s):** `entrypoint.sh script`, `base`, `$schema`, `collection`, `sourceRoot` (+173 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PrismaService` connect `PrismaService` to `fakes.ts`, `app.module.ts`, `Deal`, `warranties.controller.ts`, `Warranty`, `warranties.module.ts`, `deals.controller.ts`, `warranty.aggregate.ts`, `list-warranties.handler.ts`, `StoragePort`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Why does `Warranty` connect `Warranty` to `app.module.ts`, `Deal`, `warranties.module.ts`, `warranty.aggregate.ts`, `Result`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Why does `Deal` connect `Deal` to `Result`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **What connects `entrypoint.sh script`, `base`, `$schema` to the rest of the system?**
  _178 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `fakes.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05955734406438632 - nodes in this community are weakly interconnected._
- **Should `app.module.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05913461538461538 - nodes in this community are weakly interconnected._
- **Should `Deal` be split into smaller, more focused modules?**
  _Cohesion score 0.06612021857923497 - nodes in this community are weakly interconnected._