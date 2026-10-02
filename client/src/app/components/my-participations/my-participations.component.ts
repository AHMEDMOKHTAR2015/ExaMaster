import { Component, computed, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { BaseComponent } from '../../shared/base/base.component';
import { ParticipationSummaryService } from '../../services/participation-summary.service';
import { ParticipationAnswersPopupComponent } from '../admin-dashboard/views/participation-answers-popup.component';
import { AssignmentKind, ParticipationRecord } from '../../models';
import { participationScorePercent } from '../../shared/participation-score';

type KindFilter = 'all' | AssignmentKind;

const PAGE_SIZE = 10;

/**
 * A student's own history: every quiz and homework they have submitted, newest
 * first, each opening the answer popup so they can see what they answered, what
 * the teacher marked, and — once an assignment is due — the correct answers.
 *
 * Reads `ParticipationSummaryService`, which already holds every attempt for
 * the Available Quizzes tiles; opening this page forces a fresh read so a
 * verdict given since still shows, while the attempts already known stay on
 * screen until it lands.
 */
@Component({
    selector: 'app-my-participations',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, TranslatePipe, ParticipationAnswersPopupComponent],
    templateUrl: './my-participations.component.html'
})
export class MyParticipationsComponent extends BaseComponent implements OnInit {
  private readonly summary = inject(ParticipationSummaryService);

  readonly filter = signal<KindFilter>('all');
  readonly page = signal(0);
  readonly selected = signal<ParticipationRecord | null>(null);

  /** Newest first, each with its real kind: an assignment can be quiz-kind, which `record.type` cannot tell. */
  private readonly rows = computed(() => {
    const kinds = this.summary.assignmentKinds();
    return [...this.summary.participationRecords()]
      .sort((a, b) => b.endedAt - a.endedAt)
      .map(record => ({
        record,
        kind: (record.homeworkId ? kinds.get(record.homeworkId) ?? 'homework' : 'quiz') as AssignmentKind
      }));
  });

  readonly counts = computed(() => {
    const rows = this.rows();
    return { all: rows.length, quiz: rows.filter(r => r.kind === 'quiz').length, homework: rows.filter(r => r.kind === 'homework').length };
  });

  private readonly filtered = computed(() => {
    const filter = this.filter();
    return filter === 'all' ? this.rows() : this.rows().filter(r => r.kind === filter);
  });

  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.filtered().length / PAGE_SIZE)));
  readonly visible = computed(() => this.filtered().slice(this.page() * PAGE_SIZE, (this.page() + 1) * PAGE_SIZE));

  readonly selectedKind = computed(() => {
    const record = this.selected();
    return record ? this.rows().find(r => r.record.id === record.id)?.kind ?? null : null;
  });

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    this.setLoading(true);
    this.clearError();
    try {
      await this.summary.refresh();
    } catch (error) {
      this.setError(error instanceof Error ? error.message : 'Failed to load your participations');
    } finally {
      this.setLoading(false);
    }
  }

  setFilter(filter: KindFilter): void {
    this.filter.set(filter);
    this.page.set(0);
  }

  prevPage(): void {
    this.page.update(p => Math.max(0, p - 1));
  }

  nextPage(): void {
    this.page.update(p => Math.min(this.pageCount() - 1, p + 1));
  }

  /** The assignment's own title when it was assigned, else the quiz's name. */
  title(record: ParticipationRecord): string {
    return record.homeworkTitle || record.quizName || `Quiz #${record.quizId}`;
  }

  scorePercent(record: ParticipationRecord): number {
    return participationScorePercent(record);
  }

  /** Colour tier for the score ring — drives `.participation-card__score--*`. */
  scoreTier(record: ParticipationRecord): 'high' | 'mid' | 'low' {
    const percent = this.scorePercent(record);
    if (percent >= 70) return 'high';
    if (percent >= 40) return 'mid';
    return 'low';
  }

  /** The shared `notifications.reviewStatus.*` keys. Only homework goes through a teacher's verdict. */
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
