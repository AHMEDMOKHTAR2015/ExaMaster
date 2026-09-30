# QuizMasterPro backend: DDD × Vertical Slice × Clean Architecture

The .NET backend for the QuizMasterPro Angular app (`/Users/ahmedmokhtar/QuizMasterPro`). Generated from the `ddd-microservices` template. It is the app's whole backend: data, authorization **and sign-in** (it is the app's identity provider). One service today, `QuizMaster` (see its `CLAUDE.md`).

## Repo structure

```
QuizMasterPro.sln · Directory.Packages.props (all versions) · dotnet-tools.json (dotnet-ef) · docker-compose*.yml
src/
├── BuildingBlocks/
│   ├── Blocks.Exceptions           HttpException → BadRequest / NotFound / Unauthorized / Forbidden / Conflict
│   ├── Blocks.Domain               Entity<T>, AggregateRoot<T>, value-object bases, IDomainEvent, DomainException, IAuditableAction, IMultitenancy
│   ├── Blocks.Core                 Guard, options helpers, MaxLength, Mapster + FluentValidation helpers, RequestContext, ITenantProvider
│   ├── Blocks.EntityFrameworkCore  ApplicationDbContext, RepositoryBase, configuration ladder, interceptors, JSON seeding
│   ├── Blocks.AspNetCore           exception/context/diagnostics middlewares, HttpContextProvider, RouteKeys, gRPC client helper
│   ├── Blocks.MediatR              ICommand/IQuery, AssignUserId → Validation → Logging behaviors, domain-event publisher
│   ├── Blocks.FastEndpoints · Blocks.Messaging · Blocks.Http.Abstractions · Blocks.Redis · Blocks.Hasura   (unused so far)
│   ├── QuizMasterPro.Abstractions  shared kernel: IAggregateAction, AggregateCommandBase<T>, UserRoleType, IAggregateAccessChecker
│   ├── QuizMasterPro.Security      access tokens (issue + validate, + dev tokens), ISignInAccounts, Role constants, RequireRoleAuthorization[<TAggregate>]
│   ├── QuizMasterPro.Grpc.Contracts · QuizMasterPro.IntegrationEvents.Contracts   (empty until a second service exists)
├── Modules/                        EmailService, FileStorage (not referenced yet)
├── Services/QuizMaster/            the backend: Minimal APIs + MediatR + SQL Server (see its CLAUDE.md)
└── ApiGateway/                     YARP, /quizmaster/** → QuizMaster
tools/QuizMasterPro.DevToken/       development tokens for the demo-school accounts (dev-admin, dev-teacher, dev-parent, dev-student, dev-platform)
tests/QuizMaster.Domain.Tests/      grading (ported app specs) + aggregate rules; no DB, no mocks
tests/smoke/smoke.sh                end-to-end checks against a running API with the demo school (SeedOptions__DemoSchool=true)
tests/smoke/first-run.sh            an empty database holds only the platform administrator, who can onboard a school
docs/playbook/                      the architecture playbook (patterns, decisions, checklist, what not to copy)
.claude/agents/                     dotnet-architect, -service-scaffolder, -domain-modeler, -slice-developer, -integration-engineer, -architecture-reviewer
```

## Core principles

- **Clean Architecture decides references.** Each service is a linear stack `API → Application → Persistence → Domain`. The Domain references nothing outward. Services never reference each other; contracts cross boundaries only through `QuizMasterPro.*.Contracts`.
- **Vertical Slice decides grouping.** `Features/{Area}/{Operation}/` holds command + validator (one file), handler, slice-only event handlers and mappings.
- **DDD decides where rules live.** Aggregate methods enforce invariants (`DomainException`); handlers only orchestrate: load → call one aggregate method → save.
- **CQRS via MediatR.** Failures are thrown and translated once by `GlobalExceptionMiddleware`.
- **Tenant isolation is structural.** Tenant-owned aggregates implement `IMultitenancy`; the DbContext filters and stamps them. Never add `IgnoreQueryFilters()` outside the claims transformation.

## Naming conventions

- Private fields `_camelCase`; public members/types `PascalCase`; locals/parameters descriptive `camelCase`; `ct` for CancellationToken.
- No abbreviations: never `req`, `cmd`, `res`, `ops`, `_q`, `_m`.
- `{Verb}{Noun}Command`, `{Get|Search|List}{Noun}Query`, `{Noun}{PastTense}` domain events, `{Effect}On{Event}Handler`, `PublishIntegrationEventOn{Event}Handler`, `{Aggregate}Repository`, `{Service}DbContext`, `{Thing}Options` (config section = class name).

## Architecture guardrails

- No service-layer classes. Use domain methods, handlers, repositories, loaders (`AttemptedQuizLoader`), infrastructure helpers.
- No repository interfaces without a second implementation; the repository is the unit of work (`SaveChangesAsync`).
- No god folders (`Services/`, `Helpers/`, `Utils/`, `Handlers/`, `Validators/`, `Controllers/`).
- No inventing patterns. Mirror `src/Services/QuizMaster` and the playbook.
- No bypassing domain rules via EF configurations or endpoints; rule-governed state is `private set`.
- **Student-facing DTOs never carry an answer key** (`SittingDto`); grading changes only in `Domain/Grading`, with a test.
- Default to a module; make a microservice only when deployment, scaling, or ownership demands it.
- Secrets never in `appsettings.json`: user-secrets locally, environment variables in containers. `appsettings.Development.json` holds local values only.

## Commands

```bash
dotnet tool restore                                   # dotnet-ef (pinned in dotnet-tools.json)
dotnet build QuizMasterPro.sln
dotnet test
docker compose up -d sqlserver                        # SQL Server 2022 on localhost:1433
dotnet run --project src/Services/QuizMaster/QuizMaster.API   # migrates; an empty database gets ONLY the platform administrator
                                                      # (platform@quizmasterpro.local / @dminP@$$w0rd in Development — FirstRunSeed)
SeedOptions__DemoSchool=true dotnet run --project src/Services/QuizMaster/QuizMaster.API   # + the demo school (smoke suite, dev tokens)
dotnet run --project tools/QuizMasterPro.DevToken -- --uid dev-student       # paste into Swagger "Authorize" (demo school only)
bash tests/smoke/smoke.sh                             # end-to-end checks against the running API (demo school)
bash tests/smoke/first-run.sh                         # first-run checks against an API on an empty database
dotnet ef migrations add Name -p src/Services/QuizMaster/QuizMaster.Persistence -s src/Services/QuizMaster/QuizMaster.API
```

## Port conventions

4400–4499. Gateway 4400. QuizMaster 4401/4451. Further services (4402/4452), … in creation order.

## Agents

Use them in this order: `dotnet-architect` (plan) → `dotnet-service-scaffolder` (new service) → `dotnet-domain-modeler` → `dotnet-slice-developer` → `dotnet-integration-engineer` → `dotnet-architecture-reviewer`.

## Licensing

MediatR stays on 12.5.0 and MassTransit on 8.x (the last Apache-2.0 releases). Check the license of any new package: free for commercial use only (MIT, Apache-2.0, BSD).

## Working rules for Claude

- After reading a file, trust your context; re-read only if it changed.
- When compacting, preserve domain-model decisions, current file changes, and which files were read.
