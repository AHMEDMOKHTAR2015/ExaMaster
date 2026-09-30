/**
 * A client organization (a school, or a district buying the platform).
 *
 * The document at `tenants/{id}` is both the metadata record below *and* the
 * parent of every tenant-owned collection (`tenants/{id}/classes`,
 * `tenants/{id}/participations`, ...). Tenant-specific configuration lives on
 * these fields rather than in a separate collection, so reading a tenant's
 * settings is the same single document read that proves the tenant exists.
 *
 * Users and registration keys are looked up before the caller's organization
 * is known (at sign-in, at registration), so each carries its organization.
 */
export interface Tenant {
  id: string;
  name: string;
  /** `false` suspends the whole organization — e.g. a lapsed subscription. */
  active: boolean;
  plan?: 'trial' | 'standard' | 'enterprise';
  /** Epoch milliseconds, matching `RegistrationKey.expiresAt`. */
  createdAt: number;
  branding?: TenantBranding;
  /** Per-tenant feature toggles, keyed by feature name. */
  featureFlags?: Record<string, boolean>;
}

export interface TenantBranding {
  logoUrl?: string;
  primaryColor?: string;
}
