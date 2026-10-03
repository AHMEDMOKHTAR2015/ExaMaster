import { LoadMoreList } from './load-more-list';
import { PagedSource } from '../services/shared/query-spec';

/** A source over `items` that pages by offset and counts, the way the API's paged lists answer. */
function sourceOver(items: string[]): PagedSource<string> {
  return {
    fetchPage: async (pageSize, cursor) => {
      const start = cursor ? Number(cursor) : 0;
      const end = start + pageSize;
      return { items: items.slice(start, end), nextCursor: end < items.length ? String(end) : undefined };
    },
    fetchCount: async () => items.length
  };
}

describe('LoadMoreList', () => {
  const letters = ['a', 'b', 'c', 'd', 'e'];

  it('loads the first page and how many match in all', async () => {
    const list = new LoadMoreList(() => sourceOver(letters), 2);
    await list.reload();
    expect(list.items()).toEqual(['a', 'b']);
    expect(list.total()).toBe(5);
    expect(list.hasMore()).toBe(true);
  });

  it('appends the next pages until everything is loaded', async () => {
    const list = new LoadMoreList(() => sourceOver(letters), 2);
    await list.reload();
    await list.loadMore();
    await list.loadMore();
    expect(list.items()).toEqual(letters);
    expect(list.hasMore()).toBe(false);
    await list.loadMore();                                   // nothing left: a no-op, not a repeat
    expect(list.items()).toEqual(letters);
  });

  it('empties when there is nothing to ask yet', async () => {
    let ready = true;
    const list = new LoadMoreList(() => (ready ? sourceOver(letters) : null), 2);
    await list.reload();
    ready = false;
    await list.reload();
    expect(list.items()).toEqual([]);
    expect(list.total()).toBe(0);
  });

  it('keeps the newest reload when an older one answers last', async () => {
    let releaseSlow!: () => void;
    let query = 'slow';
    const list = new LoadMoreList<string>(() => {
      const asked = query;
      return {
        fetchPage: async () => {
          if (asked === 'slow') await new Promise<void>(resolve => (releaseSlow = resolve));
          return { items: [asked], nextCursor: undefined };
        },
        fetchCount: async () => 1
      };
    });

    const slow = list.reload();
    await Promise.resolve();
    query = 'fast';
    await list.reload();
    releaseSlow();
    await slow;

    expect(list.items()).toEqual(['fast']);
    expect(list.isLoading()).toBe(false);
  });

  it('degrades to empty and reports a failure', async () => {
    const errors: unknown[] = [];
    const list = new LoadMoreList<string>(
      () => ({ fetchPage: () => Promise.reject(new Error('down')), fetchCount: async () => 0 }),
      2,
      error => errors.push(error)
    );
    await list.reload();
    expect(list.items()).toEqual([]);
    expect(errors.length).toBe(1);
  });
});
