# QuizMaster

A multi-tenant quiz and homework platform for schools: this Angular 18 app, and its .NET API in
[QuizMasterPro.Backend](https://github.com/AHMEDMOKHTAR2015/QuizMasterPro.Backend).

Students take quizzes and submit homework; teachers author quizzes, assign them to their classes and grade written answers; parents track their children's participation; school admins manage users, subjects and the stage/grade/class hierarchy. The app ships in English and Arabic, with full right-to-left support.

## Features

**Students** — take assigned homework and quizzes from a personal dashboard, with a timer, progress tracking and a per-question review step before submitting. Results show a score breakdown per question, including answers still awaiting a teacher's review.

**Teachers** — build custom quizzes, assign them to classes with due dates, grade the free-text question types, and track participation and results per assignment.

**Parents** — manage their children's accounts and review each child's quiz and homework history.

**Admins** — manage users, teachers, subjects, the stage/grade/class hierarchy, registration keys and the shared quiz bank, alongside a dashboard of school-wide statistics.

## Tech stack

- **Angular 18** — standalone components, signals, lazy-loaded routes, OnPush change detection throughout
- **QuizMasterPro.Backend** — .NET 10 API on SQL Server: data, sign-in, grading and notifications
- **@ngx-translate** — English/Arabic with RTL layout support
- A static site once built (`dist/ng6-quiz`); where it is hosted is not decided yet (see `DEPLOYMENT.md`)

## Getting started

**Prerequisites:** Node.js and npm; for the API, the .NET 10 SDK and Docker.

Start the API first, in the backend repo (it creates and seeds a demo school on first start):

```bash
docker compose up -d sqlserver
dotnet run --project src/Services/QuizMaster/QuizMaster.API     # http://localhost:4401
```

Then the app:

```bash
npm install
npm start          # dev server at http://localhost:4200
```

Sign in as the platform administrator, `platform@quizmasterpro.local` with the password `@dminP@$$w0rd` — on an empty
database it is the only account. Create a school in the platform console, then sign in as that school's administrator
with the password it shows once, and build the school from there. (Started with `SeedOptions__DemoSchool=true`, the API
also seeds a demo school: `admin@demo-school.local`, `teacher@…`, `parent@…`, `student@…`, password `password`.)

## Commands

| Command | What it does |
| --- | --- |
| `npm start` | Dev server on port 4200 |
| `npm run build` | Production build to `dist/ng6-quiz/` |
| `npm test` | Unit tests (Karma/Jasmine) |
| `npm test -- --watch=false --browsers=ChromeHeadless` | Single headless run, for CI |
| `npm run lint` | ESLint 9 (flat config) |

Run a single spec file by narrowing with `--include`:

```bash
ng test --include='**/quiz-runner.spec.ts' --watch=false --browsers=ChromeHeadless
```

## Architecture

A few decisions shape most of the codebase:

**The API is the backend, and the identity provider.** Every read and write goes through `ApiClient`; the API signs
people in (passwords, rotating refresh tokens), keeps schools apart on the server, and loads the caller's roles from its
own database on every request.

**Grading happens on the server.** Correct answers are never sent to the client before submission. A quiz is sat from a
*sitting* that has no place for an answer; responses go to `POST /submissions`, which grades, records the attempt and
returns the result with the key.

**Authorization goes through one strategy resolver.** There are no `isAdmin` booleans scattered around; `AdminAccessService` resolves a role strategy once, and guards and components ask it capability questions (`canManageQuizzes()`, `canManageChildren()`).

**Counts are taken on request.** Dashboard statistics, class stats, the quiz breakdown and review queues are queries
the API answers when asked, so there is nothing to keep in step or rebuild.

**Styling is two global stylesheets.** `src/styles.css` holds everything width-agnostic; `src/styles.mobile.css` holds every rule gated on viewport width or pointer type, and is loaded after it. There are no component stylesheets.

## Documentation

| File | Contents |
| --- | --- |
| [CLAUDE.md](CLAUDE.md) | Architecture, conventions and the reasoning behind them, in depth |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Deployment runbook and known risks |
