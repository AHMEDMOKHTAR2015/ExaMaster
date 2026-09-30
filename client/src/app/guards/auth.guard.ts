import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService, resolvePostLoginRoute, STUDENT_HOME_ROUTE } from '../services/auth';
import { AdminAccessService } from '../services/admin';

/**
 * Where a signed-in user belongs when a guard denies them the route they
 * asked for.
 *
 * Every guard below used to hardcode `/available-quizzes` here — the correct
 * landing page for a child, but wrong for every admin role, a teacher, or the
 * vendor's `platformAdmin`. That mismatch is exactly what sent an application
 * admin to `/available-quizzes` after pressing the browser's back button on
 * `/admin-dashboard`: back landed on `/login`, `guestGuard` saw an already
 * authenticated user and denied it, and its hardcoded fallback ignored the
 * admin's role entirely. `resolvePostLoginRoute` is the same function login
 * itself uses to pick a destination — reusing it here keeps "where does this
 * user belong" in one place instead of a parallel guess per guard.
 */
function roleHomeRoute(authService: AuthService, adminAccess: AdminAccessService): string {
  const roles = authService.getUserRoles();
  return resolvePostLoginRoute(roles, adminAccess.getStrategy(roles));
}

/**
 * Builds a guard for a route that is somebody's landing page rather than a
 * page reached by deliberate in-app navigation — `/available-quizzes`,
 * `/parent-dashboard` and `/admin-dashboard` are the three today. Allowed only
 * when `resolvePostLoginRoute` resolves to exactly this path; anyone else is
 * sent wherever it does resolve, never shown the page and never just denied.
 *
 * This exists because a capability check is the wrong tool for "is this your
 * landing page" — a role can legitimately have a capability (`canManageChildren`,
 * `canAccessAdminDashboard`) without that page being where it *lives*, and the
 * two questions drifting apart is exactly how an application admin ended up
 * rendered on the parent dashboard (see `userAdminGuard`). A landing page has
 * exactly one authority on who it belongs to: `resolvePostLoginRoute`, the
 * same function login itself calls — so every guard built from this factory
 * reads that answer instead of keeping its own opinion of it.
 */
function homeRouteGuard(path: string): CanActivateFn {
  return async () => {
    const authService = inject(AuthService);
    const adminAccess = inject(AdminAccessService);
    const router = inject(Router);

    await authService.waitForAuthReady();

    if (!authService.isAuthenticated()) {
      return router.createUrlTree(['/login']);
    }

    const home = roleHomeRoute(authService, adminAccess);
    return home === path ? true : router.createUrlTree([home]);
  };
}

/**
 * Auth guard to protect routes requiring authentication
 * Optimized: Check auth state synchronously when available
 *
 * Answers "is anyone signed in", never "is it the right person", so it fits
 * only a route every signed-in role may open. No route needs that today —
 * `/available-quizzes` and `/quiz/:id` were the last two and they were wrong
 * for it (see `studentGuard`). Reach for the role guard that matches the page
 * before reaching for this one.
 */
export const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Wait for auth with reduced timeout
  await authService.waitForAuthReady();
  
  if (authService.isAuthenticated()) {
    return true;
  }

  // Redirect to login if not authenticated
  return router.createUrlTree(['/login']);
};

/**
 * Guards the quiz-taking routes: `/available-quizzes` and `/quiz/:id`.
 *
 * Both carried `authGuard` alone, which asks whether *someone* is signed in
 * and never who. Browser history outlives a sign-out, so once a student had
 * used the machine, Back after the next person signed in replayed the previous
 * session's URL and this was waved through — an application admin got the
 * student dashboard rendered for them. `/quiz/:id` is the sharper edge of the
 * same hole: it starts a real attempt, so an admin landing there would be
 * graded and written into `participations` as a participant.
 *
 * "May take quizzes" is deliberately not a new `AdminRoleStrategy` method —
 * every method on that interface answers what an admin may do inside a tenant,
 * and this is the absence of all of them. See `homeRouteGuard` for the check
 * this actually runs.
 */
export const studentGuard: CanActivateFn = homeRouteGuard(STUDENT_HOME_ROUTE);

/**
 * Guest guard - redirects authenticated users away from login page
 * Optimized: Check auth state synchronously when available
 */
export const guestGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const adminAccess = inject(AdminAccessService);
  const router = inject(Router);

  // Wait for auth with reduced timeout
  await authService.waitForAuthReady();

  // Signed out, or signing out: a sign-out moves to /login *before* it clears
  // the user (see AuthService.endSession), so it must be let through here.
  if (!authService.isAuthenticated() || authService.isSigningOut()) {
    return true;
  }

  // Already signed in — send them to their own landing page, not a route
  // that only makes sense for a child.
  return router.createUrlTree([roleHomeRoute(authService, adminAccess)]);
};

/**
 * Guards `/parent-dashboard`, a parent's landing page and nobody else's.
 *
 * Used to allow through anyone whose strategy answered `canAccessUserAdmin()`
 * — true for `ApplicationAdminStrategy` too, on the theory that an app admin's
 * full access to child management (`canManageChildren()`, still true today)
 * meant they should never be denied this page either. But nothing in the app
 * ever sends an app admin here — the sidebar's "Dashboard" link, the CTA, every
 * deliberate route all point at `/admin-dashboard` — so `canAccessUserAdmin()`
 * had exactly one caller: this guard. The only way to actually reach
 * `/parent-dashboard` as an app admin was the bug this fixes: log in as a
 * parent, log out, log in as an app admin, press Back twice. The guard saw an
 * authenticated user with a capability it was willing to accept and let a
 * second identity's dashboard render for the first, with the current admin's
 * own (empty) data behind it.
 *
 * A capability a role happens to hold is not the same question as whether a
 * page is that role's home, and `canAccessUserAdmin()` was deleted from
 * `AdminRoleStrategy` once this became its only caller — see `homeRouteGuard`.
 */
export const userAdminGuard: CanActivateFn = homeRouteGuard('/parent-dashboard');

/**
 * Guards the Parent/User Admin's participation-history page.
 *
 * Backed by `canViewChildParticipations()`, a capability check — unlike
 * `/parent-dashboard` itself (see `userAdminGuard`), this route is a sub-page
 * a parent navigates to deliberately, never anyone's landing page, so
 * `homeRouteGuard`'s "is this your home" test does not apply here.
 * `canViewChildParticipations()` happens to share a truth table with the
 * deleted `canAccessUserAdmin()` today only because no strategy has split
 * them yet.
 */
export const childParticipationHistoryGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const adminAccess = inject(AdminAccessService);
  const router = inject(Router);

  await authService.waitForAuthReady();

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  const strategy = adminAccess.getStrategy(authService.getUserRoles());
  if (strategy.canViewChildParticipations()) {
    return true;
  }

  return router.createUrlTree([roleHomeRoute(authService, adminAccess)]);
};

export const applicationAdminGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const adminAccess = inject(AdminAccessService);
  const router = inject(Router);

  await authService.waitForAuthReady();

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  const strategy = adminAccess.getStrategy(authService.getUserRoles());
  if (strategy.canAccessApplicationAdmin()) {
    return true;
  }

  return router.createUrlTree([roleHomeRoute(authService, adminAccess)]);
};

/**
 * Teacher guard - restricts a route to the teacher role.
 *
 * Backed by `canAccessTeacherDashboard()`, which is true only for teachers
 * (application/user admins have their own tools), so teacher-scoped pages like
 * Quiz Management resolve a /teachers record from the signed-in user.
 */
export const teacherGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const adminAccess = inject(AdminAccessService);
  const router = inject(Router);

  await authService.waitForAuthReady();

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  const strategy = adminAccess.getStrategy(authService.getUserRoles());
  if (strategy.canAccessTeacherDashboard()) {
    return true;
  }

  return router.createUrlTree([roleHomeRoute(authService, adminAccess)]);
};

/**
 * Guards `/admin-dashboard`, the landing page shared by application admins
 * and teachers (rendered as two different views inside the same shell — see
 * `AdminDashboardComponent`). A parent (`userAdmin`) lands on
 * `/parent-dashboard` instead and a child on `/available-quizzes`; both
 * redirects — like the vendor's `platformAdmin` one — fall out of
 * `resolvePostLoginRoute` rather than being special-cased here.
 */
export const adminDashboardGuard: CanActivateFn = homeRouteGuard('/admin-dashboard');

/**
 * The vendor's own screen for onboarding and suspending client organizations.
 *
 * Checks the role directly rather than going through `AdminAccessService`,
 * which is deliberate: every method on `AdminRoleStrategy` answers "what may I
 * do inside my own organization", and `platformAdmin` belongs to none. Routing
 * it through that interface would mean eleven meaningless `false`s and would
 * blur the one distinction that matters here — the vendor is not a customer's
 * administrator, and a customer's administrator is not the vendor.
 */
export const platformAdminGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const adminAccess = inject(AdminAccessService);
  const router = inject(Router);

  await authService.waitForAuthReady();

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }
  if (authService.getUserRoles().includes('platformAdmin')) {
    return true;
  }

  // Anyone else is sent to their own landing page rather than shown a denial —
  // this route is not something a customer should even know exists. Only the
  // fallback goes through AdminAccessService; the check above stays a direct
  // role lookup for the reason in the class comment above.
  return router.createUrlTree([roleHomeRoute(authService, adminAccess)]);
};

/**
 * The screen where a school customises its own UI labels.
 *
 * A guard of its own rather than reusing `applicationAdminGuard`: the two
 * truth tables coincide today only because no strategy has split them, and
 * routing through the capability keeps the decision in `AdminRoleStrategy`
 * where the rest of them live.
 */
export const translationsAdminGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const adminAccess = inject(AdminAccessService);
  const router = inject(Router);

  await authService.waitForAuthReady();

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }
  if (adminAccess.getStrategy(authService.getUserRoles()).canManageTranslations()) {
    return true;
  }
  return router.createUrlTree([roleHomeRoute(authService, adminAccess)]);
};
