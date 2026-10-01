import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import {
  AccessRequest,
  AccessRequestApproval,
  AccessRequestClassOption,
  AccessRequestInput,
  AccessRequestKind,
  AccessRequestParentOption,
  AccessRequestStatus,
  AccessRequestTenantOption,
  PagedResult
} from '../../models';
import { AuthService } from '../auth';
import { ApiClient } from '../api/api-client.service';
import {
  ApiAccessRequest,
  ApiPage,
  ApiTenant,
  ApiTenantClassOption,
  ApiTenantParentOption,
  idString
} from '../api/api-models';

const KIND_TO_API = { parent: 'Parent', child: 'Child' } as const;
const STATUS_TO_API = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' } as const;

export interface AccessRequestQuery {
  status?: AccessRequestStatus;
  kind?: AccessRequestKind;
  search?: string;
  /** 1-based. */
  page: number;
  pageSize: number;
}

/**
 * Access requests: a visitor without a registration key asking to join
 * (`POST /access-requests`, anonymous), and the platform administrator's
 * review of them (`/platform/access-requests`).
 *
 * Also the sidebar's pending badge for the platform administrator. It is read
 * when they sign in, whenever the review page loads or decides, and every
 * {@link POLL_MS} as a safety net (there is no live signal for it: requests
 * come from people with no account, so nobody's channel carries them). Clears
 * the moment the signed-in account changes.
 */
@Injectable({ providedIn: 'root' })
export class AccessRequestService {
  private static readonly POLL_MS = 5 * 60_000;

  private readonly api = inject(ApiClient);
  private readonly authService = inject(AuthService);

  private readonly count = signal(0);
  readonly pendingCount = this.count.asReadonly();

  private timer: ReturnType<typeof setInterval> | null = null;
  private generation = 0;

  constructor() {
    effect(() => {
      const isPlatformAdmin = this.authService.user()?.roles?.includes('platformAdmin') ?? false;
      this.stop();
      this.count.set(0);
      if (!isPlatformAdmin) return;

      void this.refreshPendingCount();
      this.timer = setInterval(() => void this.refreshPendingCount(), AccessRequestService.POLL_MS);
    }, { allowSignalWrites: true });

    inject(DestroyRef).onDestroy(() => this.stop());
  }

  /** The visitor's request. The password is kept as a hash and becomes theirs on approval. */
  async submit(input: AccessRequestInput): Promise<void> {
    const optional = (value?: string) => value?.trim() || null;
    await this.api.post('/access-requests', {
      kind: KIND_TO_API[input.kind],
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      mobileNumber: input.mobileNumber.trim(),
      password: input.password,
      email: input.kind === 'parent' ? optional(input.email) : null,
      schoolName: input.schoolName.trim(),
      gradeName: input.kind === 'child' ? optional(input.gradeName) : null,
      parentName: input.kind === 'child' ? optional(input.parentName) : null,
      parentMobileNumber: input.kind === 'child' ? optional(input.parentMobileNumber) : null,
      note: optional(input.note)
    });
  }

  /** One page of requests: pending ones first, oldest first; decided ones newest decision first. */
  async list(query: AccessRequestQuery): Promise<PagedResult<AccessRequest> & { totalCount: number }> {
    const result = await this.api.get<ApiPage<ApiAccessRequest>>('/platform/access-requests', {
      status: query.status ? STATUS_TO_API[query.status] : undefined,
      kind: query.kind ? KIND_TO_API[query.kind] : undefined,
      search: query.search?.trim() || undefined,
      page: query.page,
      pageSize: query.pageSize
    });
    if (query.status === 'pending' && !query.kind && !query.search?.trim()) this.count.set(result.totalCount);
    return {
      items: result.items.map(toAccessRequest),
      totalCount: result.totalCount,
      nextCursor: query.page * query.pageSize < result.totalCount ? String(query.page + 1) : undefined
    };
  }

  /** Creates the account in the chosen organization; returns its user id. */
  async approve(id: string, approval: AccessRequestApproval): Promise<string> {
    const { id: userId } = await this.api.post<{ id: number }>(`/platform/access-requests/${id}:approve`, {
      tenantId: approval.tenantId,
      maxChildren: approval.maxChildren ?? null,
      classId: approval.classId ?? null,
      parentId: approval.parentId ?? null
    });
    void this.refreshPendingCount();
    return String(userId);
  }

  /** The reason, if given, is shown to the visitor when they try to sign in. */
  async reject(id: string, reason?: string): Promise<void> {
    await this.api.post(`/platform/access-requests/${id}:reject`, { reason: reason?.trim() || null });
    void this.refreshPendingCount();
  }

  /** Every organization, active ones first, with the numeric id the approval routes take. */
  async listTenants(): Promise<AccessRequestTenantOption[]> {
    const tenants: ApiTenant[] = [];
    let page = 1;
    let total = 0;
    do {
      const result = await this.api.get<ApiPage<ApiTenant>>('/platform/tenants', { page, pageSize: 100 });
      tenants.push(...result.items);
      total = result.totalCount;
    } while (page++ * 100 < total);
    return tenants
      .map(tenant => ({ id: tenant.id, name: tenant.name, slug: tenant.slug, active: tenant.isActive }))
      .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
  }

  async listClasses(tenantId: number): Promise<AccessRequestClassOption[]> {
    const classes = await this.api.get<ApiTenantClassOption[]>(`/platform/tenants/${tenantId}/classes`);
    return classes.map(c => ({ id: c.id, name: c.name, gradeName: c.gradeName, stageName: c.stageName }));
  }

  /** Up to 50 parents of the organization matching a name, mobile number or email. */
  async searchParents(tenantId: number, search?: string): Promise<AccessRequestParentOption[]> {
    const parents = await this.api.get<ApiTenantParentOption[]>(`/platform/tenants/${tenantId}/parents`, { search: search?.trim() || undefined });
    return parents.map(p => ({
      id: p.id,
      displayName: p.displayName,
      mobileNumber: p.mobileNumber ?? undefined,
      childCount: p.childCount,
      maxChildren: p.maxChildren ?? undefined,
      hasUsableKey: p.hasUsableKey
    }));
  }

  /** Read the badge now. Failures leave the last known value: a badge is not worth an error. */
  async refreshPendingCount(): Promise<void> {
    if (!this.authService.user()?.roles?.includes('platformAdmin')) return;
    const generation = this.generation;
    try {
      const page = await this.api.get<ApiPage<unknown>>('/platform/access-requests', { status: 'Pending', page: 1, pageSize: 1 });
      if (generation === this.generation) this.count.set(page.totalCount);
    } catch {
      // Offline, or signed out mid-request.
    }
  }

  private stop(): void {
    this.generation++;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

function toAccessRequest(api: ApiAccessRequest): AccessRequest {
  return {
    id: String(api.id),
    kind: api.kind === 'Child' ? 'child' : 'parent',
    firstName: api.firstName,
    lastName: api.lastName,
    mobileNumber: api.mobileNumber,
    contactEmail: api.contactEmail ?? undefined,
    schoolName: api.schoolName || undefined,
    gradeName: api.gradeName ?? undefined,
    parentName: api.parentName ?? undefined,
    parentMobileNumber: api.parentMobileNumber ?? undefined,
    note: api.note ?? undefined,
    status: api.status === 'Approved' ? 'approved' : api.status === 'Rejected' ? 'rejected' : 'pending',
    createdAt: Date.parse(api.createdOn),
    decidedAt: api.decidedOn ? Date.parse(api.decidedOn) : undefined,
    rejectionReason: api.rejectionReason ?? undefined,
    approvedTenantId: api.approvedTenantId ?? undefined,
    approvedTenantName: api.approvedTenantName ?? undefined,
    approvedUserId: idString(api.approvedUserId)
  };
}
