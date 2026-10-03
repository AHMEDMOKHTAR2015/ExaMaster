/**
 * The API client's one piece of policy: what a failure looks like to the rest
 * of the app. The backend words its refusals for people ("This registration
 * key has already been used."), so the client must pass that sentence through
 * rather than replace it with a generic message for the status code.
 */

import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiClient, toServiceError } from './api-client.service';
import { ServiceError } from '../shared/service-error';
import { environment } from '../../../environments/environment';

describe('toServiceError', () => {
  const failure = (status: number, error: unknown) => new HttpErrorResponse({ status, error });

  it("passes the API's own message through, with the status as the code", () => {
    const error = toServiceError(failure(400, { StatusCode: 400, Message: 'This registration key has already been used.' }));

    expect(error).toEqual(jasmine.any(ServiceError));
    expect(error.code).toBe('400');
    expect(error.message).toBe('This registration key has already been used.');
  });

  it("prefers a validation failure's field messages over its summary line", () => {
    const error = toServiceError(failure(400, {
      Message: 'One or more validation errors occurred.',
      Errors: [{ PropertyName: 'Password', ErrorMessage: 'A password must be at least 6 characters.' }]
    }));

    expect(error.message).toBe('A password must be at least 6 characters.');
  });

  it('says the server could not be reached when there was no response at all', () => {
    expect(toServiceError(failure(0, null)).code).toBe('unavailable');
  });

  it('falls back to the generic wording when the body carries no message', () => {
    expect(toServiceError(failure(404, null)).message).toBeTruthy();
  });
});

describe('ApiClient', () => {
  let client: ApiClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(ApiClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('addresses the configured API and leaves empty query parameters out', async () => {
    const result = client.get<{ ok: boolean }>('/users', { search: 'sara', role: undefined, classId: null, page: 1 });

    const request = http.expectOne(r => r.url === `${environment.apiUrl}/users`);
    expect(request.request.params.keys().sort()).toEqual(['page', 'search']);
    request.flush({ ok: true });

    expect(await result).toEqual({ ok: true });
  });

  it('sends a list as the key repeated, the way the API binds an array', async () => {
    const result = client.get('/questions', { ids: [3, 7] });

    const request = http.expectOne(r => r.url === `${environment.apiUrl}/questions`);
    expect(request.request.params.getAll('ids')).toEqual(['3', '7']);
    request.flush({});
    await result;
  });

  it('rejects with a ServiceError, never a raw HttpErrorResponse', async () => {
    const result = client.post('/registrations', { code: 'x' });
    http.expectOne(`${environment.apiUrl}/registrations`).flush({ Message: 'Registration key not found.' }, { status: 400, statusText: 'Bad Request' });

    await expectAsync(result).toBeRejectedWith(jasmine.objectContaining({ code: '400', message: 'Registration key not found.' }));
  });

  it('recognises only its own requests as API requests', () => {
    expect(ApiClient.isApiRequest(`${environment.apiUrl}/me`)).toBeTrue();
    expect(ApiClient.isApiRequest('/assets/i18n/en.json')).toBeFalse();
  });
});
