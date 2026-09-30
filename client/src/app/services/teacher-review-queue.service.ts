import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { AuthService } from './auth';
import { ApiClient } from './api/api-client.service';
import { ApiPage } from './api/api-models';

/**
 * The sidebar's Validation badge: how many submissions the signed-in teacher
 * still has to review (`GET /reviews`, whose total is the queue's length).
 *
 * The count is read when a teacher signs in, whenever the live channel says
 * their queue changed (`RealtimeService`), straight away when they save a
 * review ({@link refresh}), and every {@link POLL_MS} as a safety net. A root
 * singleton: the effect below clears it the moment the signed-in account
 * changes, so one teacher's backlog never shows on another's badge.
 */
@Injectable({ providedIn: 'root' })
export class TeacherReviewQueueService {
  private static readonly POLL_MS = 5 * 60_000;

  private readonly api = inject(ApiClient);
  private readonly authService = inject(AuthService);

  private readonly count = signal(0);
  readonly pendingCount = this.count.asReadonly();

  private timer: ReturnType<typeof setInterval> | null = null;
  private generation = 0;

  constructor() {
    effect(() => {
      const user = this.authService.user();
      const isTeacher = user?.roles?.includes('teacher') ?? false;
      this.stop();
      this.count.set(0);
      if (!user || !isTeacher) return;

      void this.refresh();
      this.timer = setInterval(() => void this.refresh(), TeacherReviewQueueService.POLL_MS);
    }, { allowSignalWrites: true });

    inject(DestroyRef).onDestroy(() => this.stop());
  }

  /** Read the count now. Failures leave the last known value: a badge is not worth an error. */
  async refresh(): Promise<void> {
    if (!this.timer && !this.authService.user()) return;
    const generation = this.generation;
    try {
      const page = await this.api.get<ApiPage<unknown>>('/reviews', { page: 1, pageSize: 1 });
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
