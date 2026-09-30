import { ErrorHandler, Injectable } from '@angular/core';
import { TenantUnavailableError } from '../services/tenant/tenant-context.service';

/**
 * The app's error boundary.
 *
 * Exists for one case: a load still in flight when the user signs out. The
 * admin screens start several reads at once and each is a chain of awaits — a
 * count, then a page, then the names that page needs — so signing out mid-chain
 * leaves the next link asking for a tenant that has just been cleared. That
 * surfaced as a wall of red `no tenant resolved for the current user` traces on
 * every logout.
 *
 * It cannot be caught where it is raised. A repository builds its path as an
 * *argument*: `paginateQuery(this.col(), …)` evaluates `col()` — and therefore
 * `requireTenantId()` — before `paginateQuery` is entered and before the
 * `run()` wrapper inside it can catch anything. The throw escapes every layer
 * of the repository's own handling by construction, which leaves the boundary.
 *
 * Only the `signed-out` reason is absorbed, and only into a debug line: the
 * work was abandoned because the person who asked for it has gone, so there is
 * nothing to report and nobody to report it to. A `TenantUnavailableError` with
 * any other reason means somebody is signed in without an organization, which
 * is a real defect and still goes through as an error.
 */
@Injectable()
export class AppErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    if (isAbandonedAfterSignOut(error)) {
      // Deliberately not `console.error`: this is expected, not a failure. Kept
      // visible at debug level so a genuine flood of them is still findable.
      console.debug('[auth] request abandoned after sign-out:', describe(error));
      return;
    }
    console.error(error);
  }
}

/**
 * Angular hands unhandled promise rejections over wrapped, with the original on
 * `rejection`, so both shapes have to be unwrapped before the check.
 */
function isAbandonedAfterSignOut(error: unknown): boolean {
  const unwrapped = unwrap(error);
  return unwrapped instanceof TenantUnavailableError && unwrapped.reason === 'signed-out';
}

function unwrap(error: unknown): unknown {
  const rejection = (error as { rejection?: unknown })?.rejection;
  return rejection ?? error;
}

function describe(error: unknown): string {
  const unwrapped = unwrap(error);
  return unwrapped instanceof TenantUnavailableError ? unwrapped.context : String(unwrapped);
}
