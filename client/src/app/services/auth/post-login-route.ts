import { AdminRoleStrategy } from '../../interfaces';
import { AdminRole } from '../../models';

/**
 * Home for anyone who takes quizzes rather than administers them.
 *
 * Exported because three separate decisions have to agree on it — where a
 * student lands after sign-in, whether the sidebar shows the Learn section,
 * and whether `studentGuard` lets a request through. A literal in each place
 * is three chances for them to drift apart.
 */
export const STUDENT_HOME_ROUTE = '/available-quizzes';

/**
 * The landing route for a freshly signed-in user.
 *
 * Takes the already-resolved strategy rather than resolving it, so this stays a
 * pure function of (roles, capabilities) and `AuthService` keeps its single
 * dependency on `AdminAccessService`.
 */
export function resolvePostLoginRoute(roles: AdminRole[], strategy: AdminRoleStrategy): string {
  // Checked before the strategies, not through them: `platformAdmin` is the
  // vendor and belongs to no organization, so every tenant-scoped dashboard
  // would be empty for them.
  if (roles.includes('platformAdmin')) return '/platform-admin';

  // Parent admins get their own dashboard; the other admin roles share one.
  if (strategy.getRoleType() === 'userAdmin') return '/parent-dashboard';
  return strategy.canAccessAdminDashboard() ? '/admin-dashboard' : STUDENT_HOME_ROUTE;
}
