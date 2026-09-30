import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { User, AdminRole, RegistrationKey, Tenant } from '../../models';
import { AuthErrorHandlerService } from './auth-error-handler.service';
import { AuthStateMixin, MixinBase } from './auth-mixins';
import { AdminAccessService } from '../admin';
import { EmailBuilder } from './user-builder';
import { TenantContextService } from '../tenant/tenant-context.service';
import { TenantService } from '../tenant/tenant.service';
import { keyProblemMessage } from './registration-key-policy';
import { resolvePostLoginRoute } from './post-login-route';
import { toAppTenant, toAppUser, toRegistrationKey } from './current-user.mapper';
import { ApiClient } from '../api/api-client.service';
import { ApiCurrentUser, ApiRegistrationKeyProblem } from '../api/api-models';
import { ServiceError } from '../shared/service-error';
import { AuthSessionService } from './auth-session.service';
import { NotificationService } from '../notification.service';

/**
 * Empty base class for mixin application
 */
class AuthServiceBase implements MixinBase {}

/**
 * Apply AuthStateMixin to base class for loading and error state management
 */
const AuthServiceWithState = AuthStateMixin(AuthServiceBase);

/**
 * Sign-in, sign-out and the signed-in person, as signals.
 *
 * The API is the identity provider: {@link AuthSessionService} holds the
 * session, and `GET /me` says who it belongs to — their profile, roles and
 * organization. On start, a session left by an earlier visit is restored.
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService extends AuthServiceWithState {
  private router = inject(Router);
  private errorHandler = inject(AuthErrorHandlerService);
  private adminAccessService = inject(AdminAccessService);
  private tenantContext = inject(TenantContextService);
  private tenantService = inject(TenantService);
  private api = inject(ApiClient);
  private session = inject(AuthSessionService);
  private notifications = inject(NotificationService);

  // What `GET /me` said about the signed-in account's registration key. The API
  // has already withheld every role when there is a problem; this is only kept
  // so the sign-in can say why before signing the account back out.
  private registrationKeyProblem: ApiRegistrationKeyProblem | null = null;

  // The key this account holds (a child holds their family's), from `GET /me`: the parent dashboard shows its allowance.
  private readonly _registrationKey = signal<RegistrationKey | null>(null);
  readonly registrationKey = this._registrationKey.asReadonly();

  private readonly _user = signal<User | null>(null);

  /** True while a sign-out is leaving the current page (see {@link endSession}); `guestGuard` lets it reach /login. */
  private signingOut = false;

  // True once the start-up restore has finished (a session restored, or there
  // was none). Deliberately separate from the mixin's `isLoading` — that signal
  // also toggles on every later sign-in/out call via `executeWithState`, so
  // app.component's full-page boot gate must key off this instead, or a routed
  // page (e.g. the login screen) gets torn down and recreated on every
  // subsequent auth action, silently losing its in-component state.
  private readonly _authInitialized = signal<boolean>(false);

  readonly user = this._user.asReadonly();
  readonly authReady = this._authInitialized.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  constructor() {
    super();
    this.setLoading(true);
    // The session can end on its own (expired, password changed elsewhere, signed out on
    // another device): leave the page the same way a sign-out does, and say why.
    this.session.ended.subscribe(() => {
      if (this._user()) void this.endSession('Your session has ended. Please sign in again.');
    });
    void this.restoreSession();
  }

  /**
   * The only writer of `_user`, so that the signed-in user, the tenant and the
   * organization shown in the shell (`TenantService`) can never disagree.
   *
   * Set synchronously rather than through an `effect()`: a guard resolves right
   * after `waitForAuthReady()` and may load data before effects flush.
   */
  private setCurrentUser(user: User | null, tenant: Tenant | null = null): void {
    this._user.set(user);
    this.tenantContext.setTenantId(user?.tenantId ?? null);
    this.tenantService.setTenant(user ? tenant : null);
    if (!user) this._registrationKey.set(null);
    this.tenantContext.setSignedOut(user === null);
  }

  /** Resolves once the start-up restore has finished (or after `timeoutMs`, so a slow server cannot hang a guard). */
  async waitForAuthReady(timeoutMs = 6000): Promise<void> {
    if (this._authInitialized()) return;
    await new Promise<void>(resolve => {
      const timeout = setTimeout(() => { clearInterval(check); resolve(); }, timeoutMs);
      const check = setInterval(() => {
        if (!this._authInitialized()) return;
        clearTimeout(timeout);
        clearInterval(check);
        resolve();
      }, 25);
    });
  }

  /**
   * Pick up a session left by an earlier visit. If it has ended (expired,
   * signed out elsewhere, password changed) the visitor is simply signed out.
   */
  private async restoreSession(): Promise<void> {
    try {
      if (!this.session.hasSession()) {
        this.setCurrentUser(null);
        return;
      }
      await this.loadCurrentUser();
      const refused = await this.admitCurrentUser();
      if (refused) {
        this.errorHandler.handleError(refused);
        return;
      }
      // `replaceUrl` because /login must not stay in history: back from a
      // dashboard would land on /login, which `guestGuard` bounces off again.
      if (this._user() && (this.router.url === '/login' || this.router.url === '/')) {
        this.router.navigate([this.getPostLoginRoute()], { replaceUrl: true });
      }
    } catch (error) {
      // The server is unreachable: keep the stored session for the next try, and start signed out.
      console.warn('Could not restore the session:', (error as Error)?.message);
      this.setCurrentUser(null);
    } finally {
      this._authInitialized.set(true);
      this.setLoading(false);
    }
  }

  /**
   * Why the just-loaded account may not proceed, or `null` when it may. Signs
   * it back out when it may not, so a deactivated account or a lapsed
   * Registration Key cannot hold a live session; the caller says why.
   */
  private async admitCurrentUser(): Promise<string | null> {
    const currentUser = this._user();
    if (!currentUser) return null;

    const problem = currentUser.active === false
      ? 'Account is deactivated.'
      : this.validateUserRegistrationKey(currentUser);
    if (!problem) return null;

    await this.session.signOut();
    this.setCurrentUser(null);
    return problem;
  }

  /**
   * Sign in with a mobile number (or an email) and password. A mobile number is
   * turned into the email it was registered under (`EmailBuilder`).
   *
   * `remember` is the "Remember me" checkbox: off, the session ends with the
   * tab — on shared school devices, the next person must not find it signed in.
   */
  async signInWithMobilePassword(emailOrMobile: string, password: string, remember = false): Promise<void> {
    return this.executeWithState(
      async () => {
        await this.session.signIn(EmailBuilder.fromMobile(emailOrMobile), password, remember);
        await this.loadCurrentUser();
        const refused = await this.admitCurrentUser();
        if (refused) throw new Error(refused);
        this.router.navigate([this.getPostLoginRoute()], { replaceUrl: true });
      },
      (error) => this.errorHandler.handleError(error).message
    );
  }

  /**
   * A parent registering with their family's registration key (its code). The
   * API creates the sign-in and the profile together, taking the role and the
   * organization from the key; this then signs in with it.
   */
  async registerParentWithMobile(params: { mobileNumber: string; password: string; firstName: string; lastName: string; registrationKeyId: string; }): Promise<void> {
    return this.executeWithState(
      async () => {
        const { email } = await this.api.post<{ userId: number; email: string }>('/registrations', {
          code: params.registrationKeyId,
          firstName: params.firstName,
          lastName: params.lastName,
          mobileNumber: params.mobileNumber,
          password: params.password
        });
        await this.signInAfterRegistration(email, params.password);
      },
      (error) => this.errorHandler.handleError(error).message
    );
  }

  /**
   * A child registering with their parent's key: a student account in the
   * key's organization, linked to the parent who claimed it, on one of that
   * family's slots. As above, the API does it all, then this signs in.
   */
  async registerChildFirstLogin(params: {
    mobileNumber: string;
    password: string;
    firstName: string;
    lastName: string;
    registrationKeyId: string;
    stageId: string;
    classId: string;
  }): Promise<void> {
    return this.executeWithState(
      async () => {
        const { email } = await this.api.post<{ userId: number; email: string }>('/registrations/child', {
          code: params.registrationKeyId,
          firstName: params.firstName,
          lastName: params.lastName,
          mobileNumber: params.mobileNumber,
          password: params.password,
          classId: Number(params.classId)
        });
        await this.signInAfterRegistration(email, params.password);
      },
      (error) => this.errorHandler.handleError(error).message
    );
  }

  private async signInAfterRegistration(email: string, password: string): Promise<void> {
    await this.session.signIn(email, password, false);
    await this.loadCurrentUser();
    const refused = await this.admitCurrentUser();
    if (refused) throw new Error(refused);
    this.router.navigate([this.getPostLoginRoute()], { replaceUrl: true });
  }

  /**
   * Replace the signed-in person's own password. The server ends every session
   * of the account when a password changes, this one included, so it signs
   * straight back in with the new one — keeping the "Remember me" choice.
   */
  async changeMyPassword(currentPassword: string, newPassword: string): Promise<void> {
    const email = this._user()?.email;
    if (!email) throw new Error('Sign in first.');
    const remembered = this.session.isRemembered();
    await this.api.put('/me/password', { currentPassword, newPassword });
    await this.session.signIn(email, newPassword, remembered);
  }

  async signOut(): Promise<void> {
    return this.executeWithState(
      () => this.endSession(),
      (error) => this.errorHandler.handleError(error).message
    );
  }

  /** Whether a sign-out is under way: `guestGuard` lets the still-signed-in user through to /login for it. */
  isSigningOut(): boolean {
    return this.signingOut;
  }

  /**
   * Leave the current page, then end the session.
   *
   * The order is load-bearing. The shell renders its signed-out layout the
   * moment the user clears, and that layout's `<router-outlet>` re-creates
   * whatever page is current — so clearing first rebuilt, say, Quizzes &
   * Homework with no session, and every load it starts in its constructor
   * failed with an error toast. Navigating first destroys the page while the
   * session still stands.
   */
  private async endSession(notice?: string): Promise<void> {
    if (this.signingOut) return;
    this.signingOut = true;
    try {
      await this.router.navigate(['/login'], { replaceUrl: true });
      await this.session.signOut();
      this.registrationKeyProblem = null;
      this.setCurrentUser(null);
      if (notice) this.notifications.info(notice, 'Signed out');
    } finally {
      this.signingOut = false;
    }
  }

  /**
   * The signed-in person's profile, roles and organization, from `GET /me`.
   *
   * A session whose account has no profile here (404), or one that has ended
   * (401), is signed out: there is nobody to show the app to.
   */
  private async loadCurrentUser(): Promise<void> {
    try {
      const me = await this.api.get<ApiCurrentUser>('/me');
      this.registrationKeyProblem = me.registrationKeyProblem;
      this._registrationKey.set(me.registrationKey ? toRegistrationKey(me.registrationKey, me.tenant?.slug) : null);
      this.setCurrentUser(toAppUser(me), toAppTenant(me.tenant));
    } catch (error) {
      if (error instanceof ServiceError && (error.code === '404' || error.code === '401')) {
        if (this._user()) {
          // Signed in on a page: leave it before clearing (see endSession).
          await this.endSession(error.code === '401' ? 'Your session has ended. Please sign in again.' : undefined);
        } else {
          this.registrationKeyProblem = null;
          this.session.clear();
          this.setCurrentUser(null);
        }
        if (error.code === '404') throw new Error('This account is not set up yet. Ask your school to finish it.');
        return;
      }
      throw error;
    }
  }

  /**
   * Check if user has completed a specific quiz
   */
  hasCompletedQuiz(quizId: number): boolean {
    const user = this._user();
    return (user?.completedQuizzes || []).some(q => q.quizId === quizId);
  }

  /**
   * Clear error state
   * Delegates to mixin's clearError and also clears the global error handler
   */
  override clearError(): void {
    super.clearError();
    this.errorHandler.clearError();
  }

  /**
   * Refresh the signed-in user from the API
   * Call this after completing quizzes/homework to ensure UI is updated
   */
  async refreshUserData(): Promise<void> {
    if (!this._user()) return;
    try {
      await this.loadCurrentUser();
    } catch (error) {
      console.error('Failed to refresh user data:', error);
    }
  }

  getUserRoles(): AdminRole[] {
    return this._user()?.roles ?? [];
  }

  /**
   * Validate the Registration Key bound to a user. For child accounts the key
   * is the parent's key, so an expired/inactive key must block the child sign-in
   * with a message that points at the parent.
   * Returns null when the key is valid (or there is none to check).
   */
  private validateUserRegistrationKey(user: User): string | null {
    return this.registrationKeyProblem
      ? keyProblemMessage(this.registrationKeyProblem, user.accountType === 'child' ? 'child' : 'self')
      : null;
  }

  /**
   * Determines the appropriate route after successful login based on user roles.
   * Parent Admins (userAdmin) get their own dedicated dashboard; other admin
   * roles (application admin, teacher) share admin-dashboard.
   */
  private getPostLoginRoute(): string {
    const roles = this.getUserRoles();
    return resolvePostLoginRoute(roles, this.adminAccessService.getStrategy(roles));
  }
}
