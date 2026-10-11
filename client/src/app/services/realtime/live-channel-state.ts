import { Injectable, signal } from '@angular/core';

/**
 * Whether the live channel (SignalR) is up. `RealtimeService` writes it; the inbox and the Validation badge read it
 * to skip their safety-net polls while the server can tell them about changes itself. Its own service so they can
 * read it without injecting `RealtimeService`, which injects them.
 */
@Injectable({ providedIn: 'root' })
export class LiveChannelState {
  readonly connected = signal(false);
}
