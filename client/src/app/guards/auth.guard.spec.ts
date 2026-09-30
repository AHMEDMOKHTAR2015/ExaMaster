import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { guestGuard, studentGuard, userAdminGuard, adminDashboardGuard } from './auth.guard';
import { AuthService } from '../services/auth';
import { AdminRole } from '../models';

/**
 * Regression coverage for the bug where an application admin who pressed the
 * browser's back button on `/admin-dashboard` landed back on `/login`, was
 * denied by `guestGuard` (already signed in), and was bounced to
 * `/available-quizzes` — the student route — because the guard's fallback was
 * hardcoded rather than role-aware. `guestGuard` now delegates to
 * `resolvePostLoginRoute`, the same helper `AuthService` uses right after
 * sign-in, so every role lands wherever it would have landed there too.
 *
 * `AdminAccessService` is left un-stubbed and resolved from the real root
 * injector: it has no dependencies of its own, so there is nothing to fake.
 */
describe('guestGuard', () => {
  function runGuard(roles: AdminRole[], isAuthenticated: boolean, signingOut = false) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            waitForAuthReady: () => Promise.resolve(),
            isAuthenticated: signal(isAuthenticated),
            isSigningOut: () => signingOut,
            getUserRoles: () => roles
          }
        }
      ]
    });

    return TestBed.runInInjectionContext(() =>
      guestGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );
  }

  it('lets an unauthenticated visitor reach /login', async () => {
    const result = await runGuard([], false);
    expect(result).toBe(true);
  });

  it('lets a signing-out user through to /login (the page is left before the session clears)', async () => {
    const result = await runGuard(['applicationAdmin'], true, true);
    expect(result).toBe(true);
  });

  it('sends a signed-in application admin to /admin-dashboard, not /available-quizzes', async () => {
    const result = await runGuard(['applicationAdmin'], true) as UrlTree;
    expect(result.toString()).toBe('/admin-dashboard');
  });

  it('sends a signed-in parent (userAdmin) to /parent-dashboard', async () => {
    const result = await runGuard(['userAdmin'], true) as UrlTree;
    expect(result.toString()).toBe('/parent-dashboard');
  });

  it('sends a signed-in teacher to /admin-dashboard', async () => {
    const result = await runGuard(['teacher'], true) as UrlTree;
    expect(result.toString()).toBe('/admin-dashboard');
  });

  it('sends a signed-in platform admin to /platform-admin', async () => {
    const result = await runGuard(['platformAdmin'], true) as UrlTree;
    expect(result.toString()).toBe('/platform-admin');
  });

  it('sends a signed-in user with no admin roles (a child) to /available-quizzes', async () => {
    const result = await runGuard([], true) as UrlTree;
    expect(result.toString()).toBe('/available-quizzes');
  });
});

/**
 * The other half of the same bug. `guestGuard` above stopped admins being
 * *bounced* to the student route; this stops them reaching it directly.
 *
 * `/available-quizzes` and `/quiz/:id` carried `authGuard`, which only asks
 * whether someone is signed in. Browser history survives a sign-out, so after
 * a student logged out and an application admin logged in, Back replayed the
 * student's URL and the admin got the student dashboard. `/quiz/:id` was
 * worse: it starts a real attempt, so the admin would have been graded and
 * recorded as a participant.
 */
describe('studentGuard', () => {
  function runGuard(roles: AdminRole[], isAuthenticated: boolean) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            waitForAuthReady: () => Promise.resolve(),
            isAuthenticated: signal(isAuthenticated),
            getUserRoles: () => roles
          }
        }
      ]
    });

    return TestBed.runInInjectionContext(() =>
      studentGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );
  }

  it('lets a signed-in user with no admin roles (a child) take quizzes', async () => {
    const result = await runGuard([], true);
    expect(result).toBe(true);
  });

  it('sends an application admin to their own dashboard instead', async () => {
    const result = await runGuard(['applicationAdmin'], true) as UrlTree;
    expect(result.toString()).toBe('/admin-dashboard');
  });

  it('sends a parent (userAdmin) to /parent-dashboard instead', async () => {
    const result = await runGuard(['userAdmin'], true) as UrlTree;
    expect(result.toString()).toBe('/parent-dashboard');
  });

  it('sends a teacher to /admin-dashboard instead', async () => {
    const result = await runGuard(['teacher'], true) as UrlTree;
    expect(result.toString()).toBe('/admin-dashboard');
  });

  it('sends the vendor (platformAdmin) to /platform-admin instead', async () => {
    const result = await runGuard(['platformAdmin'], true) as UrlTree;
    expect(result.toString()).toBe('/platform-admin');
  });

  it('sends an unauthenticated visitor to /login', async () => {
    const result = await runGuard([], false) as UrlTree;
    expect(result.toString()).toBe('/login');
  });
});

/**
 * The reported bug, reproduced directly: log in as a parent, log out, log in
 * as an application admin, press Back twice. `/parent-dashboard` used to
 * allow anyone whose strategy answered `canAccessUserAdmin()` — true for
 * ApplicationAdminStrategy on the theory that full child-management access
 * should extend to this page too — so the guard let the admin through and the
 * parent dashboard rendered with the *admin's* (empty) data behind it. Nothing
 * in the app ever sends an admin to `/parent-dashboard` on purpose; the stale
 * history entry was the only way in. `canAccessUserAdmin()` is now deleted and
 * the guard instead asks the one question that matters for a landing page: is
 * this actually where `resolvePostLoginRoute` sends this role?
 */
describe('userAdminGuard', () => {
  function runGuard(roles: AdminRole[], isAuthenticated: boolean) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            waitForAuthReady: () => Promise.resolve(),
            isAuthenticated: signal(isAuthenticated),
            getUserRoles: () => roles
          }
        }
      ]
    });

    return TestBed.runInInjectionContext(() =>
      userAdminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );
  }

  it('lets a parent (userAdmin) reach their own dashboard', async () => {
    const result = await runGuard(['userAdmin'], true);
    expect(result).toBe(true);
  });

  it('sends an application admin to /admin-dashboard instead — the reported bug', async () => {
    const result = await runGuard(['applicationAdmin'], true) as UrlTree;
    expect(result.toString()).toBe('/admin-dashboard');
  });

  it('sends a teacher to /admin-dashboard instead', async () => {
    const result = await runGuard(['teacher'], true) as UrlTree;
    expect(result.toString()).toBe('/admin-dashboard');
  });

  it('sends a child to /available-quizzes instead', async () => {
    const result = await runGuard([], true) as UrlTree;
    expect(result.toString()).toBe('/available-quizzes');
  });

  it('sends the vendor (platformAdmin) to /platform-admin instead', async () => {
    const result = await runGuard(['platformAdmin'], true) as UrlTree;
    expect(result.toString()).toBe('/platform-admin');
  });

  it('sends an unauthenticated visitor to /login', async () => {
    const result = await runGuard([], false) as UrlTree;
    expect(result.toString()).toBe('/login');
  });
});

/**
 * `adminDashboardGuard` moved onto the same `homeRouteGuard` factory as
 * `userAdminGuard` above — this pins that the redirects it used to spell out
 * explicitly (parent to `/parent-dashboard`, vendor to `/platform-admin`)
 * still come out the same now that they are derived from
 * `resolvePostLoginRoute` instead.
 */
describe('adminDashboardGuard', () => {
  function runGuard(roles: AdminRole[], isAuthenticated: boolean) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            waitForAuthReady: () => Promise.resolve(),
            isAuthenticated: signal(isAuthenticated),
            getUserRoles: () => roles
          }
        }
      ]
    });

    return TestBed.runInInjectionContext(() =>
      adminDashboardGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );
  }

  it('lets an application admin in', async () => {
    const result = await runGuard(['applicationAdmin'], true);
    expect(result).toBe(true);
  });

  it('lets a teacher in', async () => {
    const result = await runGuard(['teacher'], true);
    expect(result).toBe(true);
  });

  it('sends a parent (userAdmin) to /parent-dashboard instead', async () => {
    const result = await runGuard(['userAdmin'], true) as UrlTree;
    expect(result.toString()).toBe('/parent-dashboard');
  });

  it('sends a child to /available-quizzes instead', async () => {
    const result = await runGuard([], true) as UrlTree;
    expect(result.toString()).toBe('/available-quizzes');
  });

  it('sends the vendor (platformAdmin) to /platform-admin instead', async () => {
    const result = await runGuard(['platformAdmin'], true) as UrlTree;
    expect(result.toString()).toBe('/platform-admin');
  });

  it('sends an unauthenticated visitor to /login', async () => {
    const result = await runGuard([], false) as UrlTree;
    expect(result.toString()).toBe('/login');
  });
});
