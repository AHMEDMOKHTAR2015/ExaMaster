import { PagedResult } from '../../models';

/**
 * A paged list as the admin tables consume it (`PagedList.fromSource`): one
 * page at a time, plus the total for the pager. Each API service builds one —
 * paged on the server where the API pages, in memory where it returns a list
 * whole (`api/list-paging.ts`).
 */
export interface PagedSource<T> {
  fetchPage: (pageSize: number, cursor?: string) => Promise<PagedResult<T>>;
  fetchCount: () => Promise<number>;
}
