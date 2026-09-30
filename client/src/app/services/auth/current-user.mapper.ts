import { AdminRole, AuthProvider, RegistrationKey, Tenant, User } from '../../models';
import { ApiCurrentUser, ApiRegistrationKey, ApiRole, ApiTenant, ApiUser, idString } from '../api/api-models';

const ADMIN_ROLES: Partial<Record<ApiRole, AdminRole>> = {
  APPLICATION_ADMIN: 'applicationAdmin',
  TEACHER: 'teacher',
  PARENT: 'userAdmin',
  PLATFORM_ADMIN: 'platformAdmin'
};

const API_ROLES: Record<AdminRole, ApiRole> = {
  applicationAdmin: 'APPLICATION_ADMIN',
  teacher: 'TEACHER',
  userAdmin: 'PARENT',
  platformAdmin: 'PLATFORM_ADMIN'
};

/** The app's role names back to the API's. */
export const toApiRoles = (roles: readonly AdminRole[]): ApiRole[] => roles.map(role => API_ROLES[role]);

/**
 * An API user as the app's `User`.
 *
 * The app has no "student" role: a child was an account with `accountType:
 * 'child'` and no roles, and a parent held `userAdmin` with `accountType:
 * 'parent'`. The API has STUDENT and PARENT roles instead, so both are
 * translated back here and nothing that reads `roles`/`accountType` changes.
 *
 * `id` is the API id every reference to a person uses, and `uid` is the same
 * value: the app keyed people by `uid` throughout, and sign-in is leaving
 * Firebase, so its uid names nobody the app needs to find. `tenantId` is the
 * organization's slug.
 */
export function toUser(user: ApiUser, tenantSlug: string | undefined, provider: AuthProvider = 'email'): User {
  const roles = user.roles.map(role => ADMIN_ROLES[role]).filter((role): role is AdminRole => !!role);

  return {
    id: String(user.id),
    uid: String(user.id),
    email: user.email,
    displayName: user.displayName,
    firstName: user.firstName ?? undefined,
    lastName: user.lastName ?? undefined,
    mobileNumber: user.mobileNumber ?? undefined,
    photoURL: user.photoUrl ?? undefined,
    providerId: provider,
    accountType: user.roles.includes('STUDENT') ? 'child' : user.roles.includes('PARENT') ? 'parent' : undefined,
    tenantId: tenantSlug,
    roles,
    teacherId: idString(user.teacherId),
    parentId: idString(user.parentId),
    stageId: idString(user.stageId),
    gradeId: idString(user.gradeId),
    classId: idString(user.classId),
    registrationKeyId: idString(user.registrationKeyId),
    childCount: user.childCount ?? undefined,
    participationCount: user.participationCount ?? undefined,
    active: user.isActive,
    createdAt: new Date(user.createdOn),
    lastLoginAt: user.lastActiveOn ? new Date(user.lastActiveOn) : undefined,
    // Derived from participations by the API now; the screens that show them move over with participations.
    completedQuizzes: []
  };
}

/** `GET /me` as the signed-in `User`. */
export function toAppUser(me: ApiCurrentUser): User {
  return toUser(me.user, me.tenant?.slug);
}

/** The organization from `GET /me`, as the app's `Tenant` (its id is the slug, as in `tenants/{id}`). */
export function toAppTenant(tenant: ApiTenant | null): Tenant | null {
  if (!tenant) return null;
  return {
    id: tenant.slug,
    name: tenant.name,
    active: tenant.isActive,
    plan: tenant.plan.toLowerCase() as Tenant['plan'],
    createdAt: new Date(tenant.createdOn).getTime(),
    branding: { logoUrl: tenant.logoUrl ?? undefined, primaryColor: tenant.primaryColor ?? undefined }
  };
}

/** An API registration key as the app's `RegistrationKey` (dates in epoch ms, as the app stored them). */
export function toRegistrationKey(key: ApiRegistrationKey, tenantSlug?: string): RegistrationKey {
  const time = (value: string | null) => (value ? new Date(value).getTime() : undefined);
  return {
    id: String(key.id),
    code: key.code,
    tenantId: tenantSlug,
    active: key.isActive,
    expiresAt: time(key.expiresOn),
    role: key.role === 'APPLICATION_ADMIN' ? 'applicationAdmin' : 'userAdmin',
    parentId: idString(key.parentId),
    usedByParentAt: time(key.claimedOn),
    childUseCount: key.childCount,
    maxChildUses: key.maxChildren ?? undefined,
    status: key.status.toLowerCase() as RegistrationKey['status']
  };
}
