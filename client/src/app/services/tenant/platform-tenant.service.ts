import { Injectable, inject } from '@angular/core';
import { PagedResult, Tenant } from '../../models';
import { ApiClient } from '../api/api-client.service';
import { ApiPage, ApiTenant } from '../api/api-models';
import { toAppTenant } from '../auth/current-user.mapper';

export interface CreateTenantInput {
  tenantId: string;
  name: string;
  plan: Tenant['plan'];
  adminEmail: string;
  adminPassword?: string;
}

export interface CreateTenantResult {
  tenantId: string;
  adminUid: string;
  adminEmail: string;
  generatedPassword?: string;
}

const PLANS = { trial: 'Trial', standard: 'Standard', enterprise: 'Enterprise' } as const;

/**
 * The vendor's console: organizations (`/platform/tenants`), metadata only.
 *
 * The app names an organization by its slug (`Tenant.id`); the API's routes
 * take its numeric id, so the ids from the last list are remembered here.
 * Suspending is its own call, which the API enforces on every request.
 */
@Injectable({ providedIn: 'root' })
export class PlatformTenantService {
  private readonly api = inject(ApiClient);
  private readonly idBySlug = new Map<string, number>();

  /** Every organization, as one page. */
  async listTenants(_pageSize?: number, _cursor?: string): Promise<PagedResult<Tenant>> {
    const tenants: ApiTenant[] = [];
    let page = 1;
    let total = 0;
    do {
      const result = await this.api.get<ApiPage<ApiTenant>>('/platform/tenants', { page, pageSize: 100 });
      tenants.push(...result.items);
      total = result.totalCount;
    } while (page++ * 100 < total);
    for (const tenant of tenants) this.idBySlug.set(tenant.slug, tenant.id);
    return { items: tenants.map(tenant => toAppTenant(tenant)!), nextCursor: undefined };
  }

  /** Name, plan and branding; and, when `active` changed, suspend or reactivate. */
  async saveTenant(tenant: Tenant): Promise<void> {
    const id = await this.idOf(tenant.id);
    const stored = await this.api.get<ApiTenant>(`/platform/tenants/${id}`);
    await this.api.put(`/platform/tenants/${id}`, {
      name: tenant.name,
      plan: PLANS[tenant.plan ?? 'trial'],
      logoUrl: tenant.branding?.logoUrl ?? null,
      primaryColor: tenant.branding?.primaryColor ?? null
    });
    if (tenant.active !== stored.isActive) {
      await this.api.post(`/platform/tenants/${id}:${tenant.active ? 'reactivate' : 'suspend'}`, {});
    }
  }

  /** Onboard a client: the organization and its first administrator, who signs in with the password returned (or given). */
  async createTenant(input: CreateTenantInput): Promise<CreateTenantResult> {
    const created = await this.api.post<{ tenantId: number; slug: string; adminUserId: number; adminEmail: string; generatedPassword: string | null }>(
      '/platform/tenants',
      { slug: input.tenantId, name: input.name, plan: PLANS[input.plan ?? 'trial'], adminEmail: input.adminEmail, adminPassword: input.adminPassword || null }
    );
    this.idBySlug.set(created.slug, created.tenantId);
    return {
      tenantId: created.slug,
      adminUid: String(created.adminUserId),
      adminEmail: created.adminEmail,
      generatedPassword: created.generatedPassword ?? undefined
    };
  }

  /**
   * Set a school administrator's password: the way into a school whose only
   * administrator forgot theirs, or whose accounts came over without one.
   * Reaches that one account's sign-in, nothing inside the school.
   */
  async setAdministratorPassword(slug: string, email: string, password: string): Promise<void> {
    await this.api.put(`/platform/tenants/${await this.idOf(slug)}/administrator-password`, { email, password });
  }

  private async idOf(slug: string): Promise<number> {
    if (!this.idBySlug.has(slug)) await this.listTenants();
    const id = this.idBySlug.get(slug);
    if (id === undefined) throw new Error(`Organization ${slug} not found`);
    return id;
  }
}
