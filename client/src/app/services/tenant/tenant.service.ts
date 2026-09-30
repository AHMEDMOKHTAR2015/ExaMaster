import { Injectable, computed, signal } from '@angular/core';
import { Tenant } from '../../models';

/**
 * The signed-in user's own organization: its name and branding.
 *
 * The other half of {@link TenantContextService}, which deliberately holds only
 * the id and has no dependencies, so every repository can read it without
 * creating a module cycle.
 *
 * It no longer reads anything itself: `GET /me` returns the organization with
 * the profile, and `AuthService.setCurrentUser` (the sole writer, as it is for
 * the tenant id) sets both together — so one customer's name can never linger
 * on screen while the next account loads.
 */
@Injectable({ providedIn: 'root' })
export class TenantService {
  private readonly _tenant = signal<Tenant | null>(null);

  /** The organization the signed-in user belongs to; null signed out, and for the vendor. */
  readonly tenant = this._tenant.asReadonly();

  /** Its display name; `''` while loading, signed out, or for the vendor. */
  readonly name = computed(() => this._tenant()?.name ?? '');

  /** Only `AuthService.setCurrentUser` calls this. */
  setTenant(tenant: Tenant | null): void {
    this._tenant.set(tenant);
  }
}
