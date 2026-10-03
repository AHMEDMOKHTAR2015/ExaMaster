import { Injectable, inject } from '@angular/core';
import { AdminRole, PagedResult, User } from '../../../models';
import { PagedSource } from '../../shared/query-spec';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { ApiClient } from '../../api/api-client.service';
import { ApiPage, ApiRole, ApiUser, idNumber } from '../../api/api-models';
import { ServiceError } from '../../shared/service-error';
import { toApiRoles, toUser } from '../../auth/current-user.mapper';

type AccountType = 'parent' | 'child';

/** How recently an account has been used — the Users table's status filter, applied by the API (`UserFilters`). */
export type UserActivity = 'active' | 'pending' | 'inactive' | 'suspended';
const API_ACTIVITY: Record<UserActivity, string> = { active: 'Active', pending: 'Pending', inactive: 'Inactive', suspended: 'Suspended' };

/** What the Users table narrows by; the API applies each, so they cover every page, not only the one on screen. */
export interface UserListFilter {
  /** Name, email or mobile number. */
  search?: string;
  activity?: UserActivity;
}
const ROLE_OF: Record<AccountType, ApiRole> = { parent: 'PARENT', child: 'STUDENT' };
const MAX_PAGE = 100;                                    // the API's page-size limit

/**
 * The organization's accounts, through the API (`GET /users` and friends).
 *
 * The API confines every query to the caller's organization itself, so the
 * tenant filter this used to have to remember is gone. People are addressed by
 * their API id (`User.id`, which `uid` now equals).
 */
@Injectable({ providedIn: 'root' })
export class AppUserService {
  private readonly api = inject(ApiClient);
  private readonly tenantContext = inject(TenantContextService);

  listUsers(pageSize = 10, cursor?: string): Promise<PagedResult<User>> {
    return this.page({}, pageSize, cursor);
  }

  async countUsers(): Promise<number> {
    return (await this.raw({}, 1, 1)).totalCount;
  }

  /** The Users table, optionally one account type, searched and filtered by the API, by name; paged on the server. */
  pagedSource(accountType?: AccountType, narrow: UserListFilter = {}): PagedSource<User> {
    const filter: Record<string, string> = {};
    if (accountType) filter['role'] = ROLE_OF[accountType];
    if (narrow.search?.trim()) filter['search'] = narrow.search.trim();
    if (narrow.activity) filter['activity'] = API_ACTIVITY[narrow.activity];
    return {
      fetchPage: (pageSize, cursor) => this.page(filter, pageSize, cursor),
      fetchCount: async () => (await this.raw(filter, 1, 1)).totalCount
    };
  }

  /** Staff accounts (administrators and teachers), by name. A school has a handful, so not paged. */
  async listAdminAccounts(): Promise<User[]> {
    const [admins, teachers] = await Promise.all([this.all({ role: 'APPLICATION_ADMIN' }), this.all({ role: 'TEACHER' })]);
    const byId = new Map([...admins, ...teachers].map(user => [user.id, user]));
    return [...byId.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  /** Every parent account, for the "assign a parent" picker. */
  listParents(): Promise<User[]> {
    return this.all({ role: 'PARENT' });
  }

  async countByAccountType(accountType: AccountType): Promise<number> {
    return (await this.raw({ role: ROLE_OF[accountType] }, 1, 1)).totalCount;
  }

  /** Teacher accounts (people who can sign in), for the quiz-reviewer picker. All of them, as one page. */
  async listTeacherAccounts(_pageSize = 100, _cursor?: string): Promise<PagedResult<User>> {
    return { items: await this.all({ role: 'TEACHER' }), nextCursor: undefined };
  }

  /**
   * Students with at least one submitted attempt, most attempts first, each
   * with its `participationCount`. Backs the dashboard's "Recent
   * Participations" panel and the full `/participations-history` table — both
   * need exactly this set, just at different page sizes.
   */
  listChildParticipants(pageSize = 10, cursor?: string): Promise<PagedResult<User>> {
    return this.page({ role: 'STUDENT', participated: true }, pageSize, cursor);
  }

  /** Accounts by API id; ids that no longer exist are left out. */
  async fetchUsersByIds(ids: string[]): Promise<User[]> {
    const users = await Promise.all(ids.map(async id => {
      try {
        return this.toUser((await this.api.get<{ user: ApiUser }>(`/users/${id}`)).user);
      } catch (error) {
        if (error instanceof ServiceError && error.code === '404') return null;
        throw error;
      }
    }));
    return users.filter((user): user is User => user !== null);
  }

  /**
   * Set someone's password: an administrator for anyone in their school, a
   * parent for their own children. There is no reset link — a child has no
   * mailbox — so this is how a forgotten password is replaced. It signs that
   * account out everywhere.
   */
  async setPassword(id: string, password: string): Promise<void> {
    await this.api.put(`/users/${id}/password`, { password });
  }

  async updateUserActive(id: string, active: boolean): Promise<void> {
    await this.api.post(`/users/${id}:${active ? 'activate' : 'deactivate'}`);
  }

  /**
   * The editable parts of an account, each through its own API call: the name,
   * the roles, the active flag, and for a child the class (the stage and grade
   * follow from it) and the parent (the family's slot moves with the child,
   * server-side). Identity (email, sign-in) is Firebase's and never changes here.
   */
  async updateUserProfile(
    id: string,
    patch: Partial<Pick<User, 'firstName' | 'lastName' | 'active' | 'roles' | 'classId' | 'parentId'>>
  ): Promise<void> {
    if (patch.firstName !== undefined || patch.lastName !== undefined) {
      await this.api.put(`/users/${id}/name`, { firstName: patch.firstName ?? '', lastName: patch.lastName ?? '' });
    }
    if (patch.roles !== undefined) {
      await this.api.put(`/users/${id}/roles`, { roles: toApiRoles(patch.roles as AdminRole[]) });
    }
    if (patch.parentId) {
      await this.api.put(`/users/${id}/parent`, { parentId: idNumber(patch.parentId) });
    }
    if (patch.classId) {
      await this.api.put(`/users/${id}/placement`, { classId: idNumber(patch.classId) });
    }
    if (patch.active !== undefined) {
      await this.updateUserActive(id, patch.active);
    }
  }

  private toUser(user: ApiUser): User {
    return toUser(user, this.tenantContext.tenantId() ?? undefined);
  }

  private raw(filter: Record<string, string | number | boolean>, page: number, pageSize: number): Promise<ApiPage<ApiUser>> {
    return this.api.get<ApiPage<ApiUser>>('/users', { ...filter, page, pageSize: Math.min(pageSize, MAX_PAGE) });
  }

  // cursor = the next page number
  private async page(filter: Record<string, string | number | boolean>, pageSize: number, cursor?: string): Promise<PagedResult<User>> {
    const page = cursor ? Number(cursor) : 1;
    const result = await this.raw(filter, page, pageSize);
    const more = page * result.pageSize < result.totalCount;
    return { items: result.items.map(user => this.toUser(user)), nextCursor: more ? String(page + 1) : undefined };
  }

  private async all(filter: Record<string, string | number | boolean>): Promise<User[]> {
    const users: User[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.page(filter, MAX_PAGE, cursor);
      users.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor);
    return users;
  }
}
