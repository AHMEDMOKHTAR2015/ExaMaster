import { Signal, computed, signal } from '@angular/core';
import { PagedResult } from '../models';
import { PagedSource } from '../services/shared/query-spec';
import { isSessionEndedError } from '../services/tenant/tenant-context.service';

/**
 * Server-side pagination for one list screen.
 *
 * Every admin table used to load its whole collection — `do { … } while (cursor)`
 * until Firestore ran out of pages — and then slice that array in memory to draw
 * "page 1 of 11". It works until a collection grows: the cost is every document
 * on every visit, the memory is every document at once, and the browser stalls
 * long before Firestore does. `participations` grows with every submission
 * forever, and `users` with every enrolment, so this is a question of when.
 *
 * The algorithm here is lifted from the Questions Bank tab, which has always
 * paged properly; extracting it means the other screens adopt a version that has
 * been in production rather than six new hand-written copies.
 *
 * **Cursors, not offsets.** Firestore has no `OFFSET`, so page N is only
 * reachable by walking cursors from page N-1. {@link goTo} therefore walks
 * forward through any pages it has not seen (one small query each) and caches
 * each cursor it learns, so paging back and forth costs nothing after the first
 * pass. Jumping from page 1 to page 12 costs twelve queries once — the price of
 * a numbered pager, and still far less than reading the whole collection.
 *
 * **The total comes from an aggregation query.** `getCountFromServer` bills a
 * fraction of a read regardless of collection size, so the page count is cheap
 * and correct rather than `items.length` over a full download.
 *
 * ### What a caller has to know
 *
 * - `fetchPage` must be a *stable ordering* — {@link PagedResult} cursors are
 *   tuples matched to an `orderBy`, so changing the sort means starting over
 *   ({@link reload}).
 * - `fetchCount` must count the SAME filtered set `fetchPage` reads, or the
 *   pager will offer pages that come back empty.
 * - Anything that changes the filter must call {@link reload}, which drops every
 *   cached cursor and returns to page 1. Keeping a stale cursor across a filter
 *   change is the one way to get genuinely wrong results out of this class.
 */
export class PagedList<T> {
  /** The current page's rows. Empty until the first {@link reload}. */
  readonly items = signal<T[]>([]);
  readonly currentPage = signal<number>(1);
  /** Total matching documents, from the server's count — not `items().length`. */
  readonly total = signal<number>(0);
  readonly isLoading = signal<boolean>(false);

  /**
   * Cursor for the START of each page: index 0 is page 1 (no cursor), index 1 is
   * page 2, and so on. Grows as pages are visited; cleared by {@link reload}.
   */
  private cursors: (string | undefined)[] = [undefined];

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));

  /** Page numbers with ellipses, for a numbered pager. */
  readonly pageNumbers: Signal<(number | string)[]> = computed(() =>
    buildPageNumbers(this.totalPages(), this.currentPage())
  );

  readonly hasPrevious = computed(() => this.currentPage() > 1);
  readonly hasNext = computed(() => this.currentPage() < this.totalPages());

  /** Range of the current page as 1-based inclusive bounds, for "showing X–Y of Z". */
  readonly rangeStart = computed(() =>
    this.total() === 0 ? 0 : (this.currentPage() - 1) * this.pageSize + 1
  );
  readonly rangeEnd = computed(() =>
    Math.min(this.currentPage() * this.pageSize, this.total())
  );

  /**
   * Bumped by every {@link reload}. A search box reloads on each pause in typing,
   * so an older, slower answer can arrive after a newer one; anything that
   * started under an earlier generation is discarded rather than shown.
   */
  private generation = 0;

  constructor(
    private readonly fetchPage: (pageSize: number, cursor?: string) => Promise<PagedResult<T>>,
    private readonly fetchCount: () => Promise<number>,
    readonly pageSize = 20,
    /**
     * Reported instead of throwing when a fetch fails. The list degrades to
     * empty rather than taking the screen down; the caller's own error handling
     * (the repositories already toast) says what went wrong.
     */
    private readonly onError?: (error: unknown) => void
  ) {}

  /**
   * Report a failure, unless the session ending is what caused it.
   *
   * Every list screen passes a fixed message here ("Failed to load users."),
   * so without this the act of signing out raises an error naming the screen
   * the user just left — on top of the login screen, since these are toasts
   * and toasts outlive the navigation.
   */
  private report(error: unknown): void {
    if (isSessionEndedError(error)) return;
    this.onError?.(error);
  }

  /**
   * Build from a {@link PagedSource}: a page fetch and a count over the same
   * filters, so the list and its page count cannot end up filtered differently.
   *
   * The source is resolved per call, not captured once, so a source that reads
   * a signal (a filter the user can change) stays live — `reload()` re-derives it.
   */
  static from<T>(
    source: () => PagedSource<T>,
    pageSize = 20,
    onError?: (error: unknown) => void
  ): PagedList<T> {
    return new PagedList<T>(
      (size, cursor) => source().fetchPage(size, cursor),
      () => source().fetchCount(),
      pageSize,
      onError
    );
  }

  /**
   * Re-read the total and return to page 1, discarding every cached cursor.
   *
   * The only correct response to a changed filter, and to a write that may have
   * added or removed rows — a cursor is a position in a specific ordered result
   * set, so it means nothing once that set changes.
   */
  async reload(): Promise<void> {
    const run = ++this.generation;
    this.cursors = [undefined];
    this.isLoading.set(true);
    try {
      const total = await this.fetchCount();
      if (run !== this.generation) return;
      this.total.set(total);
      await this.fetchInto(1, run);
    } catch (error) {
      if (run !== this.generation) return;
      this.items.set([]);
      this.total.set(0);
      this.report(error);
    } finally {
      if (run === this.generation) this.isLoading.set(false);
    }
  }

  /** Go to a 1-based page, walking cursors forward if it has not been visited. */
  async goTo(page: number): Promise<void> {
    const target = Math.min(Math.max(1, Math.floor(page)), this.totalPages());
    if (this.isLoading()) return;
    this.isLoading.set(true);
    try {
      await this.fetchInto(target, this.generation);
    } catch (error) {
      this.report(error);
    } finally {
      this.isLoading.set(false);
    }
  }

  next(): Promise<void> {
    return this.hasNext() ? this.goTo(this.currentPage() + 1) : Promise.resolve();
  }

  previous(): Promise<void> {
    return this.hasPrevious() ? this.goTo(this.currentPage() - 1) : Promise.resolve();
  }

  /**
   * Refresh the page currently on screen without moving.
   *
   * For an in-place edit, where the row set is unchanged and resetting to page 1
   * would throw the user's position away. A delete should use {@link reload}
   * instead: it shifts every subsequent row, so the cached cursors no longer
   * point where they claim to.
   */
  async refresh(): Promise<void> {
    const page = this.currentPage();
    this.isLoading.set(true);
    const run = this.generation;
    try {
      const total = await this.fetchCount();
      if (run !== this.generation) return;
      this.total.set(total);
      await this.fetchInto(Math.min(page, this.totalPages()), run);
    } catch (error) {
      this.report(error);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Walk forward to `page`, learning each cursor on the way, then load it.
   *
   * The walk stops early when a page reports no `nextCursor` — that is the end
   * of the data, and asking for anything beyond it would loop.
   */
  private async fetchInto(page: number, run: number): Promise<void> {
    while (this.cursors.length < page) {
      const known = this.cursors.length;
      const step = await this.fetchPage(this.pageSize, this.cursors[known - 1]);
      if (run !== this.generation) return;
      if (!step.nextCursor) break;
      this.cursors[known] = step.nextCursor;
    }

    const target = Math.min(page, this.cursors.length);
    const result = await this.fetchPage(this.pageSize, this.cursors[target - 1]);
    // A reload started while this was in flight (a search typed further): its answer, not this one, is current.
    if (run !== this.generation) return;
    // Record the cursor this page hands forward, so the next page is one query.
    this.cursors[target] = result.nextCursor;
    this.items.set(result.items);
    this.currentPage.set(target);
  }
}

/**
 * Page numbers for a numbered pager, with `'...'` where a run is elided.
 *
 * Always shows the first and last page plus a window around the current one, so
 * the control has a stable width however many pages there are.
 */
export function buildPageNumbers(total: number, current: number): (number | string)[] {
  const pages: (number | string)[] = [];
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
    return pages;
  }
  pages.push(1);
  if (current > 3) pages.push('...');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}
