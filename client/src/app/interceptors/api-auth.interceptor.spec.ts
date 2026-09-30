/**
 * The token goes to the API and nowhere else: translation files and assets are
 * fetched through the same HttpClient, and must not carry the user's token.
 */

import { TestBed } from '@angular/core/testing';
import { HTTP_INTERCEPTORS, HttpClient, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { ApiAuthInterceptor } from './api-auth.interceptor';
import { AuthSessionService } from '../services/auth/auth-session.service';
import { environment } from '../../environments/environment';

describe('ApiAuthInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let token: string | null;
  let renewals: number;

  beforeEach(() => {
    token = 'access-1';
    renewals = 0;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: HTTP_INTERCEPTORS, useClass: ApiAuthInterceptor, multi: true },
        {
          provide: AuthSessionService,
          useValue: {
            getAccessToken: (force = false) => {
              if (force && token) token = `access-${++renewals + 1}`;
              return Promise.resolve(token);
            }
          }
        }
      ]
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  const settle = () => new Promise(resolve => setTimeout(resolve));

  async function requestTo(url: string) {
    const response = firstValueFrom(http.get(url));
    await settle();                                            // let the token promise settle
    const request = backend.expectOne(url);
    request.flush({});
    await response;
    return request.request;
  }

  it('sends the access token to the API', async () => {
    expect((await requestTo(`${environment.apiUrl}/me`)).headers.get('Authorization')).toBe('Bearer access-1');
  });

  it('sends nothing to anything else', async () => {
    expect((await requestTo('/assets/i18n/en.json')).headers.has('Authorization')).toBeFalse();
  });

  it('sends nothing when nobody is signed in', async () => {
    token = null;
    expect((await requestTo(`${environment.apiUrl}/registrations`)).headers.has('Authorization')).toBeFalse();
  });

  it('retries once with a renewed token when the API says the token expired', async () => {
    const url = `${environment.apiUrl}/me`;
    const response = firstValueFrom(http.get(url));
    await settle();
    backend.expectOne(url).flush({}, { status: 401, statusText: 'Unauthorized' });
    await settle();
    const retry = backend.expectOne(url);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer access-2');
    retry.flush({ ok: true });
    expect(await response).toEqual({ ok: true });
  });
});
