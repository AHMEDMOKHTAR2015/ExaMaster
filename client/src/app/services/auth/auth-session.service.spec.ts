/**
 * The session renews itself, and says so when the server refuses: that is what
 * lets AuthService leave the page and sign out instead of leaving a screen of
 * failed loads behind.
 */

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthSessionService } from './auth-session.service';
import { environment } from '../../../environments/environment';

describe('AuthSessionService', () => {
  let http: HttpTestingController;
  let session: AuthSessionService;
  const settle = () => new Promise(resolve => setTimeout(resolve));
  const tokens = (access: string, refresh: string) => ({
    accessToken: access, accessTokenExpiresOn: new Date(Date.now() + 30 * 60_000).toISOString(),
    refreshToken: refresh, refreshTokenExpiresOn: new Date(Date.now() + 30 * 864e5).toISOString()
  });

  beforeEach(() => {
    sessionStorage.clear(); localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(AuthSessionService);
  });

  afterEach(() => { http.verify(); sessionStorage.clear(); localStorage.clear(); });

  async function signIn(remember: boolean): Promise<void> {
    const done = session.signIn('student@demo-school.local', 'password', remember);
    http.expectOne(`${environment.apiUrl}/auth/sign-in`).flush(tokens('access-1', 'refresh-1'));
    await done;
  }

  it('keeps the refresh token for the tab only, unless remembered', async () => {
    await signIn(false);
    expect([!!sessionStorage.getItem('qm_session'), !!localStorage.getItem('qm_session'), session.isRemembered()]).toEqual([true, false, false]);
    await signIn(true);
    expect([!!sessionStorage.getItem('qm_session'), !!localStorage.getItem('qm_session'), session.isRemembered()]).toEqual([false, true, true]);
  });

  it('hands out the access token in memory without a request while it is fresh', async () => {
    await signIn(false);
    expect(await session.getAccessToken()).toBe('access-1');
  });

  it('renews once for two callers at the same time: a spent refresh token must never be sent twice', async () => {
    await signIn(false);
    const [a, b] = [session.getAccessToken(true), session.getAccessToken(true)];
    await settle();
    http.expectOne(`${environment.apiUrl}/auth/refresh`).flush(tokens('access-2', 'refresh-2'));
    expect([await a, await b]).toEqual(['access-2', 'access-2']);
  });

  it('forgets the session and says it ended when the server refuses the refresh token', async () => {
    await signIn(false);
    let ended = 0;
    session.ended.subscribe(() => ended++);
    const renewed = session.getAccessToken(true);
    await settle();
    http.expectOne(`${environment.apiUrl}/auth/refresh`).flush({ Message: 'This session has ended.' }, { status: 401, statusText: 'Unauthorized' });
    expect([await renewed, ended, session.hasSession()]).toEqual([null, 1, false]);
  });

  it('keeps the session when the server cannot be reached, for a later try', async () => {
    await signIn(false);
    let ended = 0;
    session.ended.subscribe(() => ended++);
    const renewed = session.getAccessToken(true);
    await settle();
    http.expectOne(`${environment.apiUrl}/auth/refresh`).error(new ProgressEvent('error'));
    expect([await renewed, ended, session.hasSession()]).toEqual([null, 0, true]);
  });
});
