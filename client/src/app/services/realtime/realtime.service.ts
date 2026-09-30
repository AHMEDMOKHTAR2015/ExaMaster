import { DestroyRef, Injectable, effect, inject, signal, untracked } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { AuthSessionService } from '../auth/auth-session.service';
import { NotificationCenterService } from '../notification-center.service';
import { TeacherReviewQueueService } from '../teacher-review-queue.service';

/** Where the API's live channel is: beside `/api`, not under it. */
export function hubUrl(apiUrl = environment.apiUrl): string {
  return `${apiUrl.replace(/\/api\/?$/, '')}/hubs/notifications`;
}

/** Longest wait between attempts to reach an unreachable server, in ms. */
const MAX_RETRY_MS = 60_000;

/**
 * The live channel from the API (SignalR). The server sends only "look again"
 * signals — `inboxChanged`, `reviewQueueChanged` — and the inbox and the
 * Validation badge then re-read through the API as they always do, so nothing
 * that matters travels over the socket and the API stays the one authority.
 *
 * One connection per signed-in account, opened on sign-in and closed on
 * sign-out or a change of account. Signals sent while disconnected are lost,
 * so a reconnect refreshes both; the two services also still poll, slowly, as
 * the safety net for a connection that cannot be made at all.
 *
 * The token comes from {@link AuthSessionService} on every (re)connect, so an
 * expired access token is renewed rather than refused. Cookies are not used
 * (`withCredentials: false`), so the API's CORS needs no credentials.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly authService = inject(AuthService);
  private readonly session = inject(AuthSessionService);
  private readonly inbox = inject(NotificationCenterService);
  private readonly reviewQueue = inject(TeacherReviewQueueService);

  private readonly _connected = signal(false);
  /** Whether the live channel is up (false: the slow polling is all there is). */
  readonly connected = this._connected.asReadonly();

  private connection: HubConnection | null = null;
  private forUserId: string | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const userId = this.authService.user()?.id ?? null;
      untracked(() => void this.switchTo(userId));
    }, { allowSignalWrites: true });
    inject(DestroyRef).onDestroy(() => void this.stop());
  }

  private async switchTo(userId: string | null): Promise<void> {
    if (userId === this.forUserId) return;
    this.forUserId = userId;
    await this.stop();
    if (userId) await this.start(userId, 0);
  }

  private async start(userId: string, attempt: number): Promise<void> {
    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl(), {
        accessTokenFactory: async () => (await this.session.getAccessToken()) ?? '',
        withCredentials: false
      })
      .withAutomaticReconnect()
      .configureLogging(environment.production ? LogLevel.None : LogLevel.Warning)
      .build();

    connection.on('inboxChanged', () => void this.inbox.refresh());
    connection.on('reviewQueueChanged', () => void this.reviewQueue.refresh());
    connection.onreconnecting(() => this._connected.set(false));
    connection.onreconnected(() => {
      this._connected.set(true);
      this.refreshAll();                                          // whatever was signalled while we were away
    });
    connection.onclose(() => this._connected.set(false));
    this.connection = connection;

    try {
      await connection.start();
      if (this.connection !== connection || this.forUserId !== userId) {
        await connection.stop();                                  // signed out, or someone else signed in, meanwhile
        return;
      }
      this._connected.set(true);
      if (attempt > 0) this.refreshAll();
    } catch {
      // The server is unreachable (or refused the session). Automatic reconnect only covers a connection that was
      // once up, so try again later, backing off; polling covers the gap.
      if (this.connection !== connection || this.forUserId !== userId) return;
      this.connection = null;
      const delay = Math.min(MAX_RETRY_MS, 2_000 * 2 ** attempt);
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        if (this.forUserId === userId && !this.connection) void this.start(userId, attempt + 1);
      }, delay);
    }
  }

  private refreshAll(): void {
    void this.inbox.refresh();
    void this.reviewQueue.refresh();
  }

  private async stop(): Promise<void> {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    const connection = this.connection;
    this.connection = null;
    this._connected.set(false);
    if (connection && connection.state !== HubConnectionState.Disconnected) {
      try { await connection.stop(); } catch { /* already gone */ }
    }
  }
}
