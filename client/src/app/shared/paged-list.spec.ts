import { PagedList, buildPageNumbers } from './paged-list';
import { PagedResult } from '../models';
import { TenantUnavailableError } from '../services/tenant/tenant-context.service';

/**
 * `PagedList` replaces the "drain every page then slice in memory" pattern every
 * admin table used. The behaviour that matters is not "does it show ten rows" —
 * it is that a cursor is only ever used for the page it belongs to, because a
 * cursor reused against a changed result set returns confidently wrong data.
 */

/** A fake collection that answers cursor pages the way Firestore does. */
function fakeSource(items: string[]) {
  const calls: { cursor?: string; pageSize: number }[] = [];
  const fetchPage = async (pageSize: number, cursor?: string): Promise<PagedResult<string>> => {
    calls.push({ cursor, pageSize });
    const start = cursor ? Number(cursor) : 0;
    const slice = items.slice(start, start + pageSize);
    const end = start + slice.length;
    return {
      items: slice,
      // Firestore only hands back a cursor when the page was full — a short page
      // is the last one.
      nextCursor: slice.length === pageSize && end < items.length ? String(end) : undefined
    };
  };
  return { fetchPage, calls };
}

describe('PagedList', () => {
  it('loads only the first page, not the whole collection', async () => {
    const src = fakeSource(Array.from({ length: 250 }, (_, i) => `row${i}`));
    const list = new PagedList(src.fetchPage, async () => 250, 20);

    await list.reload();

    expect(list.items().length).toBe(20);
    expect(list.items()[0]).toBe('row0');
    // The whole point: 250 documents exist, one page was read.
    expect(src.calls.length).toBe(1);
  });

  it('takes the page count from the server count, not the rows it holds', async () => {
    const src = fakeSource(Array.from({ length: 250 }, (_, i) => `row${i}`));
    const list = new PagedList(src.fetchPage, async () => 250, 20);

    await list.reload();

    expect(list.total()).toBe(250);
    expect(list.totalPages()).toBe(13);
    expect(list.items().length).toBe(20);
  });

  it('walks cursors forward to reach an unvisited page', async () => {
    const src = fakeSource(Array.from({ length: 100 }, (_, i) => `row${i}`));
    const list = new PagedList(src.fetchPage, async () => 100, 10);
    await list.reload();
    src.calls.length = 0;

    await list.goTo(4);

    expect(list.currentPage()).toBe(4);
    expect(list.items()[0]).toBe('row30');
    // Page 1's own load already learned page 2's cursor, so only pages 2 and 3
    // are stepped through before page 4 is read: three queries to reach row 30,
    // against a hundred documents for the old drain-everything approach.
    expect(src.calls.length).toBe(3);
  });

  it('reuses cached cursors when paging back over visited pages', async () => {
    const src = fakeSource(Array.from({ length: 100 }, (_, i) => `row${i}`));
    const list = new PagedList(src.fetchPage, async () => 100, 10);
    await list.reload();
    await list.goTo(4);
    src.calls.length = 0;

    await list.goTo(2);

    expect(list.items()[0]).toBe('row10');
    // The cursor for page 2 was learned on the way out; going back is one query.
    expect(src.calls.length).toBe(1);
  });

  it('drops every cached cursor on reload', async () => {
    const src = fakeSource(Array.from({ length: 100 }, (_, i) => `row${i}`));
    const list = new PagedList(src.fetchPage, async () => 100, 10);
    await list.reload();
    await list.goTo(5);

    await list.reload();

    // The regression this guards: a filter change that kept its cursors would
    // page through positions in a result set that no longer exists.
    expect(list.currentPage()).toBe(1);
    expect(list.items()[0]).toBe('row0');
  });

  it('clamps a page beyond the end instead of looping', async () => {
    const src = fakeSource(Array.from({ length: 25 }, (_, i) => `row${i}`));
    const list = new PagedList(src.fetchPage, async () => 25, 10);
    await list.reload();

    await list.goTo(99);

    expect(list.currentPage()).toBe(3);
    expect(list.items()).toEqual(['row20', 'row21', 'row22', 'row23', 'row24']);
  });

  it('reports an empty collection as one page, not zero', async () => {
    const src = fakeSource([]);
    const list = new PagedList(src.fetchPage, async () => 0, 10);

    await list.reload();

    // `totalPages` of 0 would make the pager render nothing and `goTo` clamp to
    // 0, which is not a page.
    expect(list.totalPages()).toBe(1);
    expect(list.rangeStart()).toBe(0);
    expect(list.rangeEnd()).toBe(0);
  });

  it('degrades to empty and reports when a fetch fails', async () => {
    const errors: unknown[] = [];
    const list = new PagedList<string>(
      async () => { throw new Error('offline'); },
      async () => 10,
      10,
      e => errors.push(e)
    );

    await list.reload();

    expect(list.items()).toEqual([]);
    expect(list.total()).toBe(0);
    expect(errors.length).toBe(1);
    expect(list.isLoading()).toBe(false);
  });

  it('describes the current page as a range of the whole', async () => {
    const src = fakeSource(Array.from({ length: 95 }, (_, i) => `row${i}`));
    const list = new PagedList(src.fetchPage, async () => 95, 20);
    await list.reload();
    await list.goTo(5);

    expect(list.rangeStart()).toBe(81);
    expect(list.rangeEnd()).toBe(95);
  });

  it('keeps the reader in place on refresh after an in-place edit', async () => {
    const src = fakeSource(Array.from({ length: 100 }, (_, i) => `row${i}`));
    const list = new PagedList(src.fetchPage, async () => 100, 10);
    await list.reload();
    await list.goTo(6);

    await list.refresh();

    expect(list.currentPage()).toBe(6);
  });
});

describe('PagedList with a search typed quickly', () => {
  // A search box reloads on every pause in typing, so an earlier, slower answer
  // can land after a later one. The list must show the LATEST query's rows.
  it('keeps the newest reload when an older one answers last', async () => {
    let releaseFirst!: () => void;
    let query = 'sa';
    const fetchPage = async (): Promise<PagedResult<string>> => {
      const asked = query;
      if (asked === 'sa') await new Promise<void>(resolve => (releaseFirst = resolve));
      return { items: [`rows for ${asked}`], nextCursor: undefined };
    };
    const list = new PagedList<string>(fetchPage, async () => 1, 10);

    const first = list.reload();                 // "sa": slow
    await Promise.resolve();
    query = 'sara';
    await list.reload();                         // "sara": answers first
    releaseFirst();
    await first;                                 // "sa" answers last and must be ignored

    expect(list.items()).toEqual(['rows for sara']);
    expect(list.isLoading()).toBe(false);
  });
});

describe('buildPageNumbers', () => {
  it('lists every page when there are few enough to fit', () => {
    expect(buildPageNumbers(5, 3)).toEqual([1, 2, 3, 4, 5]);
  });

  it('elides the middle but always keeps the first and last', () => {
    expect(buildPageNumbers(20, 10)).toEqual([1, '...', 9, 10, 11, '...', 20]);
  });

  it('does not open with an ellipsis when the window touches the start', () => {
    expect(buildPageNumbers(20, 2)).toEqual([1, 2, 3, '...', 20]);
  });

  it('does not close with an ellipsis when the window touches the end', () => {
    expect(buildPageNumbers(20, 19)).toEqual([1, '...', 18, 19, 20]);
  });

  /**
   * Signing out re-creates whatever admin screen was open (the shell swaps its
   * `router-outlet` the moment `isAuthenticated()` flips, against the route
   * that is still active until `/login` is reached). That fresh instance loads
   * in its constructor and fails on a cleared tenant. Every list passes a fixed
   * message to `onError`, so reporting it would raise "Failed to load users."
   * over the login screen — toasts outlive the navigation.
   */
  it('does not report a load that failed because the session ended', async () => {
    const reported: unknown[] = [];
    const list = new PagedList<string>(
      () => Promise.reject(new TenantUnavailableError('AppUserService', 'signed-out')),
      () => Promise.reject(new TenantUnavailableError('AppUserService', 'signed-out')),
      5,
      error => reported.push(error)
    );

    await list.reload();

    expect(reported).toEqual([]);
    expect(list.items()).toEqual([]);
  });

  it('still reports a genuine load failure', async () => {
    const reported: unknown[] = [];
    const boom = new Error('backend exploded');
    const list = new PagedList<string>(
      () => Promise.reject(boom),
      () => Promise.reject(boom),
      5,
      error => reported.push(error)
    );

    await list.reload();

    expect(reported).toEqual([boom]);
  });
});
