# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

QuizMasterPro (`ng6-quiz`) is an Angular 18 (standalone components, signals) quiz platform. Its backend is the .NET API
in `../backend` (SQL Server): data, sign-in, grading and notifications all live there. The app uses no
Firebase at all — an ESLint rule refuses Firebase imports (`eslint.config.js`) and the repo carries no Firebase config.
Where the built app is hosted is not decided yet (see Hosting below).

Users take quizzes; teachers manage quizzes/homework for their classes; parents ("user admins") manage their children's
accounts and view participation; application admins manage their school (users, subjects, stages/grades/classes,
registration keys, labels); the platform admin (the vendor) manages schools.

## Commands

```bash
npm start                 # ng serve — development configuration by default (http://localhost:4200)
npm run build              # ng build — defaultConfiguration is "production" (optimized, hashed output)
ng build --configuration development   # unminified build with sourcemaps
npm test                   # ng test (Karma/Jasmine)
npm test -- --watch=false --browsers=ChromeHeadless   # single headless run, e.g. for CI or a quick check
npm run lint                # ng lint (ESLint 9 flat config, see eslint.config.js)
```

To run locally, start the API first (in the backend repo): `docker compose up -d sqlserver`, then
`dotnet run --project src/Services/QuizMaster/QuizMaster.API` (port 4401). Then `npm start`. An empty database gets
exactly one account, the platform administrator: sign in as `platform@quizmasterpro.local` with `@dminP@$$w0rd`, create a
school in the platform console, and sign in as its administrator with the password shown once. Started with
`SeedOptions__DemoSchool=true`, the API also seeds a demo school whose accounts sign in with the password `password`
(`admin@demo-school.local`, `teacher@…`, `parent@…`, `student@…`). The platform administrator has no notification
inbox (notifications belong to a school), so `NotificationCenterService` does not ask for one.

`npm run lint` is a gate: it exits 0 today, with ~146 **warnings** that are real
accessibility findings in existing templates (labels not associated with their
inputs; `(click)` on non-focusable elements). They are warnings so new work can
be gated now, not because they are accepted — the count is the tracker, and
`eslint.config.js` documents each relaxation and why. Don't add new ones.

Run a single spec file with Karma by narrowing via `--include`, e.g.:
```bash
ng test --include='**/quiz-runner.spec.ts' --watch=false --browsers=ChromeHeadless
```

`prestart`/`prebuild` auto-run `tools/generate-asset-manifest.js`, which generates an asset manifest consumed by the app — don't skip it when invoking the Angular CLI directly (bypassing `npm start`/`npm run build`).

The `build` architect target uses the esbuild-based `@angular-devkit/build-angular:application` builder with `defaultConfiguration: "production"` — a bare `ng build` is already optimized. Output goes to `dist/ng6-quiz/` (flat layout, no `browser/` subfolder). `environment.prod.ts` points at an unresolvable API address on purpose until the API's production address is decided: a production build fails loudly instead of calling a wrong host.

## Architecture

### Sign-in

The API is the identity provider. `POST /auth/sign-in` checks an email and password and returns a short-lived access
token (30 min) and a refresh token. `AuthSessionService` keeps the access token in memory only and the refresh token in
`sessionStorage` (the default: the session ends with the tab — school devices are shared) or, with "Remember me",
`localStorage`. It renews the access token shortly before it expires, one refresh at a time: the server rotates refresh
tokens, and a spent one presented again ends every session of that account, so two racing refreshes would sign the
person out. It talks to the API on the bare `HttpBackend`, so renewing never passes through the interceptor that asks
for a token. `ApiAuthInterceptor` adds the token to API requests only and retries a 401 once after renewing.

On start, `AuthService` restores a stored session by loading `GET /me`; a 401 or 404 there signs out. Families sign in
with a mobile number, which `EmailBuilder` turns into the email it was registered under (`{digits}@mobile.local`,
unique platform-wide). Five wrong passwords lock an account for 15 minutes.

**There is no reset email** — a child has no mailbox. The people responsible for an account set its password: an
administrator for anyone in their school (Users → edit), a parent for their own children (dashboard → child → Set
password); anyone can change their own (the key button in the sidebar footer); and the platform administrator can set a
school administrator's (platform console → Admin password) — the way into a school with no working administrator login. Setting a password signs that account
out everywhere; changing your own signs you straight back in with the new one.

### Identity and organizations

**A person is referenced by their API id.** `User.id` and `User.uid` hold the same value (the app keyed people by `uid`
throughout, so the mapper fills both); `parentId`, a family's children, a reviewer, a submission's child, a lock's child
are all API ids.

The app is sold to independent schools, and the server keeps them apart: every tenant-owned table carries a query filter
on the caller's organization, which the API reads from the caller's own user record on every request (never from the
token), together with their roles — so removing a role or suspending a school takes effect on the next request. The app
never sends an organization id. `TenantContextService` / `TenantService` only hold the signed-in person's organization
for display (its slug and branding); `AuthService.setCurrentUser` is the sole writer, synchronously alongside `_user`.

`platformAdmin` is the vendor's role. It is **not** part of `AdminAccessService`/`AdminRoleStrategy` (whose methods all
answer "what may I do inside my school") and is absent from `isAdmin()`/`isStaff()`. The platform console
(`/platform-admin`, `PlatformTenantService` → `/platform/tenants`) sees schools' metadata only, never data inside one;
creating a school creates its first administrator too.

**Access requests.** The login card's "Request access" button swaps it (`crossFade`) for a form where a visitor with no
registration key asks to join as a parent or a child, choosing their own password. The platform administrator reviews
them at `/platform-admin/access-requests` (`AccessRequestService`, which also feeds their sidebar badge) and, approving,
picks the school — and for a child, its class and a parent of that school, whose family key gives up a slot. The
visitor then signs in with the mobile number and password they chose; before a decision, signing in says it is waiting
(or why it was declined). This is the one place the platform console reads inside a school, and only what placing one
account needs.

### Role model: strategy pattern, not flags

There is no boolean `isAdmin` scattered through the app. Authorization is resolved once through `AdminAccessService.getStrategy(userRoles)` (`src/app/services/admin/core/admin-access.service.ts`), which returns one of four `AdminRoleStrategy` implementations (`src/app/services/admin/strategies/`): `ApplicationAdminStrategy`, `UserAdminStrategy` (parent), `TeacherStrategy`, `NoAdminStrategy`. Each implements the same capability-check interface (`canManageQuizzes()`, `canAccessTeacherDashboard()`, `canManageChildren()`, etc.) — route guards and components call these capability checks rather than inspecting roles directly. When adding a new permission, add the method to `AdminRoleStrategy` (`src/app/interfaces/admin-role-strategy.ts`) and implement it in all four strategies.

Route guards (`src/app/guards/auth.guard.ts`) are all `CanActivateFn`s that: `await authService.waitForAuthReady()` → check `isAuthenticated()` → resolve a strategy → call the relevant capability method → redirect via `router.createUrlTree(...)` if denied. Follow this shape for new guards rather than injecting services directly into components to check access.

### Services layout

- `src/app/services/api/` is the API layer. `ApiClient` is the only thing that talks to the backend: promises, and
  failures as a `ServiceError` (`services/shared/service-error.ts`) carrying the API's own message — the backend words
  its refusals for people, so screens show `error.message` as it is. API shapes live in `api-models.ts`; each service
  maps them into the app's `models/` (ids become strings) with the mappers beside it (`question-mapping.ts`,
  `participation-mapping.ts`, `auth/current-user.mapper.ts`).
- `src/app/services/admin/` is organized by domain, not by CRUD verb: `core/` (access strategy resolution, dashboard
  stats), `academic/` (stage/grade/class-group/subject), `users/`, `teachers/`, `quizzes/`, `registration/`. Import from
  the barrel `src/app/services/admin/index.ts`, not individual files — it's the intended public surface.
- `src/app/services/auth/` is sign-in and the signed-in person: `AuthSessionService` (tokens), `AuthService` (`GET /me`,
  sign-in/out, registration, changing your own password), `child-account.service.ts`, `user-builder.ts` (`EmailBuilder`).
- Root-level services (`quiz.service.ts`, `quiz-runner.service.ts`, `quiz-submission.service.ts`, `homework.service.ts`,
  `teacher-quiz.service.ts`, `user-profile.service.ts`, `participation-summary.service.ts`, `notification*.service.ts`,
  `teacher-review-queue.service.ts`, `language.service.ts`) are the cross-cutting/quiz-taking-flow services that don't
  belong to a specific admin domain.
- The API assigns ids, so saving is `createX` (returns the new id) or `updateX`, never an upsert on an id the screen
  invented. Where the API returns a list whole (the school structure, a school's quizzes, assignments), `listX`
  returns one page and admin tables page in memory (`api/list-paging.ts` → `pagedList`, `onePage`); where it pages
  (users, questions, participations) the cursor is the next page number. The API caps a page at 100.
- **Nothing in the read path caches**, and no `RouteReuseStrategy` is registered, so leaving a route and coming back
  re-runs its load. `participation-summary.service.ts` exists for that reason: a student's history is shown by
  Available Quizzes, `/profile` and `/my-participations` (each attempt opening the answer popup), one tap apart on the
  mobile tab bar, so it loads once per signed-in account and clears the moment the account changes (a shared device
  must never show one account's stats under another). Its completed-quizzes list is built from the same attempts its
  tiles count. Account-scoped services like it and `QuizService` check who is signed in when a load *starts*, not only
  in their `effect`: the first screen after sign-in loads before that effect runs, and an effect that clears on
  "nothing loaded yet" threw that first load away (the Quizzes tab came up empty).
- **Live updates come over SignalR** (`services/realtime/realtime.service.ts`, the API's `/hubs/notifications`). The
  server sends only signals — `inboxChanged`, `reviewQueueChanged` — and the notification inbox
  (`NotificationCenterService`) and the teacher's Validation badge (`TeacherReviewQueueService`) then re-read through the
  API, so nothing that matters travels over the socket. One connection per signed-in account, opened on sign-in and
  closed on sign-out; a reconnect refreshes both, and both still poll every 5 minutes as a safety net for a connection
  that cannot be made. Both clear on a change of account. The token rides in the connection URL (`access_token`), which
  the API accepts on `/hubs` paths only.

### Quiz-taking flow

`src/app/quiz/`, `src/app/question-options/`, `src/app/question-complete/`, `src/app/quiz-result/` implement the actual quiz-taking UI, distinct from `src/app/components/quiz-management` and `quizzes-admin` (which are authoring/admin UIs). `src/app/shared/quiz-runner.ts` and `services/quiz-runner.service.ts` hold the runtime logic for stepping through a quiz session.

**Correct answers never reach a student before submission, and the client never grades.** A quiz is sat from its
*sitting* — `/quizzes/{id}/sitting`, `/teacher-quizzes/{id}/sitting`, or, for assigned work, `/assignments/{id}/sitting`,
where the server decides which quiz the assignment means — and the API's sitting types have nowhere to put an answer.
`QuizRunnerService.submit()` posts only what the student did to `POST /submissions`, by the same target; the server
grades, records the attempt, releases a One Time Join lock, notifies the parent and the reviewer, and returns the result
together with the key (withheld until the due date for an assignment). Only staff can read a quiz whole
(`TeacherQuizService.getById`, `QuizAdminService.getAnswer`); an assignment carries its quiz's `questionCount`,
`quizDurationSeconds` and `oneTimeJoin` so a student's list needs no teacher quiz.

**The server grades** (QuizMaster.Domain/Grading in the backend); changing how a question is marked means changing it
there. `src/app/shared/grade-quiz.ts` keeps what the app needs — `applyAnswerKey` and `suggestedCompleteAward` — plus
`gradeQuiz`, the TypeScript statement of the same rules, which only the specs use.

**Explain and Complete are teacher-graded**; Choose and Right-or-Wrong are auto-graded. Complete joined Explain because a blank legitimately has more than one right answer while `correctBlanks` holds only the keyword the author typed — exact matching marked valid synonyms wrong. `question-scoring.ts` therefore keeps **two** predicates that look interchangeable and are not: `requiresManualReview()` (Explain + Complete) says who marks a question; `carriesAuthoredWeight()` (Explain only) says how it is weighted. Complete needs a human but claims no authored weight, so it draws an ordinary equal share — merging the two would give every Complete question `DEFAULT_EXPLAIN_WEIGHT_PERCENT` off the top and silently re-weight the rest of the quiz. The per-blank exact match is still computed as a *suggestion* (`suggestedCompleteAward`), which pre-fills the teacher's field.

Anything `requiresManualReview` is reviewed in **Quiz Management → Validation**, which draws from two sources because a
submission can reach a reviewer two ways: assigned work (the assignment's author reviews it) and a **bank quiz**, whose
reviewer an application admin picks when creating it (`reviewerId`, a teacher's API id — required by the builder, since
otherwise nobody could mark its Explain/Complete answers). Lists carry no answers; the validation editor and the answer
popup load an attempt whole (`ParticipationService.getById`). Marks and verdict are saved in one request
(`HomeworkParticipationService.review` → `POST /participations/{id}:review`); the server recomputes the score and tells
the student.

### One Time Join

`QuizConfig.oneTimeJoin` gives a quiz one uninterrupted sitting: the app shell
stops rendering its sidebar and topbar, the in-quiz "Back to Quizzes" control is
withheld, and a student who leaves before submitting is locked out until a
teacher lifts it from Quiz Management → Participation.

The split between the two halves is the thing to keep straight. `QuizLockdownService`
(`src/app/services/quiz/quiz-lockdown.service.ts`) owns the browser guards —
`beforeunload`, a re-pushed history sentinel, `visibilitychange` — and every one
of them is **advisory**: a browser cannot refuse a tab close, cannot block a tab
switch, and runs none of this if the tab is killed. The durable half is the
server's attempt lock (`QuizLockService` → `/attempt-locks`), taken when the
attempt *opens* so that re-entry is denied by the absence of a release rather
than the presence of an exit event. `POST /attempt-locks` refuses a second
sitting while one is blocking, and only a submission or a teacher releases one.
Defeating the client buys nothing; that is deliberate, and it is why the guards
can stay simple.

A lock names its piece of work by `scopeKey`; `attemptScopeKey()` in
`src/app/shared/quiz-attempt-scope.ts` must build the same key as the server
(`homework:12`, `teacher:5`, `bank:3`), because the quiz list matches a
student's locks to its cards by it.

The shell reads `QuizLockdownService.isActive` rather than `QuizRunnerService`
on purpose — the reverse would make `app.component.ts` import the whole
quiz-taking stack to decide whether to draw navigation.

### Components

`src/app/components/` holds top-level routed feature components (all lazy-loaded via `loadComponent` in `src/app/app.routes.ts`, one per admin domain: `application-admin`, `users-admin`, `teachers-admin`, `subjects-admin`, `quizzes-admin`, `registration-keys-admin`, plus `admin-dashboard`, `parent-dashboard`, `available-quizzes`, `login`, `quiz-management`). All routed components are guarded (see role model above) — check `app.routes.ts` for which guard applies before adding a new admin route.

All components extend `BaseComponent` (`src/app/shared/base/base.component.ts`) for shared `loading`/`error` signals (`setLoading`, `setError`, `clearError`, `hasError`) and a generic `trackById` — use these instead of re-declaring loading/error state per component. Components use `ChangeDetectionStrategy.OnPush` throughout; prefer `signal()`/`computed()` for local state over plain fields + manual `markForCheck()`, and `takeUntilDestroyed()` (via the injected `DestroyRef`) for any manual RxJS subscription.

Below 900px the shell changes navigation mode: the sidebar becomes an overlay drawer, and students and parents additionally get a fixed bottom tab bar (`.tabbar` in `app.component.html`, gated on `showTabbar()`). Teacher and application admin keep the drawer only — their nav trees are too deep for four items to represent honestly. Both the drawer and the tab bar are withheld entirely while `QuizLockdownService.isActive`, for the same reason the sidebar is: a One Time Join sitting renders no navigation at all, rather than hidden navigation.

The notification panel is a topbar dropdown on desktop and a full-screen sheet below 900px, and it is rendered as a **sibling of `<header class="topbar">`, never inside it**. That placement is load-bearing twice over: `.topbar` is `position: sticky` and therefore a stacking context, which caps the panel's `z-index` beneath the drawer no matter how high it is set; and `.topbar` carries `[style.opacity]="topbarOpacity()"`, which fades its entire subtree — fixed descendants included — to zero after 150px of scroll.

### Styling

Two global stylesheets and nothing else. `src/styles.css` (~11.5k lines) holds everything width-agnostic, organised by a banner comment per surface ("Login", "Quiz Taking", "Users Admin", …). `src/styles.mobile.css` (~1k lines) holds **every rule gated on a viewport width or on pointer type**, and is listed immediately after it in `angular.json` under both the `build` and `test` targets. That order is load-bearing: nearly every rule in the mobile file overrides a base rule at *equal* specificity and relies on the cascade's "later wins", so putting it first reverts the app to its desktop layout on a phone without producing a single error.

There are no component `.css`/`.scss` files. Two components carry a small inline `styles: []` block — `loading-spinner.component.ts` (the full-screen overlay) and `quizzes-admin/quiz-illustration.component.ts` (`:host` sizing for an inline SVG) — and both are self-contained. Nothing else should acquire one.

**Class names are global and collide easily.** A banner comment records where a class was *first needed*, not what owns it: `.actions` sits under *Quizzes Admin* and is used by 10 components, `.form-input` under *Registration Keys* and is used by 6, and the whole `.pagination` family serves 5 surfaces. Grep every template for a class before changing it — the definition site proves nothing. The failure mode is silent and wide: adding `background`/`color` to a shared `@media (pointer: coarse)` tap-target rule (whose selector list spans `.nav-item`, `.popup__close`, `.back-btn` and five more) repainted every dialog's close button across 12 templates, plus every sidebar link, on every touch device. Add a modifier or an ancestor-scoped selector instead of widening a shared rule.

Four breakpoints, and new work should reuse one rather than introduce a fifth: **1100px** (`.profile-panel` stops being sticky), **900px** (the shell mode switch — drawer, bottom tab bar, dark topbar), **720px** (quiz-counts popup columns), **640px** (side-by-side comparisons that stop being comparisons). Plus `@media (pointer: coarse)`, which is **not** a breakpoint — it asks whether the input is a fingertip, so it fires on tablets and touchscreen laptops at desktop widths too. Keep it to tap-target sizing: styling that pairs with a width-gated change (the dark topbar's icon buttons, say) belongs at that width, or it will paint a phone treatment onto a tablet that never got the rest of it.

`env(safe-area-inset-*)` resolves to `0px` on purpose — `src/index.html` carries no `viewport-fit=cover`, and turning it on makes the page paint under the notch and the home indicator, at which point every fixed and edge-anchored element across ~35 templates needs its own inset. That is a change worth making deliberately, not as a side effect.

Touch has one behaviour worth remembering when styling anything tappable: mobile browsers hold `:hover` on the last element tapped until something else is tapped, so a `:hover` written for a light surface is what a tap *leaves sitting there* on a dark one.

### i18n

`@ngx-translate` with `src/assets/i18n/{en,ar}.json`. `LanguageService` (`src/app/services/language.service.ts`) is the single place that switches language, persists the choice (`localStorage`, key `qm_lang`), and toggles `dir`/`lang` attributes on `<html>` for RTL support — call `languageService.switchTo()`/`.toggle()` rather than calling `TranslateService` directly, since RTL layout depends on the `dir` attribute being kept in sync. `app.config.ts` passes `fallbackLang: 'en'` but deliberately **not** `lang`: that would make the service call `use()` itself at construction, a second caller alongside `LanguageService`.

`en.json` and `ar.json` must stay key-for-key identical — a key added to one only renders as a raw dotted key in the other, and an override cannot patch it, since overrides may only replace a key the base already has. Check with a quick recursive key-set diff of the two files after touching either. There is one pre-existing drift (`quizManagement.results.overallDesc`, Arabic only).

**Per-tenant label overrides.** The JSON files stay the base and the only source of truth for which keys exist; a school's customisations are stored by the API (`/translation-overrides`, both languages in one read, as
`{ 'dotted.key': 'text' }` per language), merged over the base at runtime by `TranslationOverridesService`
(`src/app/services/i18n/`) and edited at `/translations-admin`. They are per school because `applicationAdmin` is a
school-scoped role. A save names only the labels that changed, so two admins editing different labels both land.

Three things about it that are easy to break:

- **Never merge into a language that has not loaded.** `setTranslations` is `extend && hasTranslationFor(lang) ? mergeDeep(…) : x`, so merging first stores the overrides *as the whole language* and makes `hasTranslationFor` true forever — the real file is then never fetched and that language renders a thousand raw keys. Every apply is guarded by `store.hasTranslationFor(lang)`.
- **Validation lives at merge time, not just in the editor.** `sanitizeOverrides` drops any entry whose key is absent from the base, is not a string, or loses/invents a `{{ token }}`. Whatever is stored reaches every member of that school, so the app checks it again rather than trusting it. Token extraction must keep using `TRANSLATION_PARAM_MATCHER`, copied from the parser's own regex — it allows one space per side, so `{{  name  }}` is not a token and would render literally.
- **No translated value is bound to `[innerHTML]` anywhere today** (verified). If one ever is, overrides become a tenant-wide stored-XSS vector.

### Hosting

Not decided, and nothing deploys the app: `.github/workflows/ci.yml` only lints, tests and builds. The build is a static
site in `dist/ng6-quiz`, and whatever serves it needs a catch-all rewrite to `/index.html` (the app routes client-side,
so anything else 404s on refresh) and three cache tiers — immutable for the content-hashed bundles, must-revalidate for
the verbatim-copied `assets/`, no-store for `index.html`. The API's `ClientAppOptions:AllowedOrigins` must list its
address. Quiz cover images are
build-time assets under `src/assets/quiz-images`, listed by `tools/generate-asset-manifest.js`; there is no file upload.
[DEPLOYMENT.md](DEPLOYMENT.md) is the runbook.
