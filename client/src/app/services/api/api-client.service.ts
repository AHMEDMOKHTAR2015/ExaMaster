import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ServiceError } from '../shared/service-error';

/** Query parameters; `undefined`/`null` values are left out rather than sent as the string "undefined". */
export type ApiParams = Record<string, string | number | boolean | null | undefined>;

/**
 * The QuizMasterPro.Backend API, as promises — the shape every feature service
 * already works in, so a service moving off Firestore changes its data source
 * and nothing else. The Firebase ID token is attached by `ApiAuthInterceptor`.
 *
 * Failures reach callers as a `ServiceError` carrying the API's own message
 * ("This registration key has already been used."), not a generic one for the
 * status code: the backend words its refusals for people, so they are shown
 * as they are.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);

  get<T>(path: string, params?: ApiParams): Promise<T> {
    return this.send(this.http.get<T>(this.url(path), { params: toHttpParams(params) }));
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.send(this.http.post<T>(this.url(path), body ?? {}));
  }

  put<T>(path: string, body: unknown): Promise<T> {
    return this.send(this.http.put<T>(this.url(path), body));
  }

  delete<T>(path: string): Promise<T> {
    return this.send(this.http.delete<T>(this.url(path)));
  }

  /** Whether a request is for this API — the interceptors use it to leave other requests (translations, assets) alone. */
  static isApiRequest(url: string): boolean {
    return url.startsWith(environment.apiUrl);
  }

  private url(path: string): string {
    return `${environment.apiUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private async send<T>(request: ReturnType<HttpClient['get']>): Promise<T> {
    try {
      return (await firstValueFrom(request)) as T;
    } catch (error) {
      throw toServiceError(error);
    }
  }
}

function toHttpParams(params?: ApiParams): HttpParams | undefined {
  if (!params) return undefined;
  let result = new HttpParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') result = result.set(key, String(value));
  }
  return result;
}

/**
 * The backend's error body is `{ StatusCode, Message, Errors?: [{ PropertyName, ErrorMessage }] }`
 * (GlobalExceptionMiddleware). A validation failure's own messages are more
 * useful than its summary line, so they win when present.
 */
export function toServiceError(error: unknown): ServiceError {
  if (!(error instanceof HttpErrorResponse)) {
    return new ServiceError('unknown', 'An unexpected error occurred.', error);
  }
  if (error.status === 0) {
    return new ServiceError('unavailable', 'The server could not be reached. Check your connection and try again.', error);
  }

  const body = (error.error ?? {}) as { Message?: string; Errors?: { ErrorMessage?: string }[] };
  const details = (body.Errors ?? []).map(e => e.ErrorMessage).filter((m): m is string => !!m);
  const message = details.length > 0 ? details.join(' ') : body.Message;
  return new ServiceError(String(error.status), message || ServiceError.fromHttpError(error).message, error);
}
