import { computed, signal } from '@angular/core';
import { PagedSource } from '../services/shared/query-spec';
import { isSessionEndedError } from '../services/tenant/tenant-context.service';

/**
 * A list that grows a page at a time ("Load more"), for pickers that offer a
 * filtered slice of a large collection — the question bank, typically. The API
 * does the filtering, so what is shown is always the head of the full result and
 * {@link total} is how many match in all.
 *
 * The source is resolved on each {@link reload} (a filter or a search box the
 * user changes stays live), and returns `null` when there is nothing to ask yet
 * (the picker's scope is incomplete), which empties the list. A reload started
 * later always wins: an older, slower answer is discarded, so typing quickly
 * never leaves an earlier search's rows on screen.
 *
 * {@link PagedList} is the numbered-pager counterpart for tables.
 */
export class LoadMoreList<T> {
  readonly items = signal<T[]>([]);
  readonly total = signal(0);
  readonly isLoading = signal(false);
  readonly isLoadingMore = signal(false);
  readonly hasMore = computed(() => this.items().length < this.total());

  private nextCursor: string | undefined;
  private generation = 0;

  constructor(
    private readonly source: () => PagedSource<T> | null,
    readonly pageSize = 50,
    /** Reported instead of throwing: the list degrades to empty rather than taking the screen down. */
    private readonly onError?: (error: unknown) => void
  ) {}

  /** The first page of the current source, and how many match in all. */
  async reload(): Promise<void> {
    const run = ++this.generation;
    const source = this.source();
    if (!source) {
      this.clear();
      return;
    }
    this.isLoading.set(true);
    try {
      const [page, total] = await Promise.all([source.fetchPage(this.pageSize), source.fetchCount()]);
      if (run !== this.generation) return;
      this.items.set(page.items);
      this.nextCursor = page.nextCursor;
      this.total.set(total);
    } catch (error) {
      if (run !== this.generation) return;
      this.items.set([]);
      this.total.set(0);
      this.report(error);
    } finally {
      if (run === this.generation) this.isLoading.set(false);
    }
  }

  /** The next page of the same result, appended. */
  async loadMore(): Promise<void> {
    const source = this.source();
    if (!source || !this.nextCursor || this.isLoadingMore()) return;
    const run = this.generation;
    this.isLoadingMore.set(true);
    try {
      const page = await source.fetchPage(this.pageSize, this.nextCursor);
      if (run !== this.generation) return;
      this.items.update(loaded => [...loaded, ...page.items]);
      this.nextCursor = page.nextCursor;
    } catch (error) {
      if (run === this.generation) this.report(error);
    } finally {
      this.isLoadingMore.set(false);
    }
  }

  /** Empty the list, discarding anything still in flight. */
  clear(): void {
    this.generation++;
    this.items.set([]);
    this.total.set(0);
    this.nextCursor = undefined;
    this.isLoading.set(false);
  }

  private report(error: unknown): void {
    if (!isSessionEndedError(error)) this.onError?.(error);
  }
}
