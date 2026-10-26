import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { environment } from '../../../environments/environment';
import { TeachingRoomAdmission, TeachingRoomState } from '../../models';
import { ApiJoinTeachingRoomResult, ApiTeachingRoomState } from '../api/api-models';
import { AuthSessionService } from '../auth/auth-session.service';
import { toAdmission, toState } from '../teaching-room.service';
import { newerState, seesBoard } from '../../shared/teaching-room-state';
import { hubUrl } from './realtime.service';

/** Longest wait between attempts to reach an unreachable server, in ms. */
const MAX_RETRY_MS = 30_000;

/** What the room page wants to hear about besides the board itself. */
export interface TeachingRoomEvents {
  /** A student asked to join (the presenting teacher's page re-reads its requests). */
  joinRequestsChanged?: () => void;
}

/**
 * One room page's live connection to the board (`/hubs/teaching-room`), opened
 * by the page and closed with it — provide it in the component.
 *
 * The page asks the hub to join the room (`JoinRoom`); the server decides, from
 * the database, whether this person presents the room or was let in, and only
 * then puts the connection in the room's group and answers with the board.
 * A waiting or turned-away student is told nothing of the board, but hears the
 * teacher's decision live (`admitted` with the board, or `removed`). Unlike the
 * notifications channel, a move carries the board itself (`currentItemChanged`):
 * the group is what keeps it to the admitted.
 *
 * A reconnect is a new connection, outside every group, so it joins again and
 * takes the board as it now is. Moves sent while it was away are not replayed;
 * the join's answer is the current state.
 */
@Injectable()
export class TeachingRoomConnection {
  private readonly session = inject(AuthSessionService);

  private readonly _admission = signal<TeachingRoomAdmission | null>(null);
  private readonly _state = signal<TeachingRoomState | null>(null);
  private readonly _connected = signal(false);
  private readonly _ended = signal(false);

  /** Where the signed-in person stands, as the hub last answered; null until it has. */
  readonly admission = this._admission.asReadonly();
  /** The board; null whenever this person may not see it. */
  readonly state = this._state.asReadonly();
  readonly connected = this._connected.asReadonly();
  /** The teacher ended the room. */
  readonly ended = this._ended.asReadonly();

  private connection: HubConnection | null = null;
  private roomId: number | null = null;
  private events: TeachingRoomEvents = {};
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => void this.stop());
  }

  async open(roomId: string, events: TeachingRoomEvents = {}): Promise<void> {
    this.roomId = Number(roomId);
    this.events = events;
    await this.start(0);
  }

  /** Asks the hub again where this page stands (after a reconnect, or once the student has asked to join). */
  async join(): Promise<void> {
    const connection = this.connection;
    if (!connection || connection.state !== HubConnectionState.Connected || this.roomId === null) return;
    const result = await connection.invoke<ApiJoinTeachingRoomResult>('JoinRoom', this.roomId);
    this._admission.set(toAdmission(result.admission));
    if (result.state && seesBoard(this._admission())) this.show(toState(result.state));
    else this._state.set(null);
  }

  /** Where the signed-in person now stands, as an API call answered it (a request to join). */
  setAdmission(admission: TeachingRoomAdmission): void {
    this._admission.set(admission);
  }

  /** A state the page received another way (the teacher's own move): the newer one wins. */
  show(state: TeachingRoomState): void {
    this._state.update(current => newerState(current, state));
  }

  private async start(attempt: number): Promise<void> {
    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl(environment.apiUrl, 'teaching-room'), {
        accessTokenFactory: async () => (await this.session.getAccessToken()) ?? '',
        withCredentials: false
      })
      .withAutomaticReconnect()
      .configureLogging(environment.production ? LogLevel.None : LogLevel.Warning)
      .build();

    connection.on('currentItemChanged', (state: ApiTeachingRoomState) => {
      if (seesBoard(this._admission())) this.show(toState(state));
    });
    connection.on('admitted', (state: ApiTeachingRoomState) => {
      this._admission.set('approved');
      this.show(toState(state));
    });
    connection.on('removed', () => {
      this._admission.set('rejected');
      this._state.set(null);                                      // nothing of the board stays on screen
    });
    connection.on('joinRequestsChanged', () => this.events.joinRequestsChanged?.());
    connection.on('roomEnded', () => {
      this._ended.set(true);
      this._state.set(null);
      void this.stop();
    });
    connection.onreconnecting(() => this._connected.set(false));
    connection.onreconnected(() => {
      this._connected.set(true);
      void this.join().catch(() => undefined);                    // a new connection: back into the group, with the board as it is now
    });
    connection.onclose(() => this._connected.set(false));
    this.connection = connection;

    try {
      await connection.start();
    } catch {
      // Unreachable (or refused): automatic reconnect only covers a connection that was once up, so try again later,
      // backing off. A later successful start joins again, and so gets the current board.
      if (this.stopped || this.connection !== connection) return;
      this.connection = null;
      const delay = Math.min(MAX_RETRY_MS, 2_000 * 2 ** attempt);
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        if (!this.stopped && !this.connection) void this.start(attempt + 1);
      }, delay);
      return;
    }

    if (this.stopped || this.connection !== connection) {
      await connection.stop();                                    // the page closed meanwhile
      return;
    }
    this._connected.set(true);
    // a failed join leaves the page on the standing its own API read gave it; the next reconnect joins again
    await this.join().catch(() => undefined);
  }

  private async stop(): Promise<void> {
    this.stopped = true;
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
