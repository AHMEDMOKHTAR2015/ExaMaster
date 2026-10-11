import { DestroyRef, effect, inject, untracked } from '@angular/core';
import { PageVisibilityService } from './page-visibility.service';
import { LiveChannelState } from '../realtime/live-channel-state';

export interface SafetyNetPollOptions {
  /** Time between reads while the poll runs, in ms. */
  intervalMs: number;
  /** Whether there is anything to poll for (someone signed in with the right role). Read in a reactive context. */
  active: () => boolean;
  /** True when the live channel also signals this count's changes: then the poll runs only while it is down. */
  coveredByLiveChannel: boolean;
  refresh: () => void;
}

/**
 * The slow poll behind a live count (the inbox, the Validation badge, pending access requests), kept off the API —
 * and so off the database — while it cannot matter: it runs only while `active()`, while the tab is visible, and,
 * for a count the live channel covers, while that channel is down. When the tab comes back into view it reads once,
 * so a returning user sees what changed while they were away.
 *
 * Why it matters: Azure SQL serverless pauses only after a stretch with no queries, so one tab left open with a
 * five-minute timer kept the database (and its bill) running around the clock.
 *
 * Call from an injection context (a constructor).
 */
export function safetyNetPoll(options: SafetyNetPollOptions): void {
  const visibility = inject(PageVisibilityService);
  const liveChannel = inject(LiveChannelState);
  let timer: ReturnType<typeof setInterval> | null = null;
  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };

  effect(() => {
    const run = options.active() && visibility.visible() && !(options.coveredByLiveChannel && liveChannel.connected());
    untracked(() => {
      stop();
      if (run) timer = setInterval(() => options.refresh(), options.intervalMs);
    });
  });

  let wasVisible = untracked(visibility.visible);
  effect(() => {
    const visible = visibility.visible();
    untracked(() => {
      if (visible && !wasVisible && options.active()) options.refresh();
      wasVisible = visible;
    });
  });

  inject(DestroyRef).onDestroy(stop);
}
