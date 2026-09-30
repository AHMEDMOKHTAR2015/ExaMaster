import { Injectable, signal, computed } from '@angular/core';

/**
 * Loading service for centralized loading state management
 * Used by the HTTP interceptor to show/hide global loading spinner
 */
@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  // Track number of active requests for concurrent request handling
  private readonly _activeRequests = signal<number>(0);
  
  // Public loading state - true when any request is in progress
  readonly isLoading = computed(() => this._activeRequests() > 0);

  /**
   * Increment active request count (called when request starts)
   */
  show(): void {
    this._activeRequests.update(count => count + 1);
  }

  /**
   * Decrement active request count (called when request completes)
   */
  hide(): void {
    this._activeRequests.update(count => Math.max(0, count - 1));
  }

  /**
   * Reset loading state (force hide all)
   */
  reset(): void {
    this._activeRequests.set(0);
  }
}
