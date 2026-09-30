import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable, catchError, from, switchMap, throwError } from 'rxjs';
import { ApiClient } from '../services/api/api-client.service';
import { AuthSessionService } from '../services/auth/auth-session.service';

/**
 * Sends the session's access token with every API request.
 *
 * The token only says who the caller is; the API loads their roles and
 * organization from its own database on every request. The session renews an
 * expiring token itself, so this adds no round trip in the common case. A 401
 * gets one retry with a freshly renewed token — the token can expire between
 * leaving here and reaching the server. Requests to anything but the API are
 * left untouched.
 */
@Injectable()
export class ApiAuthInterceptor implements HttpInterceptor {
  private readonly session = inject(AuthSessionService);

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!ApiClient.isApiRequest(request.url)) return next.handle(request);

    return from(this.session.getAccessToken()).pipe(
      switchMap(token => next.handle(withToken(request, token)).pipe(
        catchError((error: unknown) => {
          if (!token || !(error instanceof HttpErrorResponse) || error.status !== 401) return throwError(() => error);
          return from(this.session.getAccessToken(true)).pipe(
            switchMap(renewed => renewed ? next.handle(withToken(request, renewed)) : throwError(() => error))
          );
        })
      ))
    );
  }
}

function withToken(request: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;
}
