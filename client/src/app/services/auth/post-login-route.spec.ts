/**
 * Where a user lands after signing in.
 *
 * Extracted from `AuthService.getPostLoginRoute` so the routing table can be
 * read — and tested — without Firebase. The rule that needs pinning is the
 * `platformAdmin` short-circuit: the vendor belongs to no organization, so every
 * tenant-scoped dashboard would render empty for them, and that check therefore
 * has to happen *before* the strategy is consulted rather than inside it.
 */

import { resolvePostLoginRoute } from './post-login-route';
import { AdminRoleStrategy } from '../../interfaces';
import { AdminRole } from '../../models';

type RoleType = ReturnType<AdminRoleStrategy['getRoleType']>;

function strategy(roleType: RoleType, canAccessAdminDashboard = false): AdminRoleStrategy {
  return {
    getRoleType: () => roleType,
    canAccessAdminDashboard: () => canAccessAdminDashboard
  } as AdminRoleStrategy;
}

describe('resolvePostLoginRoute', () => {
  it('sends a platform admin to the platform console', () => {
    expect(resolvePostLoginRoute(['platformAdmin'], strategy('none'))).toBe('/platform-admin');
  });

  it('sends a platform admin to the platform console even when they also hold a tenant role', () => {
    // The short-circuit must win: the strategy for these roles would happily
    // claim the admin dashboard, which holds no data for the vendor.
    const roles: AdminRole[] = ['platformAdmin', 'applicationAdmin'];
    expect(resolvePostLoginRoute(roles, strategy('applicationAdmin', true))).toBe('/platform-admin');
  });

  it('sends a parent to the parent dashboard', () => {
    expect(resolvePostLoginRoute(['userAdmin'], strategy('userAdmin', true))).toBe('/parent-dashboard');
  });

  it('sends an application admin to the admin dashboard', () => {
    expect(resolvePostLoginRoute(['applicationAdmin'], strategy('applicationAdmin', true)))
      .toBe('/admin-dashboard');
  });

  it('sends a teacher to the admin dashboard', () => {
    expect(resolvePostLoginRoute(['teacher'], strategy('teacher', true))).toBe('/admin-dashboard');
  });

  it('sends a student with no admin rights to the quiz list', () => {
    expect(resolvePostLoginRoute([], strategy('none'))).toBe('/available-quizzes');
  });
});
