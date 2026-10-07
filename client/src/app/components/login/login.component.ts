import { Component, signal, inject, ChangeDetectionStrategy, ElementRef } from '@angular/core';
import { AnimationEvent } from '@angular/animations';

import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LoadingButtonDirective } from '../../directives';
import { AuthService } from '../../services/auth';
import { NotificationService } from '../../services/notification.service';
import { LanguageService } from '../../services/language.service';
import { AccessRequestService } from '../../services/access-requests/access-request.service';
import { ServiceError } from '../../services/shared/service-error';
import { AccessRequestInput, AccessRequestKind } from '../../models';
import { BaseComponent } from '../../shared/base';
import { fadeIn, slideInUp, scaleIn, shake, pulse, staggerList, crossFade } from '../../shared/animations';
import { MIN_PASSWORD_LENGTH } from '../../shared/password-policy';

/** Which face of the card is showing. */
type LoginView = 'signIn' | 'requestAccess' | 'requestSent';

type RequestForm = Omit<AccessRequestInput, 'kind'> & { confirmPassword: string };

const EMPTY_REQUEST: RequestForm = {
  firstName: '', lastName: '', mobileNumber: '', password: '', confirmPassword: '',
  email: '', schoolName: '', gradeName: '', parentName: '', parentMobileNumber: '', note: ''
};

/** Mirrors the API's rules (SignInEmail, PasswordPolicy, AccessRequest), so most mistakes are caught before a round trip. */
const MIN_MOBILE_DIGITS = 4;
const MAX_CHILDREN_COUNT = 50;

/**
 * Sign in, or — for a visitor with no account and no registration key — ask
 * to join as a parent or a child. The request is reviewed by the platform
 * administrator, who places the account in a school; the visitor then signs
 * in with the mobile number and password they chose here.
 */
@Component({
    selector: 'app-login',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, TranslatePipe, LoadingButtonDirective],
    templateUrl: './login.component.html',
    animations: [fadeIn, slideInUp, scaleIn, shake, pulse, staggerList, crossFade]
})
export class LoginComponent extends BaseComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  private readonly notificationService = inject(NotificationService);
  private readonly accessRequests = inject(AccessRequestService);
  private readonly translate = inject(TranslateService);
  readonly lang = inject(LanguageService);
  
  // UI state signals
 
  readonly shakeError = signal<boolean>(false);

  readonly email = signal<string>('');
  readonly password = signal<string>('');
  readonly showPassword = signal<boolean>(false);
  readonly rememberMe = signal<boolean>(false);
  /** There is no reset email (a child has no mailbox): the link says who can set a new password instead. */
  readonly showForgotHint = signal<boolean>(false);

  // --- request access --------------------------------------------------------
  readonly view = signal<LoginView>('signIn');
  readonly requestKind = signal<AccessRequestKind>('parent');
  readonly request = signal<RequestForm>({ ...EMPTY_REQUEST });
  readonly requestError = signal<string | null>(null);
  readonly isSubmittingRequest = signal<boolean>(false);
  readonly showRequestPassword = signal<boolean>(false);

  /** Angular animations ignore the OS setting, so the swap is made instant here when motion is unwanted. */
  readonly reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

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

  openRequestAccess(): void {
    this.dismissError();
    this.requestError.set(null);
    this.view.set('requestAccess');
  }

  /** Back to sign-in. After a request was sent, the mobile number is filled in for when it is approved. */
  backToSignIn(): void {
    if (this.view() === 'requestSent') {
      this.email.set(this.request().mobileNumber.trim());
      this.password.set('');
      this.request.set({ ...EMPTY_REQUEST });
    }
    this.requestError.set(null);
    this.view.set('signIn');
  }

  /** A number input hands over '' or null while it is empty; the form keeps "not given yet" as undefined. */
  setChildrenCount(value: number | string | null): void {
    this.setRequestField('childrenCount', value === null || value === '' ? undefined : Number(value));
  }

  setRequestField<K extends keyof RequestForm>(field: K, value: RequestForm[K]): void {
    this.request.update(form => ({ ...form, [field]: value }));
  }

  /**
   * After a swap (immediately when animations are off), focus moves to the new
   * view's heading, so keyboard and screen-reader users land in the new form
   * rather than on a button that no longer exists. Not on the first render.
   */
  onViewShown(event: AnimationEvent): void {
    if (event.fromState === 'void') return;
    this.host.nativeElement.querySelector<HTMLElement>(`[data-view-heading="${this.view()}"]`)?.focus();
  }

  async submitRequest(): Promise<void> {
    if (this.isSubmittingRequest()) return;
    const problem = this.validateRequest();
    if (problem) {
      this.requestError.set(this.translate.instant(problem));
      return;
    }

    const { confirmPassword: _, ...form } = this.request();
    this.requestError.set(null);
    this.isSubmittingRequest.set(true);
    try {
      await this.accessRequests.submit({ ...form, kind: this.requestKind() });
      this.view.set('requestSent');
    } catch (error) {
      // The API words its refusals for people ("already has an account", "already waiting").
      this.requestError.set(error instanceof ServiceError ? error.message : this.translate.instant('auth.requestAccess.errors.failed'));
    } finally {
      this.isSubmittingRequest.set(false);
    }
  }

  /** The first problem with the form, as a translation key; `null` when it can be sent. */
  private validateRequest(): string | null {
    const form = this.request();
    if (!form.firstName.trim() || !form.lastName.trim()) return 'auth.requestAccess.errors.name';
    if (form.mobileNumber.replace(/\D/g, '').length < MIN_MOBILE_DIGITS) return 'auth.requestAccess.errors.mobile';
    if (!form.schoolName?.trim()) return 'auth.requestAccess.errors.school';
    if (this.requestKind() === 'child' && !form.gradeName?.trim()) return 'auth.requestAccess.errors.grade';
    if (this.requestKind() === 'parent') {
      const count = form.childrenCount;
      if (count === undefined || !Number.isInteger(count) || count < 1 || count > MAX_CHILDREN_COUNT) return 'auth.requestAccess.errors.childrenCount';
    }
    if (form.password.length < MIN_PASSWORD_LENGTH) return 'auth.requestAccess.errors.password';
    if (form.password !== form.confirmPassword) return 'auth.requestAccess.errors.passwordMismatch';
    if (this.requestKind() === 'parent' && form.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return 'auth.requestAccess.errors.email';
    }
    return null;
  }
}
