# Deployment

The app is a static site; its backend is the QuizMasterPro API (`../QuizMasterPro.Backend`), which has its own
deployment. Nothing here uses Firebase, and where the built app is hosted is not decided yet.

## Before the first release without Firebase

The site that is live today (Firebase Hosting, `quizmaster-70391.web.app`) still serves the old Firebase build: nothing
in this repo deploys there any more. `environment.prod.ts` points at `https://api.quizmaster.invalid/api` on purpose, so
a production build made before the API's address is decided fails on its first request rather than calling a wrong
host.

In order:

1. **Host the API** and its SQL Server database. Set, per environment: `ConnectionStrings__Database`,
   `AuthTokenOptions__SigningKey` (a random secret of at least 32 characters — the API refuses to start without it), and
   `ClientAppOptions__AllowedOrigins` (the app's address, for CORS). The host must allow **WebSockets** for the live
   notifications (`/hubs/notifications`; SignalR falls back to slower transports without them), and more than one API
   instance needs a SignalR backplane (Redis, or Azure SignalR Service) — see the API's `DependencyInjection.cs`.
2. **Put the API's address in `environment.prod.ts`** (`apiUrl`, ending in `/api`).
3. **Start empty.** Nothing is carried over from the Firebase app: its data stays in Firebase, and the new system starts
   with only the platform administrator (set `PlatformAdministratorOptions__Password` before the first start). The
   platform administrator creates each school (Platform console → New organization), whose administrator signs in with
   the password shown once and builds the school: structure, teachers, families, quizzes. The same console's Admin
   password rescues a school whose only administrator forgot theirs.
4. **Choose a host for the app and deploy `dist/ng6-quiz`** there (see below), then retire the old Firebase site.

## Building and hosting the app

**CI checks, it does not deploy.** `.github/workflows/ci.yml` runs on every push to `main` and every pull request: lint,
unit tests, production build. Add the deploy step for whichever host is chosen after those.

The GitHub repository still holds the secret `FIREBASE_SERVICE_ACCOUNT_QUIZMASTER_70391` (the key of the service account
`github-action-1043164556`, Firebase Hosting admin) from the old workflow. Nothing uses it now; delete the secret, and the
service account in the Google Cloud console, once the old site is retired.

Tests run under the `ChromeHeadlessCI` launcher in `src/karma.conf.js`; plain `ChromeHeadless` cannot start its sandbox
on a GitHub runner. The workflow installs npm 12 because `package-lock.json` is produced by npm 12 and npm 10 builds a
different tree from it — regenerate the lock with `npx npm@12 install`, not an older npm.

Whatever serves `dist/ng6-quiz` needs a catch-all rewrite to `/index.html` — the app is a SPA with client-side routing,
so anything else 404s on a page refresh. Caching is split three ways because only some of the output is content-hashed:

| Path | Cache-Control | Why |
|---|---|---|
| `*.js`, `*.css`, `media/**` | `max-age=31536000, immutable` | Hashed by the esbuild builder — a change is always a new URL |
| `assets/**` | `max-age=0, must-revalidate` | Copied verbatim with stable names; a translation fix must appear without a rename |
| `index.html` | `no-cache, no-store` | Names the current hashed bundles; caching it pins users to an old deploy |


## Local development

Run the API locally (see the README): the development build points at `http://localhost:4401/api`. An empty database
starts with only the platform administrator (`platform@quizmasterpro.local` / `@dminP@$$w0rd`); the demo school is
opt-in (`SeedOptions__DemoSchool=true`). Nothing local can touch production data.

In production the API creates the platform administrator on first start only if `PlatformAdministratorOptions__Password`
is set (and `__Email`, if not the default). Set it from a secret, sign in, and change the password.

## Pre-deploy checklist

```bash
npm run lint                                          # must be 0 errors
npm test -- --watch=false --browsers=ChromeHeadless
npm run build                                         # must be warning-free
```

and, in the backend repo, `dotnet test` and `tests/smoke/smoke.sh` against a freshly seeded database.

## Known risks

**No staging environment.** A second API + database for rehearsing releases is the real fix.

**Backups are the database's.** Configure SQL Server backups where the API is hosted before real data arrives.

**Mobile numbers are unique platform-wide.** `EmailBuilder` builds `{mobile}@mobile.local` sign-in emails without a
school namespace, so the second school to register a given number is refused. Namespacing it needs the school known *at
sign-in* (a picker or per-school addresses) and would change existing accounts' sign-in, so it is a migration.

**No end-to-end test.** Nothing automated exercises sign-in → take quiz → see result in a browser (the Angular 6
Protractor scaffold was removed: Protractor is end-of-life); the backend's smoke suite covers the API side of it.

**~146 accessibility lint warnings.** Real findings — labels not associated with inputs, click handlers on
non-focusable elements. They are warnings so new work can be gated now; the count is the tracker. Don't add more.
