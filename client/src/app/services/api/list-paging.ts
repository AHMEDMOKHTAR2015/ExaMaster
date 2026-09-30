import { PagedResult } from '../../models';
import { PagedSource } from '../shared/query-spec';

/**
 * A `PagedSource` over a list the API returns whole.
 *
 * School-structure lists are small (stages, grades, classes, subjects,
 * teachers of one school), and the API returns each in one response. The
 * tables still page through `PagedSource`, so this pages in memory: the cursor
 * is the offset of the next page. Each call loads the list afresh, as the
 * Firestore version queried afresh.
 */
export function pagedList<T>(load: () => Promise<T[]>): PagedSource<T> {
  return {
    fetchPage: async (pageSize: number, cursor?: string): Promise<PagedResult<T>> => {
      const items = await load();
      const start = cursor ? Number(cursor) : 0;
      const end = start + pageSize;
      return { items: items.slice(start, end), nextCursor: end < items.length ? String(end) : undefined };
    },
    fetchCount: async () => (await load()).length
  };
}

/** A whole list as one page: callers that page with a cursor stop after the first. */
export const onePage = <T>(items: T[]): PagedResult<T> => ({ items, nextCursor: undefined });
