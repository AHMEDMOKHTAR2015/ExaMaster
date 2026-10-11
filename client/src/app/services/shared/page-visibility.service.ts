import { DOCUMENT, DestroyRef, Injectable, inject, signal } from '@angular/core';

/**
 * Whether this tab is in front of someone (`document.visibilityState`). Background work that reads the API — the
 * safety-net polls — waits while it is hidden: a tab left open overnight must not keep the database awake.
 */
@Injectable({ providedIn: 'root' })
export class PageVisibilityService {
  private readonly document = inject(DOCUMENT);
  private readonly _visible = signal(this.isVisible());
  readonly visible = this._visible.asReadonly();

  constructor() {
    const onChange = () => this._visible.set(this.isVisible());
    this.document.addEventListener('visibilitychange', onChange);
    inject(DestroyRef).onDestroy(() => this.document.removeEventListener('visibilitychange', onChange));
  }

  private isVisible(): boolean {
    return this.document.visibilityState !== 'hidden';
  }
}
