import { Injectable, signal } from '@angular/core';

/**
 * The tenant the signed-in user belongs to, resolved once at sign-in and read
 * by every Firestore repository to scope its collection paths.
 *
 * Deliberately has no dependencies of its own. The obvious shape —
 * `computed(() => authService.user()?.tenantId)` — would make
 * `firestore-repository.ts` import `AuthService`, which imports the
 * `services/admin` barrel, which re-exports repositories that extend
 * `FirestoreRepository`: a module cycle that fails at class-extends time. So
 * the data flows the other way instead, with `AuthService` as the sole writer
 * (see `AuthService.setCurrentUser`).
 *
 * Like `roles`, the value comes from the user's own `users/{uid}` document
 * rather than a custom auth claim, so moving a user between organizations —
 * or out of one — takes effect on their next request instead of waiting for an
 * ID token to refresh.
 */
/**
 * Thrown when a repository asks for the tenant and there isn't one.
 *
 * A distinct type because the same absence means two very different things, and
 * only one of them is a fault:
 *
 * - `signed-out` — the user left while a load was still in flight. Expected:
 *   an async chain started before sign-out resumes afterwards, asks for the
 *   next page, and finds the session gone. There is no correct answer and
 *   nobody to show one to, so the right response is to abandon the work
 *   quietly.
 * - `unresolved` — somebody is signed in but carries no `tenantId`. That is a
 *   real defect (an incomplete backfill, a user document written by hand), and
 *   it must stay loud.
 */
export class TenantUnavailableError extends Error {
  constructor(
    readonly context: string,
    readonly reason: 'signed-out' | 'unresolved'
  ) {
    super(
      reason === 'signed-out'
        ? `${context}: the session ended before this request could run.`
        : `${context}: no tenant resolved for the current user.`
    );
    this.name = 'TenantUnavailableError';
    Object.setPrototypeOf(this, TenantUnavailableError.prototype);
  }
}

/**
 * Whether a failure is explained by the session having ended rather than by
 * anything being wrong.
 *
 * Signing out clears the tenant synchronously, and the app shell swaps its
 * `router-outlet` the moment `isAuthenticated()` flips — which re-creates
 * whatever admin screen was open, against the route that is still active until
 * the navigation to `/login` completes. That fresh instance loads in its
 * constructor, hits `requireTenantId()` with nothing there, and fails. It is
 * expected, the user is already on their way to the login screen, and nothing
 * they could do would change it, so it must not be reported as an error.
 *
 * Deliberately narrow: only the `signed-out` reason. `unresolved` means a
 * signed-in user whose tenant genuinely failed to resolve, which is a real
 * fault and must still surface.
 */
export function isSessionEndedError(error: unknown): boolean {
  return error instanceof TenantUnavailableError && error.reason === 'signed-out';
}

@Injectable({ providedIn: 'root' })
export class TenantContextService {
  private readonly _tenantId = signal<string | null>(null);

  /**
   * Whether a session has ended.
   *
   * `_tenantId` alone cannot say: it is `null` both before anyone signs in and
   * after they sign out, and those two need different treatment (see
   * {@link TenantUnavailableError}). Set by the same `AuthService` writer, so it
   * can never disagree with the tenant it sits beside.
   */
  private readonly _signedOut = signal<boolean>(false);

  /** The current tenant, or `null` when signed out or not yet resolved. */
  readonly tenantId = this._tenantId.asReadonly();

  /** Called only by `AuthService`, whenever the signed-in user changes. */
  setTenantId(tenantId: string | null): void {
    this._tenantId.set(tenantId);
  }

  /**
   * Called only by `AuthService`, alongside {@link setTenantId}, to record
   * whether the absence of a tenant is because the user left.
   */
  setSignedOut(signedOut: boolean): void {
    this._signedOut.set(signedOut);
  }

  /** True when there is a tenant to build a path from. Never throws. */
  hasTenant(): boolean {
    return this._tenantId() !== null;
  }

  /**
   * The current tenant, or a thrown error when there isn't one.
   *
   * Callers build Firestore paths from the result, so returning a placeholder
   * for a missing tenant would silently point reads and writes at the wrong
   * subtree. Failing loudly is the only safe option.
   *
   * @param context label of the calling service, for the error message.
   */
  requireTenantId(context: string): string {
    const tenantId = this._tenantId();
    if (!tenantId) {
      throw new TenantUnavailableError(context, this._signedOut() ? 'signed-out' : 'unresolved');
    }
    return tenantId;
  }
}
