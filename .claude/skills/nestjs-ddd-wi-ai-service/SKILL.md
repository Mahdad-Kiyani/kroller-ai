---
name: nestjs-ddd-wi-ai-service
description: NestJS + DDD architecture guide for wi-ai-service. Use when asked to add a module, command, query, port, event, BullMQ queue, domain aggregate, value object, or controller — or when debugging wiring, module registration, or CQRS dispatch in this project.
---

# NestJS + DDD — wi-ai-service

**Stack**: NestJS 10 · `@nestjs/cqrs` · `@nestjs/bullmq` · Prisma 7 · TypeScript strict mode.  
**Pattern**: DDD with CQRS. Every module has four layers — domain → application → infrastructure → interface. Nothing leaks across the boundary in the wrong direction.

---

## Module layout (canonical)

```
src/modules/<name>/
  domain/
    <name>.aggregate.ts        ← aggregate root (extends AggregateRoot<Props>)
    <name>.repository.ts       ← port interface + Symbol token
    value-objects/             ← one file per VO
    events/                    ← domain events
  application/
    commands/
      <action>.command.ts      ← plain class, no decorators
      <action>.handler.ts      ← @CommandHandler, implements ICommandHandler
    queries/
      <query>.query.ts
      <query>.handler.ts       ← @QueryHandler, implements IQueryHandler
      <query>.read-model.ts    ← raw data shape returned by query (no aggregate)
    ports/
      <name>.port.ts           ← outbound port interface + Symbol token
  infrastructure/
    prisma-<name>.repository.ts  ← implements the domain repository interface
    claude-<name>.adapter.ts     ← implements an application port
    <name>-<event>.handler.ts    ← @EventsHandler (side-effects, queues)
    <name>-<queue>.processor.ts  ← @Processor BullMQ consumer
    <name>.mapper.ts             ← Prisma row ↔ domain aggregate conversion
  interface/
    <name>s.controller.ts        ← CommandBus / QueryBus only, no service injection
    dto/
      <action>.dto.ts
  <name>s.module.ts              ← registers providers, wires tokens
```

Existing modules: `deals` · `warranties` · `exclusions` · `suggestions` · `auth` (guard only).

---

## Shared domain primitives (`src/shared/domain/`)

### `AggregateRoot<TProps>`

```typescript
import { AggregateRoot } from '@shared/domain/aggregate-root';
import { UniqueEntityID } from '@shared/domain/unique-entity-id';

export class MyAggregate extends AggregateRoot<MyProps> {
  private constructor(props: MyProps, id?: UniqueEntityID) {
    super(props, id);           // generates a UUID id if omitted
  }

  // Factory for new aggregates — validates, then constructs
  static create(input: CreateInput): Result<MyAggregate> {
    const err = Guard.againstEmpty(input.name, 'Name');
    if (err) return Result.fail(err);
    return Result.ok(new MyAggregate({ name: input.name.trim() }));
  }

  // Factory for rehydration from persistence — skips validation, sets id
  static reconstitute(id: string, props: MyProps): MyAggregate {
    return new MyAggregate(props, new UniqueEntityID(id));
  }

  // Mutation methods emit domain events
  rename(name: string): Result<void> {
    this.props.name = name;
    this.addDomainEvent(new MyRenamedEvent(this.id.toString(), name));
    return Result.ok();
  }

  get name(): string { return this.props.name; }
}
```

`addDomainEvent()` calls NestJS CQRS `apply()` — events publish when the event bus picks them up (handled automatically by `@EventsHandler` providers).

### `ValueObject<TProps>`

```typescript
import { ValueObject } from '@shared/domain/value-object';
import { Result } from '@shared/domain/result';

export class Score extends ValueObject<{ value: number }> {
  private constructor(props: { value: number }) { super(props); }

  static of(v: number): Result<Score> {
    if (v < 0 || v > 1) return Result.fail('Score must be 0..1');
    return Result.ok(new Score({ value: v }));
  }
  get value(): number { return this.props.value; }
}
```

VOs are **immutable** (props is `Object.freeze`d), compared by structural equality via `equals()`.

### `Result<T>`

Domain business-rule errors are **values**, not exceptions.

```typescript
const r = Deal.create(input);
if (r.isFailure) throw new BadRequestException(r.error); // translate at the boundary
const deal = r.getValue();
```

`Result.combine(results)` short-circuits on the first failure.

### `Guard`

```typescript
Guard.againstEmpty(value, 'Field name')         // returns error string | null
Guard.inRange(n, 0, 100, 'Score')
Guard.isOneOf(status, ALLOWED_STATUSES, 'Status')
```

Use inside aggregate factory methods and value-object constructors.

---

## Domain layer

### Repository port

```typescript
// domain/<name>.repository.ts
import { MyAggregate } from './<name>.aggregate';

export interface MyRepository {
  findById(id: string): Promise<MyAggregate | null>;
  save(entity: MyAggregate): Promise<void>;
  list(): Promise<MyAggregate[]>;
}
export const MY_REPOSITORY = Symbol('MY_REPOSITORY');
```

**Rule**: the domain interface knows nothing about Prisma, HTTP, or NestJS.

### Domain events

```typescript
// domain/events/<name>-events.ts
import { DomainEvent } from '@shared/domain/domain-event';

export class MyCreatedEvent implements DomainEvent {
  constructor(
    public readonly aggregateId: string,
    public readonly dealId: string,
  ) {}
}
```

Emit from inside the aggregate with `this.addDomainEvent(new MyCreatedEvent(...))`.

---

## Application layer

### Command

```typescript
// application/commands/do-thing.command.ts
export class DoThingCommand {
  constructor(
    public readonly entityId: string,
    public readonly value: string,
  ) {}
}
```

Plain class. No decorators, no NestJS imports.

### Command handler

```typescript
// application/commands/do-thing.handler.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException, Inject, NotFoundException } from '@nestjs/common';
import { DoThingCommand } from './do-thing.command';
import { MyRepository, MY_REPOSITORY } from '../../domain/my.repository';

@CommandHandler(DoThingCommand)
export class DoThingHandler implements ICommandHandler<DoThingCommand> {
  constructor(@Inject(MY_REPOSITORY) private readonly repo: MyRepository) {}

  async execute(cmd: DoThingCommand): Promise<{ id: string }> {
    const entity = await this.repo.findById(cmd.entityId);
    if (!entity) throw new NotFoundException('Entity not found');

    const result = entity.doThing(cmd.value);
    if (result.isFailure) throw new BadRequestException(result.error);

    await this.repo.save(entity);
    return { id: entity.id.toString() };
  }
}
```

**Rule**: translate `Result.fail` → NestJS HTTP exceptions here, not in the domain.

### Query + read model

```typescript
// application/queries/get-thing.query.ts
export class GetThingQuery {
  constructor(public readonly id: string) {}
}

// application/queries/<name>.read-model.ts
export interface ThingReadModel {
  id: string;
  name: string;
  createdAt: Date;
}

// application/queries/get-thing.handler.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { NotFoundException, Inject } from '@nestjs/common';
import { GetThingQuery } from './get-thing.query';
import { ThingReadModel } from './<name>.read-model';
import { MyRepository, MY_REPOSITORY } from '../../domain/my.repository';

@QueryHandler(GetThingQuery)
export class GetThingHandler implements IQueryHandler<GetThingQuery, ThingReadModel> {
  constructor(@Inject(MY_REPOSITORY) private readonly repo: MyRepository) {}

  async execute(query: GetThingQuery): Promise<ThingReadModel> {
    const entity = await this.repo.findById(query.id);
    if (!entity) throw new NotFoundException();
    return { id: entity.id.toString(), name: entity.name, createdAt: new Date() };
  }
}
```

Queries return **read models** (plain objects), not domain aggregates. This keeps responses serializable without leaking aggregate internals.

### Application port (outbound)

```typescript
// application/ports/my-service.port.ts
export interface MyServiceResult { value: string }

export interface MyServicePort {
  compute(input: string): Promise<MyServiceResult>;
}
export const MY_SERVICE = Symbol('MY_SERVICE');
```

Inject with `@Inject(MY_SERVICE) private readonly service: MyServicePort`. The adapter lives in `infrastructure/`.

---

## Infrastructure layer

### Prisma repository adapter

```typescript
// infrastructure/prisma-<name>.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { MyRepository } from '../domain/my.repository';
import { MyAggregate } from '../domain/my.aggregate';

@Injectable()
export class PrismaMyRepository implements MyRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(r: { id: string; name: string }): MyAggregate {
    return MyAggregate.reconstitute(r.id, { name: r.name });
  }

  async findById(id: string): Promise<MyAggregate | null> {
    const r = await this.prisma.myModel.findUnique({ where: { id } });
    return r ? this.toDomain(r) : null;
  }

  async save(entity: MyAggregate): Promise<void> {
    await this.prisma.myModel.upsert({
      where: { id: entity.id.toString() },
      create: { id: entity.id.toString(), name: entity.name },
      update: { name: entity.name },
    });
  }

  async list(): Promise<MyAggregate[]> {
    const rs = await this.prisma.myModel.findMany();
    return rs.map((r) => this.toDomain(r));
  }
}
```

**Rule**: use `upsert` with the aggregate id as `where` for save — works for both new and updated aggregates.

### Claude adapter (application port implementation)

```typescript
// infrastructure/claude-<name>.adapter.ts
import { Injectable } from '@nestjs/common';
import { ClaudeClient } from '@shared/infrastructure/ai/claude.client';
import { MyServicePort, MyServiceResult } from '../application/ports/my-service.port';

@Injectable()
export class ClaudeMyAdapter implements MyServicePort {
  constructor(private readonly claude: ClaudeClient) {}

  async compute(input: string): Promise<MyServiceResult> {
    const response = await this.claude.complete({
      system: 'You are an expert in...',
      prompt: `Analyse: ${input}`,
    });
    // parse + validate response
    return { value: response.content };
  }
}
```

`ClaudeClient` is provided by `AiModule` (global). Do not import `AiModule` again in your module.

### BullMQ processor (queue consumer)

```typescript
// infrastructure/<name>-<queue>.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Job } from 'bullmq';
import { MyCommand } from '../application/commands/my.command';

@Processor('<queue-name>')
export class MyProcessor extends WorkerHost {
  private readonly logger = new Logger(MyProcessor.name);
  constructor(private readonly commandBus: CommandBus) { super(); }

  async process(job: Job<{ entityId: string }>): Promise<void> {
    this.logger.log(`Processing ${job.data.entityId}`);
    await this.commandBus.execute(new MyCommand(job.data.entityId));
  }
}
```

**Rule**: processors are **thin** — they dispatch to `CommandBus` and return. No business logic here.

### Domain event handler (side-effect)

```typescript
// infrastructure/<name>-<event>.handler.ts
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { MyCreatedEvent } from '../domain/events/<name>-events';

@EventsHandler(MyCreatedEvent)
export class MyCreatedHandler implements IEventHandler<MyCreatedEvent> {
  constructor(@InjectQueue('<queue-name>') private readonly queue: Queue) {}

  async handle(event: MyCreatedEvent): Promise<void> {
    await this.queue.add('job-name', { entityId: event.aggregateId });
  }
}
```

Event handlers live in `infrastructure/` because they have infrastructure concerns (queues, emails, etc.).

---

## Interface layer

### Controller

```typescript
// interface/<name>s.controller.ts
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Patch } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiSecurity, ApiTags, ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { DoThingCommand } from '../application/commands/do-thing.command';
import { GetThingQuery } from '../application/queries/get-thing.query';
import { DoThingDto, ThingResponseDto } from './dto/<name>.dto';

@ApiTags('<name>s')
@ApiSecurity('service-key')        // ← all endpoints protected by ApiKeyGuard (global)
@Controller('<name>s')
export class MyController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @ApiCreatedResponse({ type: ThingResponseDto })
  create(@Body() dto: DoThingDto): Promise<{ id: string }> {
    return this.commandBus.execute(new DoThingCommand(dto.value));
  }

  @Get(':id')
  @ApiOkResponse({ type: ThingResponseDto })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<ThingResponseDto> {
    return this.queryBus.execute(new GetThingQuery(id));
  }
}
```

**Rules**:
- Controllers inject **only** `CommandBus` and `QueryBus`. No services, no repositories.
- `@ApiSecurity('service-key')` on every controller (the global `ApiKeyGuard` enforces it).
- Use `ParseUUIDPipe` for every `:id` path param.
- Mark public endpoints with `@Public()` from `@modules/auth/decorators/public.decorator`.

### DTO

```typescript
// interface/dto/create-thing.dto.ts
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateThingDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  note?: string;
}

export class ThingResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
}
```

---

## Module wiring (`*.module.ts`)

```typescript
// <name>s.module.ts
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { BullModule } from '@nestjs/bullmq';
import { MyController } from './interface/my.controller';
import { MY_REPOSITORY } from './domain/my.repository';
import { MY_SERVICE } from './application/ports/my-service.port';
import { PrismaMyRepository } from './infrastructure/prisma-my.repository';
import { ClaudeMyAdapter } from './infrastructure/claude-my.adapter';
import { MyProcessor } from './infrastructure/my-queue.processor';
import { MyCreatedHandler } from './infrastructure/my-created.handler';
import { DoThingHandler } from './application/commands/do-thing.handler';
import { GetThingHandler } from './application/queries/get-thing.handler';

const CommandHandlers = [DoThingHandler];
const QueryHandlers = [GetThingHandler];
const EventHandlers = [MyCreatedHandler];
const Workers = [MyProcessor];

@Module({
  imports: [
    CqrsModule,
    BullModule.registerQueue({ name: '<queue-name>' }),   // only if you use queues
  ],
  controllers: [MyController],
  providers: [
    { provide: MY_REPOSITORY, useClass: PrismaMyRepository },
    { provide: MY_SERVICE, useClass: ClaudeMyAdapter },
    ...CommandHandlers,
    ...QueryHandlers,
    ...EventHandlers,
    ...Workers,
  ],
  exports: [MY_REPOSITORY],   // export only what other modules need
})
export class MyModule {}
```

**Rules**:
- Always import `CqrsModule` — handlers need it for `CommandBus`/`QueryBus`.
- Register queues with `BullModule.registerQueue` inside the module that owns them.
- Inject `@InjectQueue('name')` uses the same name string — typos are runtime failures.
- Do **not** import `PrismaModule`, `AiModule`, `EmbeddingsModule`, `StorageModule` — they are `@Global()` and already available project-wide.
- Register the new module in `src/app.module.ts` imports array.

---

## How to add a new module (checklist)

1. **Domain**: write `<name>.aggregate.ts`, `<name>.repository.ts` (interface + Symbol).
2. **Value objects**: one file per VO in `domain/value-objects/`.
3. **Domain events**: `domain/events/<name>-events.ts` if the aggregate mutates state that downstream modules care about.
4. **Prisma schema**: add model to `prisma/schema.prisma`, run `npm run prisma:migrate -- --name add_<name>`, then `npm run prisma:generate`.
5. **Repository adapter**: `infrastructure/prisma-<name>.repository.ts` implementing the domain interface.
6. **Application ports**: if the module needs external AI/storage/embedding, add a port interface in `application/ports/` and implement in `infrastructure/`.
7. **Commands**: one command class + one handler per write operation.
8. **Queries**: one query class + one handler + one read-model per read operation.
9. **BullMQ** (if async): add `@Processor` class in `infrastructure/`, add `@EventsHandler` to enqueue, register `BullModule.registerQueue` in the module.
10. **Controller + DTOs**: controller uses `CommandBus`/`QueryBus` only.
11. **Module file**: wire all providers with token bindings.
12. **`app.module.ts`**: add to `imports`.
13. **Tests**: unit tests for aggregates and VOs in `test/unit/`; integration tests in `test/integration/` with fake ports from `test/support/fakes.ts`.

---

## How to add a command to an existing module

1. Create `<action>.command.ts` in `application/commands/`.
2. Create `<action>.handler.ts` with `@CommandHandler`, inject the repository via `@Inject(TOKEN)`.
3. Add the handler to the `CommandHandlers` array in the module file.
4. Add a controller method that calls `this.commandBus.execute(new MyCommand(...))`.
5. Add a DTO class for the request body.

---

## How to add an application port (new external dependency)

1. Define the interface + Symbol in `application/ports/<name>.port.ts`.
2. Write the adapter in `infrastructure/claude-<name>.adapter.ts` (or `http-<name>.adapter.ts` etc.).
3. In the module, add `{ provide: MY_PORT, useClass: MyAdapter }` to `providers`.
4. Inject with `@Inject(MY_PORT) private readonly port: MyPort` in command handlers.
5. In `test/support/fakes.ts`, add a `FakeMyPort implements MyPort` for integration tests.

---

## Auth

`ApiKeyGuard` is registered globally in `AuthModule` — every endpoint requires `x-api-key: <SERVICE_API_KEY>` by default.

```typescript
// Mark an endpoint public (e.g. health check):
import { Public } from '@modules/auth/decorators/public.decorator';

@Public()
@Get('health')
health() { return { ok: true }; }
```

---

## Swagger

Swagger is mounted at `/api/docs` (no auth to browse).

- `@ApiTags('tag')` groups endpoints in the UI.
- `@ApiSecurity('service-key')` adds the lock icon (matches the `addSecurityRequirements` setup in `main.ts`).
- `@ApiCreatedResponse({ type: Dto })` / `@ApiOkResponse({ type: [Dto] })` document response shapes.
- Decorate every DTO property with `@ApiProperty()` or `@ApiPropertyOptional()`.

---

## Key invariants (do not violate)

| Invariant | Where enforced |
|---|---|
| Domain aggregates never import Prisma | `domain/` has zero `@prisma/client` imports except Prisma enums used as domain vocabulary |
| Aggregates never import NestJS | `domain/` except `AggregateRoot` base (which extends NestJS CQRS root) |
| Controllers never inject services or repositories directly | Only `CommandBus` + `QueryBus` |
| Processors never contain business logic | Dispatch to `CommandBus` only |
| AI outputs are immutable once set | `aiCategory`, `aiConfidence`, `aiPosition` — only `decidedPosition`, `category` can change |
| `spaReference` is verbatim from source | Never normalise, regenerate, or trim beyond what the source document contains |
| Repository `save()` always upserts | Use `prisma.model.upsert({ where: { id }, create: {...}, update: {...} })` |
| No barrel files | Import directly by path; use `@shared/*` and `@modules/*` aliases |

---

## Common mistakes

| Mistake | Fix |
|---|---|
| Injecting `PrismaService` directly into a command handler | Move DB access to the repository adapter; inject the port via `@Inject(TOKEN)` |
| Throwing exceptions inside domain aggregate methods | Return `Result.fail(message)` — translate to HTTP exceptions in the handler |
| Registering `PrismaModule` or `AiModule` in a feature module | They are `@Global()` — no re-import needed |
| Forgetting `CqrsModule` in a module's imports | Handlers cannot be discovered without it |
| Naming the queue differently in `registerQueue` vs `@Processor` | They must be identical strings |
| Using `prisma.$queryRaw` tagged-template with pgvector | Use `$queryRawUnsafe` with positional `$N` params (see prisma skill) |
| Exposing aggregate instances from query handlers | Return a read model (plain object) instead |
| Calling `Result.getValue()` without checking `isSuccess` | Always check `if (r.isFailure)` first |
