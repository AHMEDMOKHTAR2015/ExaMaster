# QuizMaster service

**Serves:** the QuizMasterPro Angular app (`/Users/ahmedmokhtar/QuizMasterPro`): all of its data, authorization and sign-in.
**Endpoint framework:** Minimal APIs + MediatR
**Database:** SQL Server (`QuizMaster`), EF Core, PascalCase tables (singular type name) and columns
**Port:** 4401 / 4451
**Domain-event dispatch:** post-save interceptor (`DispatchDomainEventsInterceptor`)
**Identity:** this API is the identity provider. `POST /auth/sign-in` checks a password against `SignInCredential` (platform-wide, no tenant filter; `PasswordHasher`) and issues a 30-minute access token (HS256, `AuthTokenOptions`) plus a refresh token (only its SHA-256 is stored; rotated on every use; a spent one presented again revokes every session of that account). The token carries only `sub` = the account's sign-in uid (`User.SignInUid` = `SignInCredential.Uid`); the caller's user id, tenant and roles are loaded from the `User` table on every request (`UserClaimsTransformation`), so revocation is instant. Five wrong passwords lock an account for 15 minutes.

## Why one service

The template's guardrail is "default to a module; make a microservice only when deployment, scaling, or ownership demands it". None does yet: one team, one deployment, and every area reads `user` (roles, tenant, placement). The features are separated by `Features/{Area}` so an area can be lifted into its own service later.

## Multi-tenancy (the most important invariant)

Every tenant-owned aggregate implements `IMultitenancy`. `QuizMasterDbContext` adds a global query filter `TenantId == CurrentTenantId` to each one, and stamps `TenantId` on insert. `CurrentTenantId` is the caller's tenant (`tenant_id` claim) or `0`, which matches nothing except platform administrators' own `User` rows (the only rows with `TenantId` 0; no endpoint open to a tenant-less caller queries users). So:

- a query that forgets a WHERE cannot leak another organization's data (an id from another tenant is simply 404);
- a row can never be created in, or moved to, another tenant (`StampTenant` throws);
- only `UserClaimsTransformation`, `RegistrationScope` and `AccessRequestScope` use `IgnoreQueryFilters()` (plus `SetAdministratorPassword`'s one lookup), because finding the tenant is their job (the caller's; a self-registering person's from their key; the organization a platform administrator chose while approving an access request); each pins every read after that to the one tenant;
- seeding runs with no caller tenant and must set `TenantId` explicitly.
- a platform administrator (`PLATFORM_ADMIN`, `TenantId` 0) belongs to no organization: `StampTenant` leaves that one row alone, the claims transformation treats tenant 0 as never suspended, and `GET /me` returns no tenant. Their endpoints (`/platform/tenants`) read and change organization metadata only, never data inside one.

## SQL Server specifics

- SQL Server rejects a table reachable by two ON DELETE paths. Aggregate children cascade, and `participation`/attempt-lock links to quizzes and assignments are `SET NULL` in the database. The optional links from quizzes, questions and assignments to `Subject`/`Stage`/`Grade`/`ClassGroup` are `NO ACTION` in the database; `QuizMasterDbContext` clears them in the delete's own transaction (`SaveClearingReferencesAsync`). Add a new optional reference to reference data there, not as `SetNull`.
- Tags are reached only through their `Subject` (`SubjectRepository` includes them): `SubjectTag` has no tenant filter of its own, so never query it directly.
- `datetime2` has no time zone: every `DateTime` is stored as UTC and read back as `Kind=Utc` (`UtcDateTimeConverter`).
- The default collation is case-insensitive (search uses `LIKE`); `SignInUid` is binary (`Latin1_General_100_BIN2`): an identifier is compared exactly, never case-folded.
- Optimistic concurrency on `Participation` and `QuizAttemptLock` is a `rowversion` column (`HasConcurrencyToken`).

## Domain model (`QuizMaster.Domain`, by aggregate)

| Aggregate | What it enforces |
|---|---|
| `Tenant` | slug format; `IsActive=false` suspends every member (no roles) |
| `Tenant` | slug is the app's tenant id (`^[a-z0-9][a-z0-9_-]*$`), permanent and unique; `Suspend` removes every member's roles on their next request and deletes nothing; created only with its first administrator (`CreateTenant`, platform administrators only) |
| `User` | role combinations (a STUDENT holds no other role; PLATFORM_ADMIN is never tenant-assignable; you cannot remove your own admin role or deactivate yourself); placement comes from the class; `LastActiveOn` is stamped by every sign-in and session renewal (`SignInSessions`, straight to the column, so it is never an audited edit) |
| `Stage`, `Grade`, `ClassGroup`, `Subject`, `Teacher` | reference data; class stage/grade derived from its grade |
| `Subject` tags | a subject owns its `SubjectTag`s (topics; unique name per subject, case-insensitive; a kept tag keeps its id when renamed). Questions (bank and teacher-quiz) carry `TagIds` of **their own subject only** (`Subject.TagsFor` builds the only non-empty `QuestionTags`); moving a question to another subject drops its tags; a removed tag (or deleted subject) is dropped from questions by the handler in the same commit (JSON lists, no FK). Every `ParticipationAnswer` snapshots the question's `TagIds` at submission, for per-topic strength/weakness reads |
| `Question` (bank) | authored through `AuthoredQuestion.From(QuestionDraft)`: the single place the four question types are validated; the Complete passage is parsed server-side and stored MASKED |
| `BankQuiz` | active teacher as reviewer; 1–200 unique questions; Explain weights validated (`QuizScoring.ValidateExplainWeights`) |
| `TeacherQuiz` | owns its questions (numbered 1..n; responses refer to the number); same authoring rules |
| `HomeworkAssignment` | due date in the future (UTC); named students must be in the class; `IsAssignedTo` = named, else class OR stage (as the app) |
| `Participation` | `Submit` grades server-side, enforces entitlement, `requiredAll`, one submission unless the last was rejected, and trusts a claimed start only within 12 h; `Review` marks Explain/Complete answers (0..round(weight)) and records the verdict in one action |
| `RegistrationKey` | PARENT or APPLICATION_ADMIN only; the role and tenant of a self-registration come from the key; a parent key is claimed by one family; child slots are spent against the key the *parent* holds, never one named in a request (`rowversion` on the count); status is derived (`StatusAt`), never stored |
| `AccessRequest` | platform-wide (no tenant): a visitor with no key asks to join as a parent or child; the password they chose is kept as a hash and becomes their credential on approval; one pending request per sign-in (filtered unique index); a decision is final (`rowversion`). They must name their school (and a child their grade); what they typed about school, grade and parent is still a hint only — the platform administrator picks the organization (and a child's class and parent) when approving |
| `Notification` | written only by the server, from the `QuizSubmitted`/`SubmissionReviewed` domain events: the parent hears a child finished, the reviewer hears of every submission (`SubmissionNeedsReview` when an answer waits for their mark, else `SubmissionReceived`), the student hears a verdict once (`VerdictChanged`); contents are snapshotted; only the recipient reads or marks it (`/me/notifications`) |
| `TranslationOverride` | one row per customised label per language per school (`en`/`ar` only); key shape and length checked, never blank; the client's shipped JSON stays the base and the client still sanitizes (unknown keys, `{{ token }}` changes) at merge time |
| `QuizAttemptLock` | One Time Join: written when the attempt opens; blocking until released by a teacher or by the submission (same transaction); exits after release are ignored |

**Grading** (`Domain/Grading`) is a line-by-line port of the app's `grade-quiz.ts` and `question-scoring.ts`, with its spec cases ported to `tests/QuizMaster.Domain.Tests`. Rounding is JavaScript's `Math.round` (`QuizScoring.RoundPercent`), not .NET's banker's rounding. Change grading only there, and only with a test.

## Accounts and sign-ins

New sign-ins are created on the server through `ISignInAccounts` (`QuizMasterPro.Security`, implemented by `Application/SignIn/LocalSignInAccounts`): a credential row with a new `u-…` uid. There is no reset email (a child has no mailbox): `PUT /users/{id}/password` lets an administrator set anyone's in their school and a parent their own children's, `PUT /me/password` changes your own, and `PUT /platform/tenants/{id}/administrator-password` lets the platform administrator rescue a school with no working administrator login. Setting a password revokes that account's sessions. A profile with no credential yet (the demo seed's, before `DevelopmentSignIns`) gets one from `SetPasswordAsync`. In Development, seeded `dev-…` accounts get the password `password` at start (`DevelopmentSignIns`). `CreateThenPersistAsync` creates the sign-in, saves the profile, and deletes the sign-in again if the save fails. Every key/quota check runs *before* the sign-in is created. A user's `RegistrationKeyId` is re-checked on every request: a lapsed key gives the account no roles, and `GET /me` reports `registrationKeyProblem` so the client can say why. An email that already signs in (or belongs to a profile without a credential) is never adopted (teacher logins report `ExistsUnmanaged`).

## Access requests

`POST /access-requests` (anonymous, rate-limited per address: 5 an hour) stores a request; nothing else is created. The platform administrator reviews them at `/platform/access-requests` and approves into an organization they choose (`AccessRequestScope` reads that organization's classes and parents for the pickers: `/platform/tenants/{id}/classes`, `/platform/tenants/{id}/parents`). Approving a parent creates the account plus a claimed PARENT key with the chosen `MaxChildren`; approving a child creates a student placed in a class, linked to a parent of that organization, and spends one slot of the parent's key. Every check runs before the sign-in is created, and nothing tracked is changed until the transaction: `ISignInAccounts.CreateAsync` saves the shared context, so a change made earlier would be committed even if the approval failed (`RegistrationKey.EnsureChildSlotAvailable` checks without spending). Signing in before a decision, with the password the visitor chose, answers "waiting for approval" or "not approved" plus the reason; with any other password the usual message, so nothing reveals which numbers have asked.

## Notifications

The app's browsers wrote into each other's inboxes (the student's browser notified the teacher and parent), so its rules had to allow cross-user creates. Here `NotifyOnQuizSubmittedHandler` and `NotifyStudentOnSubmissionReviewedHandler` send them after the submission or review is committed, through `NotificationSender`, which is best-effort: a failure is logged, never reported as a failed submission. They are live: after saving, `NotificationSender` signals the recipients over SignalR (`IRealtimeNotifier` → `API/Realtime/NotificationsHub`, `/hubs/notifications`), and a submission or review signals the reviewer that their queue changed. The signal carries nothing but its name; the client re-reads through the API, which applies every permission. People are addressed by user id (the `NameIdentifier` `UserClaimsTransformation` adds), so no group bookkeeping is needed. The access token may travel as `?access_token=` on `/hubs` paths only (WebSockets carry no headers). One instance needs nothing more; several need a backplane (Redis or Azure SignalR Service). Hosts without the API (tools, tests) get `NoRealtimeNotifier`.

## Security boundaries

- **The answer key never reaches a student before grading.** Students sit quizzes through `…/sitting` endpoints that return `SittingDto`, a type with no member an answer could be mapped into. Answer keys appear only in staff authoring DTOs and in a graded result.
- **Results are withheld until an assignment is due**, both in the submit response and when a student/parent reads the participation later (`ParticipationViews` + `QuizGrader.Redact`).
- **For an assignment, the assignment decides which quiz is graded** (`AttemptedQuizLoader`), never ids the client sends with it.
- Authorization: role layer (`RequireRoleAuthorization`) + aggregate layer (`RequireRoleAuthorization<TAggregate>` → `QuizMasterAccessChecker`).
- **Deny by default.** A fallback policy requires a signed-in caller on any endpoint that declares no rule; anonymous endpoints say `AllowAnonymous` (sign-in, refresh, sign-out, the two registrations, access requests, `/health`, the client-app fallbacks).
- **Per-address rate limits** on the anonymous endpoints (`API/Security/RateLimits.cs`, tunable via `RateLimitOptions__…`): sign-in and refresh are token buckets sized for a classroom signing in from one school address; registration and access requests are per hour. The address is the last `X-Forwarded-For` entry outside Development (App Service's front end appends it; earlier entries are caller-controlled) — `ClientAddress`.
- **Passwords** (`PasswordPolicy`, OWASP ASVS V2.1): new passwords are 8–128 characters and not on the common-password list; no composition rules. Sign-in never checks the rule, so older shorter passwords still work. An unknown email costs the same hashing as a wrong password (no timing tell), and refused sign-ins, lockouts, refresh-token reuse and rate-limit hits are logged as warnings.
- **Rich text is cleaned on the way in** (`HtmlText.Clean`, HtmlSanitizer): Explain prompts, model answers and students' written answers lose scripts, event handlers and `javascript:` links before they are stored.
- **Browser headers** (`SecurityHeadersMiddleware`): CSP (`script-src 'self'`, no inline script — the client must never add one), `nosniff`, `X-Frame-Options: DENY`, Referrer/Permissions/COOP policies, HSTS outside Development, `no-store` on `/api`. Swagger is mapped in Development only. A 500 outside Development returns a generic message and the trace id; the error itself is logged. `web.config` removes IIS's `Server`/`X-Powered-By` headers; HTTPS itself is App Service's "HTTPS Only" (no in-app redirect: it would loop behind the front end).

## Endpoints

All under `/api`; see Swagger. Areas: `me`, `users`, `access-requests`, `platform`, `stages`/`grades`/`classes`/`subjects`/`teachers`, `questions`, `quizzes`, `teacher-quizzes`, `assignments`, `attempt-locks`, `submissions`, `participations`, `reviews`, `dashboard`.

## Design choices worth knowing

- Aggregates (dashboard stats, class stats, quiz counts, review queues) are queries, not maintained documents; nothing to recompute.
- `completedQuizzes` / `participationCount` on the user are derived from `participation`; nothing denormalized to keep in sync.
- An assignment links a quiz; students always sit the linked quiz (there is no per-assignment question list).
- Ids are integers assigned by the database.

## Not built yet

Hosting: the API and the app still need somewhere to run in production.
