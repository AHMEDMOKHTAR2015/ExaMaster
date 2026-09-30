import { Component, signal, inject, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { BaseComponent } from '../../shared/base/base.component';
import { AuthService } from '../../services/auth';
import { UserAdminService, ParticipationService } from '../../services/admin';
import { HomeworkService } from '../../services/homework.service';
import { User, ParticipationRecord, AssignmentKind } from '../../models';
import { participationScorePercent } from '../../shared/participation-score';

/** Page size for the merged feed, applied to the Firebase reads too — each `listByUserDesc` call fetches exactly one page per child. */
const PARTICIPATION_PAGE_SIZE = 5;

/**
 * Parent/User Admin's "All Children's Participation History" — split out of
 * {@link UserAdminDashboardViewComponent} (`/parent-dashboard`) into its own
 * route so the merged history has a page (and a URL) of its own instead of
 * living at the bottom of the dashboard.
 */
@Component({
  selector: 'app-participation-history',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './participation-history.component.html',
})
export class ParticipationHistoryComponent extends BaseComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly userAdminService = inject(UserAdminService);
  private readonly participationService = inject(ParticipationService);
  private readonly homeworkService = inject(HomeworkService);

  readonly currentUser = this.authService.user;

  readonly children = signal<User[]>([]);

  // Merged, newest-first feed across every child, paginated 5-at-a-time,
  // buffered from Firebase 5 records per child per call — paging past the
  // buffered records triggers another round of per-child fetches.
  readonly allParticipations = signal<ParticipationRecord[]>([]);
  readonly allParticipationsPage = signal<number>(0);
  /** Per-child continuation cursors + exhaustion flags for the merged feed. */
  private readonly cursors = new Map<string, string | undefined>();
  private readonly done = new Set<string>();

  readonly pagedParticipations = computed(() => {
    const start = this.allParticipationsPage() * PARTICIPATION_PAGE_SIZE;
    return this.allParticipations().slice(start, start + PARTICIPATION_PAGE_SIZE);
  });
  readonly hasMoreParticipations = computed(() => {
    const nextStart = (this.allParticipationsPage() + 1) * PARTICIPATION_PAGE_SIZE;
    return this.allParticipations().length > nextStart || this.done.size < this.children().length;
  });

  /**
   * `ParticipationRecord.type` can't tell a quiz-kind assignment from real
   * homework — see `user-admin-dashboard-view.component.ts`'s copy of this
   * same cache for the full explanation. Resolved lazily per `homeworkId`.
   */
  private readonly assignmentKindByHomeworkId = signal<Map<string, AssignmentKind>>(new Map());

  ngOnInit(): void {
    this.loadInitialData();
  }

  private async loadInitialData(): Promise<void> {
    this.setLoading(true);
    try {
      await this.loadChildren();
      await this.loadMoreParticipations();
    } catch (error) {
      this.setError(error instanceof Error ? error.message : 'Failed to load participation history');
    } finally {
      this.setLoading(false);
    }
  }

  private async loadChildren(): Promise<void> {
    const user = this.currentUser();
    if (!user) return;
    this.children.set(await this.userAdminService.listMyChildren());
  }

  /** Fetches one more page (5 records per child) and merges it into the sorted, buffered feed. */
  async loadMoreParticipations(): Promise<void> {
    const parentId = this.currentUser()?.uid;
    if (!parentId) return;

    this.setLoading(true);
    try {
      // One request per child, all in flight at once. These are independent
      // queries against different children with no ordering between them, so
      // awaiting them one at a time cost N round trips of latency before
      // anything could paint — with four children on a slow connection that is
      // the difference between one wait and four.
      const pending = this.children().filter(child => !this.done.has(child.uid));
      const pages = await Promise.all(pending.map(child =>
        this.participationService
          .listByUserDesc(child.uid, parentId, PARTICIPATION_PAGE_SIZE, this.cursors.get(child.uid))
          .then(result => ({ child, result }))
      ));

      // Cursor/exhaustion bookkeeping is applied after the fact, in list order,
      // so concurrency doesn't make which cursor lands depend on timing.
      const fetched: ParticipationRecord[] = [];
      for (const { child, result } of pages) {
        fetched.push(...result.items);
        if (result.nextCursor) {
          this.cursors.set(child.uid, result.nextCursor);
        } else {
          this.done.add(child.uid);
        }
      }

      this.allParticipations.update(items => [...items, ...fetched].sort((a, b) => b.endedAt - a.endedAt));

      // Deliberately not awaited. The rows above are complete and can paint
      // now; the only thing this resolves is the quiz-vs-homework badge, and
      // `recordKindLabel` already reads 'homework' until the cache fills, so
      // the badge refines in place a moment later. Awaiting it held the entire
      // screen for one more round trip. A failure now costs a possibly-wrong
      // badge rather than blanking the page with an error banner.
      void this.resolveAssignmentKinds(fetched).catch(() => undefined);
    } finally {
      this.setLoading(false);
    }
  }

  /** Advances the merged feed a page, fetching another round of pages first if the buffer is short. */
  async nextPage(): Promise<void> {
    const nextStart = (this.allParticipationsPage() + 1) * PARTICIPATION_PAGE_SIZE;
    if (this.allParticipations().length <= nextStart && this.done.size < this.children().length) {
      await this.loadMoreParticipations();
    }
    if (this.allParticipations().length > nextStart) {
      this.allParticipationsPage.update(p => p + 1);
    }
  }

  prevPage(): void {
    this.allParticipationsPage.update(p => Math.max(0, p - 1));
  }

  /** Looks up + caches the true `kind` (quiz vs. homework) of every not-yet-seen `homeworkId` among `records`. */
  private async resolveAssignmentKinds(records: ParticipationRecord[]): Promise<void> {
    const cache = this.assignmentKindByHomeworkId();
    const missingIds = [...new Set(
      records.map(r => r.homeworkId).filter((id): id is string => !!id && !cache.has(id))
    )];
    if (missingIds.length === 0) return;

    const resolved = await Promise.all(missingIds.map(async id =>
      [id, (await this.homeworkService.getById(id))?.kind ?? 'homework'] as const
    ));
    this.assignmentKindByHomeworkId.update(map => {
      const next = new Map(map);
      for (const [id, kind] of resolved) next.set(id, kind);
      return next;
    });
  }

  /** True display kind for a participation row — see {@link assignmentKindByHomeworkId}. */
  recordKindLabel(record: ParticipationRecord): 'quiz' | 'homework' {
    if (record.homeworkId) {
      return this.assignmentKindByHomeworkId().get(record.homeworkId) ?? 'homework';
    }
    return record.type === 'quiz' ? 'quiz' : 'homework';
  }

  /** The name to show alongside {@link recordKindLabel} — the assignment's own title when it was assigned, else the quiz's name. */
  recordTitle(record: ParticipationRecord): string {
    return record.homeworkTitle || record.quizName || `Quiz #${record.quizId}`;
  }

  /**
   * uid → child. `getChildName` is called from the template for every visible
   * row and re-runs on each change-detection pass, so a linear scan of the
   * children list per call is work paid over and over for an answer that only
   * changes when `children()` does.
   */
  private readonly childrenById = computed(() =>
    new Map(this.children().map(child => [child.uid, child] as const))
  );

  getChildName(childId: string): string {
    return this.childrenById().get(childId)?.displayName || 'Unknown';
  }

  /**
   * `record.score` is a raw correct-answer count, not a percentage. Resolved
   * through the shared helper so a parent sees the same figure the student and
   * the teacher do — including after a teacher marks an Explain answer.
   */
  scorePercent(record: ParticipationRecord): number {
    return participationScorePercent(record);
  }

  /** Color tier for the participation-card score ring — drives `.participation-card__score--*`. */
  scoreTier(record: ParticipationRecord): 'high' | 'mid' | 'low' {
    const percent = this.scorePercent(record);
    if (percent >= 70) return 'high';
    if (percent >= 40) return 'mid';
    return 'low';
  }

  /**
   * Only real homework goes through teacher review — quizzes (bank or
   * quiz-kind assignments) are auto-scored. Takes the already-resolved kind
   * rather than the record, so the row doesn't derive it a second time.
   */
  needsReviewStatus(kind: 'quiz' | 'homework'): boolean {
    return kind === 'homework';
  }

  /** Maps `ParticipationRecord.validation` to the shared `notifications.reviewStatus.*` i18n keys (already translated for both locales). */
  reviewStatusKey(record: ParticipationRecord): 'approved' | 'revision-requested' | 'pending' {
    if (record.validation?.status === 'approved') return 'approved';
    if (record.validation?.status === 'rejected') return 'revision-requested';
    return 'pending';
  }

  reviewStatusBadgeClass(record: ParticipationRecord): string {
    const key = this.reviewStatusKey(record);
    if (key === 'approved') return 'badge--success';
    if (key === 'revision-requested') return 'badge--warning';
    return 'badge--muted';
  }
}
