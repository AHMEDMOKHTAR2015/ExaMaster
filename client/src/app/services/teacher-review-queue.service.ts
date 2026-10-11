import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { AuthService } from './auth';
import { ApiClient } from './api/api-client.service';
import { ApiPage } from './api/api-models';
import { safetyNetPoll } from './shared/safety-net-poll';

/**
 * The sidebar's Validation badge: how many submissions the signed-in teacher
 * still has to review (`GET /reviews`, whose total is the queue's length).
 *
 * The count is read when a teacher signs in, whenever the live channel says
 * their queue changed (`RealtimeService`), straight away when they save a
 * review ({@link refresh}), and every {@link POLL_MS} as a safety net while the
 * live channel is down and the tab is visible (`safetyNetPoll`). A root
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

  private generation = 0;

  constructor() {
    const isTeacher = () => this.authService.user()?.roles?.includes('teacher') ?? false;

    effect(() => {
      const teacher = isTeacher();
      this.authService.user();                                   // a change of account resets it, even to one with the same role
      this.generation++;
      this.count.set(0);
      if (teacher) void this.refresh();
    }, { allowSignalWrites: true });

    safetyNetPoll({
      intervalMs: TeacherReviewQueueService.POLL_MS, active: isTeacher, coveredByLiveChannel: true,
      refresh: () => void this.refresh()
    });
    inject(DestroyRef).onDestroy(() => this.generation++);
  }

  /** Read the count now. Failures leave the last known value: a badge is not worth an error. */
  async refresh(): Promise<void> {
    if (!this.authService.user()) return;
    const generation = this.generation;
    try {
      const page = await this.api.get<ApiPage<unknown>>('/reviews', { page: 1, pageSize: 1 });
      if (generation === this.generation) this.count.set(page.totalCount);
    } catch {
      // Offline, or signed out mid-request.
    }
  }

}
