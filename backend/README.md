# QuizMasterPro backend

A .NET 10 backend for the [QuizMasterPro](https://github.com/AHMEDMOKHTAR2015/QuizMasterPro) Angular app: sign-in, schools (tenants), the question bank, quizzes, homework, server-side grading, teacher review, One Time Join attempt locks, notifications and the dashboards. The app uses nothing else.

Built from the `ddd-microservices` template (DDD × Vertical Slice × Clean Architecture). SQL Server, EF Core, Minimal APIs + MediatR.

> The Angular app's `backend-api` branch runs entirely on this API. Going live needs this API hosted; see the app's `DEPLOYMENT.md`. There is no data import: the system starts empty, with only its platform administrator.

---

## Run it locally (macOS)

```bash
docker compose up -d sqlserver                                   # SQL Server 2022 on localhost:1433 (sa / LocalDev_Passw0rd!)
#   (or any SQL Server you already have: set ConnectionStrings:Database with dotnet user-secrets)

dotnet tool restore
dotnet test                                                      # domain tests, no database needed
dotnet run --project src/Services/QuizMaster/QuizMaster.API      # migrates; first run creates the platform administrator → https://localhost:4451/swagger
```

**First run.** An empty database gets exactly one account, the platform administrator — `platform@quizmasterpro.local`
with the password `@dminP@$$w0rd` in Development (`PlatformAdministratorOptions`; elsewhere set
`PlatformAdministratorOptions__Password`, or none is created). No school, user, quiz, homework or participation exists: the
platform administrator creates schools from the app's platform console, and each new school's first administrator gets a
generated password. `bash tests/smoke/first-run.sh` checks exactly that against a fresh database.

**Demo school (opt-in, Development).** Start with `SeedOptions__DemoSchool=true` to also seed the tenant `demo-school`
with one account per role, a class, questions, quizzes and a homework. The API then also accepts tokens from the dev
token tool, so you can call it without signing in (or sign in with `POST /api/auth/sign-in` and the password `password`):

```bash
dotnet run --project tools/QuizMasterPro.DevToken -- --uid dev-student     # also: dev-admin, dev-teacher, dev-parent, dev-student-2, dev-platform
```

Paste the token into Swagger's **Authorize**, or into the Postman environment (`postman/`). To exercise everything at once against a fresh database started with the demo school:

```bash
bash tests/smoke/smoke.sh        # end-to-end checks: grading, review, notifications, translations, onboarding, homework, locks, permissions, keys, accounts
```

### With the Angular app

```bash
dotnet run --project src/Services/QuizMaster/QuizMaster.API       # http://localhost:4401
npm start                                                         # in the Angular repo
```

Sign in as `platform@quizmasterpro.local` / `@dminP@$$w0rd` and create a school. With the demo school seeded, its
accounts also sign in with the password `password` (`admin@demo-school.local`, `teacher@…`, `parent@…`, `student@…`).

## What's in the API

| Area | Endpoints (under `/api`) | Who |
|---|---|---|
| Sign-in | anonymous `POST auth/sign-in`, `POST auth/refresh`, `POST auth/sign-out`; `PUT me/password`; `PUT users/{id}/password`; `PUT platform/tenants/{id}/administrator-password` | anyone / yourself / admins and parents / platform |
| Me | `GET me`, `GET me/children` | anyone signed in / parents |
| Users | `GET users`, `GET users/{id}`, `PUT users/{id}/roles · /placement · /parent · /teacher-record`, `POST users/{id}:activate · :deactivate` | staff read, admins change |
| School structure | `stages`, `grades`, `classes`, `subjects`, `teachers` (list / create / update / delete) | members read, admins change |
| Question bank | `questions` (search, get with answer, create, update, delete) | admins (teachers may read one) |
| Bank quizzes | `quizzes`, `quizzes/{id}/sitting` | members list and sit, admins author |
| Teacher quizzes | `teacher-quizzes`, `teacher-quizzes/{id}/sitting` | teachers author their own |
| Assignments | `assignments`, `assignments/{id}/sitting` | teachers set, students see theirs, parents their children's |
| Sitting a quiz | `POST attempt-locks` (One Time Join), `:exit`, `:release`, `DELETE`, `GET attempt-locks[/mine]`, `POST submissions` | students sit, staff unlock |
| Results | `participations`, `participations/{id}`, `participations/{id}:review`, `reviews` | own / children's / staff |
| Accounts | `POST users` (create a sign-in + profile), `POST me/children`, `POST teachers/{id}/login` | admins / parents |
| Registration | `registration-keys` (search, create, update, delete); anonymous `POST registrations`, `POST registrations/child` | admins / anyone with a key |
| Notifications | `GET me/notifications`, `POST me/notifications/{id}:read`, `POST me/notifications:read-all`; live signals on the SignalR hub `/hubs/notifications` | the recipient only |
| Translations | `GET translation-overrides`, `PUT translation-overrides/{language}` (changed + removed labels), `DELETE translation-overrides/{language}` | members read, admins change |
| Platform | `platform/tenants` (list, get, create with its first administrator, update), `:suspend`, `:reactivate` | platform administrators |
| Dashboard | `dashboard/stats`, `classes/{id}/stats` | admins / staff |

Every request is authorized in two layers (role, then ownership of the specific record), and every query is confined to the caller's organization by a database-level tenant filter.

## Guarantees worth knowing

- Roles and the organization are read from the `user` table on every request (`UserClaimsTransformation`), never trusted from the token, so removing a role or suspending a school takes effect on the next request.
- Grading happens only on the server (`POST /api/submissions` + `Domain/Grading`); answer keys are never mapped into student-facing DTOs (`SittingDto` has no field for them).
- Answers stay withheld until an assignment is due, even when the student re-reads the attempt later; a homework submission is always graded against the assignment's own quiz.
- Dashboards and review queues are plain queries: nothing denormalized to keep in sync.

## Not built yet

Hosting: the API and the app still need somewhere to run in production.

## Licensing notes

- Contains code from the DotNetLabX `dotnet-microservices` course repository, **MIT**: see `LICENSE`.
- **MediatR** is pinned to **12.5.0** and **MassTransit** to **8.x**, the last Apache-2.0 releases. Do not accept automated upgrades to MediatR 13 or MassTransit 9 (commercial).
