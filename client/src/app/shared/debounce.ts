import { DestroyRef } from '@angular/core';

/** How long a search box waits for typing to pause before asking the server. */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Run only the latest of a burst of calls, once `ms` pass without another —
 * for search boxes that query the server as people type, so a word is one
 * request rather than one per keystroke. A pending call is dropped when the
 * owner is destroyed.
 */
export function debounced(destroyRef: DestroyRef, ms = SEARCH_DEBOUNCE_MS): (action: () => void) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  destroyRef.onDestroy(() => {
    if (timer) clearTimeout(timer);
  });
  return action => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      action();
    }, ms);
  };
}
