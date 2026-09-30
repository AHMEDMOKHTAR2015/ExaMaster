# ExaMaster

The QuizMaster school quiz platform in one repository:

| Folder | What it is |
|---|---|
| [`backend/`](backend/README.md) | .NET 10 API on SQL Server: sign-in, schools, quizzes, grading, notifications |
| [`client/`](client/README.md) | Angular 18 app |

In production both run on one Azure Web App (`ExaMaster`). The API serves the built Angular app from its `wwwroot`,
next to `/api` (the API) and `/hubs/notifications` (live notifications). It is one origin, so no CORS setup is needed.
Any other path returns `index.html` so client-side routes survive a page refresh.

Started on 2026-09-30 from `QuizMasterPro.Backend@client-dev-auth` and `QuizMasterPro@backend-api`. The earlier history
stays in those two repositories, which are unchanged.

## Deploying

Every push to `main` runs [`deploy.yml`](.github/workflows/deploy.yml). It runs both CIs (backend build, tests and smoke
suite; client lint, tests and build), builds the Angular app into the API's `wwwroot`, and deploys the result to the
Web App. Pull requests run only the CI of the side they change.

### One-time Azure setup

1. **Database.** Create an Azure SQL Database in the same resource group. Under the server's *Networking*, enable
   *Allow Azure services and resources to access this server*. The API creates the tables itself on its first start.
2. **Web App `ExaMaster`** → *Settings → Configuration*:
   - *General settings*: stack **.NET 10**, **Web sockets On** (live notifications), **Always on On** (Basic tier or higher).
   - *Health check*: path `/health`.
   - *Environment variables* (app settings):

     | Name | Value |
     |---|---|
     | `ConnectionStrings__Database` | `Server=tcp:<server>.database.windows.net,1433;Database=<db>;User Id=<user>;Password=<password>;Encrypt=True;` |
     | `AuthTokenOptions__SigningKey` | a random secret of at least 32 characters (`openssl rand -base64 48`). The API does not start without it. |
     | `PlatformAdministratorOptions__Password` | the platform administrator's first password. It must be set before the first start, or no administrator is created. |
     | `ClientAppOptions__AllowedOrigins__0` | `https://<the Web App's address>` |

3. **Publish profile.** On the Web App, open *Settings → Configuration → General settings*, turn **SCM Basic Auth
   Publishing Credentials** On, and save. Then, on *Overview*, choose **Download publish profile**.
4. **GitHub secret.** In this repository, open *Settings → Secrets and variables → Actions → New repository secret*.
   Name it `AZURE_WEBAPP_PUBLISH_PROFILE` and paste the whole content of the downloaded file.
5. Run the **Deploy** workflow (*Actions → Deploy → Run workflow*), or push to `main`.

After the first deploy, sign in as `platform@quizmasterpro.local` with the password from step 2, change it, and create
the first school from the platform console.

### Before going live

- **One instance only.** Scaling out needs Azure SignalR Service as a backplane (see
  `backend/src/Services/QuizMaster/QuizMaster.API/DependencyInjection.cs`).
- **Migrations run at startup.** The database user needs rights to change the schema.
- **Swagger is public.** It is on in every environment, at `/swagger`.

## Local development

This works as before. Run the API (`backend/`, port 4401) and `npm start` (`client/`, port 4200). The development build
calls `http://localhost:4401/api`, and only the production build uses the relative `/api`. See each folder's README.
