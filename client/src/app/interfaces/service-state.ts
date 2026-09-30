import { Signal } from '@angular/core';

/** Marker interface for mixin-enabled classes. */
export interface MixinBase {
  // Marker interface for mixin-enabled classes
}

/** Interface for classes with loading behavior. */
export interface WithLoading {
  readonly isLoading: Signal<boolean>;
  setLoading(loading: boolean): void;
  withLoading<T>(operation: () => Promise<T>): Promise<T>;
}

/** Interface for classes with error handling behavior. */
export interface WithErrorHandling {
  readonly error: Signal<string | null>;
  setError(error: string | null): void;
  clearError(): void;
  withErrorHandling<T>(
    operation: () => Promise<T>,
    errorTransformer?: (error: unknown) => string
  ): Promise<T>;
}

/** Interface for classes with combined loading and error handling. */
export interface WithServiceState extends WithLoading, WithErrorHandling {
  executeWithState<T>(
    operation: () => Promise<T>,
    errorTransformer?: (error: unknown) => string
  ): Promise<T>;
}
