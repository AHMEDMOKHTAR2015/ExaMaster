/**
 * `userAdmin`, `applicationAdmin` and `teacher` are all scoped *within* one
 * tenant — an `applicationAdmin` administers their own organization, not the
 * deployment.
 *
 * `platformAdmin` is the vendor's own role and is deliberately not one of
 * them: it is not a member of any tenant, so it resolves to `NoAdminStrategy`
 * like any other non-admin and is checked directly by `platformAdminGuard`
 * instead. Its reach is limited to `tenants/{tenantId}` metadata — onboarding
 * and suspending organizations — never the data inside one.
 */
export type AdminRole = 'userAdmin' | 'applicationAdmin' | 'teacher' | 'platformAdmin';
