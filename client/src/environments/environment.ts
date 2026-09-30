// Development environment. Replaced by `environment.prod.ts` in the
// `production` build configuration via `fileReplacements` in angular.json.

export const environment = {
  production: false,

  /**
   * The QuizMasterPro.Backend API, run locally (in the backend repo):
   *   dotnet run --project src/Services/QuizMaster/QuizMaster.API
   * On an empty database it creates only the platform administrator:
   * platform@quizmasterpro.local, password @dminP@$$w0rd. Schools are then
   * created from the platform console. (SeedOptions__DemoSchool=true also seeds
   * a demo school whose accounts use the password `password`.)
   */
  apiUrl: 'http://localhost:4401/api'
};
