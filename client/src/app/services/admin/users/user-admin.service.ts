import { Injectable, inject } from '@angular/core';
import { User } from '../../../models';
import { ApiClient } from '../../api/api-client.service';
import { ApiPage, ApiUser } from '../../api/api-models';
import { toUser } from '../../auth/current-user.mapper';
import { TenantContextService } from '../../tenant/tenant-context.service';

/** A family's children, as a parent sees them or as staff browse them. */
@Injectable({ providedIn: 'root' })
export class UserAdminService {
  private readonly api = inject(ApiClient);
  private readonly tenantContext = inject(TenantContextService);

  /** The signed-in parent's own children (`GET /me/children`): a parent sees their family and nobody else's. */
  async listMyChildren(): Promise<User[]> {
    const { children } = await this.api.get<{ children: ApiUser[] }>('/me/children');
    return children.map(child => this.toUser(child));
  }

  /** Staff browsing one family (`GET /users?parentId=`); a family is a handful of children, so one page. */
  async listChildrenOf(parentId: string): Promise<User[]> {
    const page = await this.api.get<ApiPage<ApiUser>>('/users', { parentId, pageSize: 100 });
    return page.items.map(child => this.toUser(child));
  }

  private toUser(user: ApiUser): User {
    return toUser(user, this.tenantContext.tenantId() ?? undefined);
  }
}
