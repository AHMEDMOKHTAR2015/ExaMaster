import { Injectable, inject } from '@angular/core';
import { ToastrService } from 'ngx-toastr';

/**
 * Notification service wrapping toastr for consistent notification display
 * Centralizes all toast notifications with configurable options
 */
@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly toastr = inject(ToastrService);

  /**
   * Display a success notification
   */
  success(message: string, title = 'Success'): void {
    this.toastr.success(message, title, {
      timeOut: 3000,
      progressBar: true,
      closeButton: true
    });
  }

  /**
   * Display an error notification
   */
  error(message: string, title = 'Error'): void {
    this.toastr.error(message, title, {
      timeOut: 5000,
      progressBar: true,
      closeButton: true
    });
  }

  /**
   * Display a warning notification
   */
  warning(message: string, title = 'Warning'): void {
    this.toastr.warning(message, title, {
      timeOut: 4000,
      progressBar: true,
      closeButton: true
    });
  }

  /**
   * Display an info notification
   */
  info(message: string, title = 'Info'): void {
    this.toastr.info(message, title, {
      timeOut: 3000,
      progressBar: true,
      closeButton: true
    });
  }

  /**
   * Clear all toasts
   */
  clear(): void {
    this.toastr.clear();
  }
}
