import { Component, DestroyRef, inject, signal, computed } from '@angular/core';

/**
 * Abstract base component providing common functionality for all components
 * Follows Single Responsibility Principle - handles only component lifecycle concerns
 */
@Component({
  template: ''
})
export abstract class BaseComponent {
  protected readonly destroyRef = inject(DestroyRef);
  
  // Common loading state using Angular signals
  protected readonly loading = signal<boolean>(false);
  protected readonly error = signal<string | null>(null);
  
  // Computed signal for checking if component has error
  protected readonly hasError = computed(() => this.error() !== null);
  
  /**
   * Set loading state
   */
  protected setLoading(isLoading: boolean): void {
    this.loading.set(isLoading);
    if (isLoading) {
      this.error.set(null);
    }
  }
  
  /**
   * Set error state
   */
  protected setError(errorMessage: string): void {
    this.error.set(errorMessage);
    this.loading.set(false);
  }
  
  /**
   * Clear error state
   */
  protected clearError(): void {
    this.error.set(null);
  }
  
  /**
   * Track by function for ngFor optimization
   */
  protected trackById<T extends { id: string | number }>(index: number, item: T): string | number {
    return item.id;
  }
}
