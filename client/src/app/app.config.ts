import { ApplicationConfig, ErrorHandler } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi, HTTP_INTERCEPTORS } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { provideToastr } from 'ngx-toastr';

import { routes } from './app.routes';
import { QuizService } from './services/quiz.service';
import { LoadingInterceptor } from './interceptors/loading.interceptor';
import { ApiAuthInterceptor } from './interceptors/api-auth.interceptor';
import { AppErrorHandler } from './shared/app-error-handler';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })),
    provideAnimations(),
    QuizService,
    provideHttpClient(withInterceptorsFromDi()),
    { provide: HTTP_INTERCEPTORS, useClass: LoadingInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: ApiAuthInterceptor, multi: true },
    // `fallbackLang` only — deliberately NOT `lang`. Passing `lang` makes the
    // service call `use()` at construction, which would make it a second
    // caller alongside LanguageService and break the invariant that RTL
    // depends on (see language.service.ts).
    provideTranslateService({ fallbackLang: 'en' }),
    ...provideTranslateHttpLoader(),
    provideToastr({
      positionClass: 'toast-top-right',
      preventDuplicates: true,
      progressBar: true,
      closeButton: true
    }),
    // Absorbs the one error that cannot be caught where it is raised: a read
    // still in flight when the user signs out. See `AppErrorHandler`.
    { provide: ErrorHandler, useClass: AppErrorHandler }
  ]
};
