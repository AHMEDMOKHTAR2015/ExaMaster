
import { Component, signal, inject, ChangeDetectionStrategy } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LoadingButtonDirective } from '../../directives';
import { AuthService } from '../../services/auth';
import { NotificationService } from '../../services/notification.service';
import { LanguageService } from '../../services/language.service';
import { BaseComponent } from '../../shared/base';
import { fadeIn, slideInUp, scaleIn, shake, pulse, staggerList } from '../../shared/animations';

/**
 * Modern login component with social authentication
 * Extends BaseComponent for common functionality
 */
@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslatePipe, LoadingButtonDirective],
  templateUrl: './login.component.html',
  animations: [fadeIn, slideInUp, scaleIn, shake, pulse, staggerList]
})
export class LoginComponent extends BaseComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  private readonly notificationService = inject(NotificationService);
  readonly lang = inject(LanguageService);
  
  // UI state signals
 
  readonly shakeError = signal<boolean>(false);

  readonly email = signal<string>('');
  readonly password = signal<string>('');
  readonly showPassword = signal<boolean>(false);
  readonly rememberMe = signal<boolean>(false);
  /** There is no reset email (a child has no mailbox): the link says who can set a new password instead. */
  readonly showForgotHint = signal<boolean>(false);

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }

  async signInWithMobilePassword(): Promise<void> {
    if (this.loading()) return;
    this.clearError();
    this.setLoading(true);
    try {
      await this.authService.signInWithMobilePassword(
        this.email(),
        this.password(),
        this.rememberMe()
      );
    } catch {
      this.handleAuthError();
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Handle authentication errors with shake animation
   */
  private handleAuthError(): void {
    const message = this.authService.error() || 'Authentication failed. Please try again.';
    this.setError(message);
    this.notificationService.error(message);
    this.triggerShake();
  }
  
  /**
   * Trigger shake animation for errors
   */
  private triggerShake(): void {
    this.shakeError.set(true);
    setTimeout(() => this.shakeError.set(false), 500);
  }
  
  /**
   * Dismiss error message
   */
  dismissError(): void {
    this.clearError();
    this.authService.clearError();
  }
}
