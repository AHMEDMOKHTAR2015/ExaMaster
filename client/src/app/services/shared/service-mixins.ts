import { inject, signal, Signal, WritableSignal } from '@angular/core';
import { LoadingService } from '../loading.service';
import { MixinBase, WithLoading, WithErrorHandling, WithServiceState } from '../../interfaces';

// Re-exported so existing `import { MixinBase, ServiceStateMixin } from '.../service-mixins'`
// call sites (the mixin contract alongside the mixin that implements it) keep working —
// the declarations themselves now live in ../../interfaces.
export { MixinBase, WithLoading, WithErrorHandling, WithServiceState };

/**
 * Type for a constructor function
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Constructor<T = object> = new (...args: any[]) => T;

// ============================================================================
// Loading Behavior Mixin
// ============================================================================

/**
 * Mixin that adds loading state management to a class
 * Provides reactive loading signals and helper methods for async operations
 */
export function LoadingMixin<TBase extends Constructor<MixinBase>>(Base: TBase) {
  return class extends Base implements WithLoading {
    private readonly _isLoadingSignal: WritableSignal<boolean> = signal(false);
    readonly isLoading: Signal<boolean> = this._isLoadingSignal.asReadonly();

    setLoading(loading: boolean): void {
      this._isLoadingSignal.set(loading);
    }

    /**
     * Execute an async operation with automatic loading state management
     */
    async withLoading<T>(operation: () => Promise<T>): Promise<T> {
      this._isLoadingSignal.set(true);
      try {
        return await operation();
      } finally {
        this._isLoadingSignal.set(false);
      }
    }
  };
}

// ============================================================================
// Error Handling Mixin
// ============================================================================

/**
 * Mixin that adds error state management to a class
 * Provides reactive error signals and helper methods for error handling
 */
export function ErrorHandlingMixin<TBase extends Constructor<MixinBase>>(Base: TBase) {
  return class extends Base implements WithErrorHandling {
    private readonly _errorSignal: WritableSignal<string | null> = signal(null);
    readonly error: Signal<string | null> = this._errorSignal.asReadonly();

    setError(error: string | null): void {
      this._errorSignal.set(error);
    }

    clearError(): void {
      this._errorSignal.set(null);
    }

    /**
     * Execute an async operation with automatic error handling
     */
    async withErrorHandling<T>(
      operation: () => Promise<T>,
      errorTransformer?: (error: unknown) => string
    ): Promise<T> {
      this._errorSignal.set(null);
      try {
        return await operation();
      } catch (error) {
        const message = errorTransformer
          ? errorTransformer(error)
          : error instanceof Error
            ? error.message
            : 'An unexpected error occurred';
        this._errorSignal.set(message);
        throw error;
      }
    }
  };
}

// ============================================================================
// Combined Service State Mixin
// ============================================================================

/**
 * Mixin that combines loading and error handling behaviors
 * Provides a unified method for executing async operations with state management
 */
export function ServiceStateMixin<TBase extends Constructor<MixinBase>>(Base: TBase) {
  // Apply both mixins
  const WithLoadingAndError = ErrorHandlingMixin(LoadingMixin(Base));

  return class extends WithLoadingAndError implements WithServiceState {
    /**
     * Global loading counter — every executeWithState call increments on entry and
     * decrements on exit, so the app-wide LoadingSpinnerComponent appears whenever
     * ANY service operation is in flight. The HTTP interceptor handles HttpClient
     * traffic; this handles every Firebase Firestore/Auth call (which doesn't go through
     * HttpClient at all).
     *
     * Resolved via `inject()` at construction time, which is valid here because
     * services using this mixin are themselves @Injectable and constructed inside
     * Angular's injection context.
     */
    private readonly _globalLoadingService = inject(LoadingService);

    /**
     * Execute an async operation with combined loading and error state management.
     * Also drives the global loading spinner via LoadingService.
     */
    async executeWithState<T>(
      operation: () => Promise<T>,
      errorTransformer?: (error: unknown) => string
    ): Promise<T> {
      this.setLoading(true);
      this.clearError();
      this._globalLoadingService.show();
      try {
        const result = await operation();
        return result;
      } catch (error) {
        const message = errorTransformer
          ? errorTransformer(error)
          : error instanceof Error
            ? error.message
            : 'An unexpected error occurred';
        this.setError(message);
        throw error;
      } finally {
        this.setLoading(false);
        this._globalLoadingService.hide();
      }
    }
  };
}

