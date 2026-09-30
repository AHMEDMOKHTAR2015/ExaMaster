import { Component, inject, ChangeDetectionStrategy } from '@angular/core';

import { LoadingService } from '../../services/loading.service';

/**
 * Global loading spinner component
 * Displays an overlay with spinner when HTTP requests are in progress
 */
@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    @if (loadingService.isLoading()) {
      <div class="loading-overlay">
        <div class="spinner-container">
          <div class="spinner"></div>
          <span class="loading-text">Loading...</span>
        </div>
      </div>
    }
  `,
  styles: [`
    .loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.4);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
      backdrop-filter: blur(2px);
    }

    .spinner-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      background: white;
      padding: 2rem 3rem;
      border-radius: 0.75rem;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    }

    .spinner {
      width: 3.125rem;
      height: 3.125rem;
      border: 4px solid #e0e0e0;
      border-top-color: #6366f1;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    .loading-text {
      color: #374151;
      font-size: 0.95rem;
      font-weight: 500;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `]
})
export class LoadingSpinnerComponent {
  readonly loadingService = inject(LoadingService);
}
