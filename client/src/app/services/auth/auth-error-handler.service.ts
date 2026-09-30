import { Injectable, inject, signal } from '@angular/core';
import { NotificationService } from '../notification.service';

/**
 * Authentication error codes mapping
 */
export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/popup-closed-by-user': 'Sign in was cancelled. Please try again.',
  'auth/popup-blocked': 'Popup was blocked. Please allow popups for this site.',
  'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method.',
  'auth/network-request-failed': 'Network error. Please check your connection.',
  'auth/cancelled-popup-request': 'Only one popup request allowed at a time.',
  'auth/invalid-email': 'Invalid email address format.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/wrong-password': 'Incorrect password. Please try again.',
  'auth/email-already-in-use': 'This email is already registered.',
  'auth/weak-password': 'Password is too weak. Please use a stronger password.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled.',
  'auth/requires-recent-login': 'Please sign in again to complete this action.',
  'auth/credential-already-in-use': 'This credential is already associated with another account.',
  'auth/invalid-credential': 'Invalid credentials. Please check and try again.',
  'auth/invalid-verification-code': 'Invalid verification code.',
  'auth/invalid-verification-id': 'Invalid verification ID.',
  'Database timeout': 'Database operation timed out. Please try again.',
  'Account is deactivated.': 'Account is deactivated.',
  'Registration key expired or inactive.': 'Registration key expired or inactive.',
  'Invalid registration key': 'Invalid registration key.',
  'Failed to consume registration key': 'Failed to consume registration key.',
  'First name and last name are required': 'First name and last name are required.',
  'Invalid mobile number': 'Invalid mobile number format.',
  'Failed to create child user': 'Failed to create child user account.'
};

/**
 * Custom error class for authentication errors
 */
export class AuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'AuthError';
    Object.setPrototypeOf(this, AuthError.prototype);
  }

  static fromFirebaseError(error: unknown): AuthError {
    const err = error as { code?: string; message?: string };
    const code = err?.code || 'unknown';
    const message = AUTH_ERROR_MESSAGES[code] || err?.message || 'An unexpected error occurred.';
    return new AuthError(code, message, error);
  }

  static fromMessage(message: string): AuthError {
    return new AuthError(message, AUTH_ERROR_MESSAGES[message] || message);
  }
}

/**
 * Global authentication error handler service
 * Centralizes error handling, logging, and user notifications
 */
@Injectable({
  providedIn: 'root'
})
export class AuthErrorHandlerService {
  private readonly notificationService = inject(NotificationService);
  
  // Global error state signal
  private readonly _lastError = signal<AuthError | null>(null);
  readonly lastError = this._lastError.asReadonly();

  /**
   * Handle an authentication error globally
   * @param error The error to handle
   * @param showNotification Whether to show a toast notification (default: true)
   * @returns The processed AuthError
   */
  handleError(error: unknown, showNotification = true): AuthError {
    const authError = this.normalizeError(error);
    
    // Log error for debugging
    console.error('[AuthError]', {
      code: authError.code,
      message: authError.message,
      originalError: authError.originalError
    });

    // Set global error state
    this._lastError.set(authError);

    // Show notification if enabled
    if (showNotification) {
      this.notificationService.error(authError.message, 'Authentication Error');
    }

    return authError;
  }

  /**
   * Normalize any error into an AuthError
   */
  private normalizeError(error: unknown): AuthError {
    if (error instanceof AuthError) {
      return error;
    }

    if (error instanceof Error) {
      // Check if it's a Firebase error with a code
      if ('code' in error) {
        return AuthError.fromFirebaseError(error);
      }
      // Check if message matches known error messages
      if (AUTH_ERROR_MESSAGES[error.message]) {
        return AuthError.fromMessage(error.message);
      }
      return new AuthError('unknown', error.message, error);
    }

    if (typeof error === 'string') {
      return AuthError.fromMessage(error);
    }

    if (typeof error === 'object' && error !== null && 'code' in error) {
      return AuthError.fromFirebaseError(error);
    }

    return new AuthError('unknown', 'An unexpected error occurred.', error);
  }

  /**
   * Get user-friendly error message for an error code
   */
  getErrorMessage(errorCode: string): string {
    return AUTH_ERROR_MESSAGES[errorCode] || 'An unexpected error occurred. Please try again.';
  }

  /**
   * Clear the last error
   */
  clearError(): void {
    this._lastError.set(null);
  }

  /**
   * Check if we should fall back to redirect auth based on error
   */
  shouldUseRedirect(error: unknown): boolean {
    const authError = this.normalizeError(error);
    // Don't redirect if multiple popups were triggered
    if (authError.code === 'auth/cancelled-popup-request') {
      return false;
    }
    // Redirect for all other popup-related errors
    return true;
  }
}

