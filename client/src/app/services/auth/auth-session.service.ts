import { Injectable, inject } from '@angular/core';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { Subject, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { toServiceError } from '../api/api-client.service';
import { ServiceError } from '../shared/service-error';

/** `POST /auth/sign-in` and `/auth/refresh`: a session. */
interface ApiSessionTokens {
  accessToken: string;
  accessTokenExpiresOn: string;
  refreshToken: string;
  refreshTokenExpiresOn: string;
}

interface StoredSession {
  refreshToken: string;
}

const STORAGE_KEY = 'qm_session';
/** Refresh this long before the access token runs out, so a request never leaves with one about to expire. */
const EXPIRY_MARGIN_MS = 60_000;

/**
 * The signed-in session: the API's short-lived access token, kept in memory
 * only, and the refresh token that renews it.
 *
 * "Remember me" decides where the refresh token lives. Off (the default on a
 * school platform of shared lab machines and classroom tablets), it is in
 * `sessionStorage` and ends with the tab; on, it is in `localStorage` and
 * survives a restart. Only the refresh token is stored — never the access
 * token — and the server rotates it on every use and ends every session of the
 * account if a spent one is ever presented again.
 *
 * Talks to the API on the bare `HttpBackend` rather than through `ApiClient`,
 * so that renewing a token never passes through the interceptor that asks for one.
 */
@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  // On the bare backend: no interceptor runs for these, so asking for a token can never wait on itself.
  private readonly http = new HttpClient(inject(HttpBackend));

  /**
   * Emits when the server refuses the refresh token: the session ended without
   * this app ending it (expired, password changed, signed out elsewhere).
   * `AuthService` then leaves the current page and signs out.
   */
  readonly ended = new Subject<void>();

  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;
  private refreshing: Promise<string | null> | null = null;

  /** Whether this session was kept with "Remember me" (it survives closing the browser). */
  isRemembered(): boolean {
    return this.storageHolding() === localStorage;
  }

  /** Whether a session was left by an earlier visit (the app restores it at start). */
  hasSession(): boolean {
    return !!this.readStored();
  }

  async signIn(email: string, password: string, remember: boolean): Promise<void> {
    const tokens = await this.post('/auth/sign-in', { email, password });
    this.adopt(tokens, remember);
  }

  /**
   * A usable access token: the one in memory, or a new one from the refresh
   * token. `null` when there is no session, or it has ended (the refresh token
   * was refused), in which case the stored session is cleared.
   */
  async getAccessToken(forceRefresh = false): Promise<string | null> {
    if (!forceRefresh && this.accessToken && Date.now() < this.accessTokenExpiresAt - EXPIRY_MARGIN_MS) {
      return this.accessToken;
    }
    // One refresh at a time: two requests racing to spend the same refresh token
    // would look like theft to the server and end the session.
    this.refreshing ??= this.refresh().finally(() => { this.refreshing = null; });
    return this.refreshing;
  }

  /** End this session on the server (best effort) and forget it here. */
  async signOut(): Promise<void> {
    const stored = this.readStored();
    this.clear();
    if (!stored) return;
    try {
      await this.post('/auth/sign-out', { refreshToken: stored.refreshToken });
    } catch {
      // Already ended, or offline: either way nothing here can sign in with it any more.
    }
  }

  /** Forget the session without telling the server (it has already ended there). */
  clear(): void {
    this.accessToken = null;
    this.accessTokenExpiresAt = 0;
    for (const storage of [localStorage, sessionStorage]) {
      try { storage.removeItem(STORAGE_KEY); } catch { /* storage blocked */ }
    }
  }

  private async refresh(): Promise<string | null> {
    const stored = this.readStored();
    if (!stored) return null;
    try {
      const tokens = await this.post('/auth/refresh', { refreshToken: stored.refreshToken });
      this.adopt(tokens, this.storageHolding() === localStorage);
      return this.accessToken;
    } catch (error) {
      // Refused: the session is over (expired, signed out elsewhere, password changed). Offline: keep it for later.
      if (error instanceof ServiceError && error.code === '401') {
        this.clear();
        this.ended.next();
      }
      return null;
    }
  }

  private adopt(tokens: ApiSessionTokens, remember: boolean): void {
    this.accessToken = tokens.accessToken;
    this.accessTokenExpiresAt = new Date(tokens.accessTokenExpiresOn).getTime();
    const value = JSON.stringify({ refreshToken: tokens.refreshToken } satisfies StoredSession);
    const [keep, drop] = remember ? [localStorage, sessionStorage] : [sessionStorage, localStorage];
    try {
      drop.removeItem(STORAGE_KEY);
      keep.setItem(STORAGE_KEY, value);
    } catch {
      // Storage blocked (private mode, site data refused): the session lasts as long as this page.
    }
  }

  private readStored(): StoredSession | null {
    const storage = this.storageHolding();
    try {
      const raw = storage?.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as StoredSession) : null;
    } catch {
      return null;
    }
  }

  private storageHolding(): Storage | null {
    for (const storage of [sessionStorage, localStorage]) {
      try { if (storage.getItem(STORAGE_KEY)) return storage; } catch { /* storage blocked */ }
    }
    return null;
  }

  private post(path: string, body: unknown): Promise<ApiSessionTokens> {
    return firstValueFrom(this.http.post<ApiSessionTokens>(`${environment.apiUrl}${path}`, body))
      .catch(error => { throw toServiceError(error); });
  }
}
