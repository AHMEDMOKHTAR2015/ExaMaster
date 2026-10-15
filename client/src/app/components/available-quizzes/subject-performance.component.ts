import { Component, ChangeDetectionStrategy, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SubjectPerformanceService } from '../../services/subject-performance.service';
import { SubjectPerformance } from '../../models';
import { BaseComponent } from '../../shared/base';

const RING_RADIUS = 46;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** `stroke-dasharray` / `stroke-dashoffset` for the earned (green) and missed (red) arcs of one donut. */
interface RingArcs {
  earned: string;
  missed: string;
  missedOffset: number;
}

/**
 * The student dashboard's "My Subjects" row: one donut per subject, green for what they earned and red for what
 * they missed, so strengths and weaknesses read at a glance. Ordered strongest first by the API.
 *
 * Given a `childId`, it shows that child instead, for their parent (the child profile under My Children): same
 * donuts, worded about the child, reloaded whenever the parent switches to another child.
 */
@Component({
  selector: 'app-subject-performance',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <section class="subject-perf" aria-labelledby="subject-perf-title">
      <div class="subject-perf__head">
        <h2 id="subject-perf-title" class="subject-perf__title">{{ copy() + '.title' | translate }}</h2>
        <p class="subject-perf__subtitle">{{ copy() + '.subtitle' | translate }}</p>
      </div>

      @if (loading()) {
        <p class="subject-perf__note">{{ copy() + '.loading' | translate }}</p>
      } @else if (hasError()) {
        <p class="subject-perf__note subject-perf__note--error">{{ copy() + '.loadFailed' | translate }}</p>
      } @else if (subjects().length === 0) {
        <p class="subject-perf__note">{{ copy() + '.empty' | translate }}</p>
      } @else {
        <ul class="subject-perf__grid">
          @for (subject of subjects(); track subject.subjectId) {
            <li class="subject-perf__tile">
              <div class="subject-ring">
                <svg class="subject-ring__svg" viewBox="0 0 120 120" aria-hidden="true">
                  <circle class="subject-ring__track" cx="60" cy="60" [attr.r]="ringRadius" />
                  @if (subject.scorePercent !== undefined) {
                    <circle class="subject-ring__arc subject-ring__arc--missed" cx="60" cy="60" [attr.r]="ringRadius"
                            [style.stroke-dasharray]="arcs(subject.scorePercent).missed"
                            [style.stroke-dashoffset]="arcs(subject.scorePercent).missedOffset"
                            transform="rotate(-90 60 60)" />
                    <circle class="subject-ring__arc subject-ring__arc--earned" cx="60" cy="60" [attr.r]="ringRadius"
                            [style.stroke-dasharray]="arcs(subject.scorePercent).earned"
                            transform="rotate(-90 60 60)" />
                  }
                </svg>
                <span class="subject-ring__value">
                  @if (subject.scorePercent !== undefined) { {{ subject.scorePercent }}% } @else { — }
                </span>
              </div>

              <div class="subject-perf__body">
                <div class="subject-perf__headline">
                  <span class="subject-perf__name">
                    <span class="subject-perf__dot" [style.background]="subject.subjectColor || null" aria-hidden="true"></span>
                    {{ subject.subjectName }}
                  </span>

                  @if (subject.level; as level) {
                    <span class="subject-perf__level subject-perf__level--{{ level }}">
                      {{ 'availableQuizzes.subjectPerformance.levels.' + level | translate }}
                    </span>
                  } @else {
                    <span class="subject-perf__level">{{ 'availableQuizzes.subjectPerformance.awaitingMarks' | translate }}</span>
                  }
                </div>

                <!-- Every submission in the subject over the period, marked or not (rejected ones are not counted). -->
                <span class="subject-perf__meta subject-perf__count"
                      [title]="'availableQuizzes.subjectPerformance.participationsHint' | translate : { quizzes: subject.quizCount, homework: subject.homeworkCount }">
                  <svg viewBox="0 0 24 24" fill="none" width="13" height="13" aria-hidden="true"><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/></svg>
                  {{ 'availableQuizzes.subjectPerformance.participations' | translate : { count: subject.quizCount + subject.homeworkCount } }}
                </span>

                @if (subject.pointsPossible > 0) {
                  <span class="subject-perf__meta">
                    {{ 'availableQuizzes.subjectPerformance.points' | translate : { earned: subject.pointsEarned, possible: subject.pointsPossible } }}
                  </span>
                }

                @if (subject.trendPoints !== undefined) {
                  <span class="subject-perf__trend"
                        [class.subject-perf__trend--up]="subject.trendPoints > 0"
                        [class.subject-perf__trend--down]="subject.trendPoints < 0"
                        [title]="'availableQuizzes.subjectPerformance.trendHint' | translate">
                    @if (subject.trendPoints > 0) {
                      {{ 'availableQuizzes.subjectPerformance.trendUp' | translate : { points: subject.trendPoints } }}
                    } @else if (subject.trendPoints < 0) {
                      {{ 'availableQuizzes.subjectPerformance.trendDown' | translate : { points: -subject.trendPoints } }}
                    } @else {
                      {{ 'availableQuizzes.subjectPerformance.trendSteady' | translate }}
                    }
                  </span>
                }

                @if (subject.awaitingReviewCount > 0 && subject.scorePercent !== undefined) {
                  <span class="subject-perf__meta">
                    {{ 'availableQuizzes.subjectPerformance.awaitingReview' | translate : { count: subject.awaitingReviewCount } }}
                  </span>
                }
              </div>
            </li>
          }
        </ul>
      }
    </section>
  `
})
export class SubjectPerformanceComponent extends BaseComponent {
  private readonly subjectPerformanceService = inject(SubjectPerformanceService);

  /** A parent's child to show; absent, the signed-in student's own subjects. */
  readonly childId = input<string>();

  protected readonly ringRadius = RING_RADIUS;
  protected readonly subjects = signal<SubjectPerformance[]>([]);
  /** The heading and notes speak to the student ("your level") or about the child. */
  protected readonly copy = computed(() =>
    this.childId() ? 'childProfile.subjects' : 'availableQuizzes.subjectPerformance');

  /** Bumped per load, so a slow answer for the child the parent just left never replaces the current one's. */
  private loadToken = 0;

  constructor() {
    super();
    effect(() => {
      const childId = this.childId();
      untracked(() => void this.load(childId));
    });
  }

  private async load(childId: string | undefined): Promise<void> {
    const token = ++this.loadToken;
    this.subjects.set([]);
    this.setLoading(true);
    try {
      const subjects = childId
        ? await this.subjectPerformanceService.listForChild(childId)
        : await this.subjectPerformanceService.listMine();
      if (token !== this.loadToken) return;
      this.subjects.set(subjects);
      this.setLoading(false);
    } catch (error) {
      if (token === this.loadToken) this.setError(error instanceof Error ? error.message : String(error));
    }
  }

  // Both arcs start at 12 o'clock; the red one is pushed back by the green one's length so it begins where green ends.
  protected arcs(scorePercent: number): RingArcs {
    const earned = (Math.max(0, Math.min(100, scorePercent)) / 100) * RING_CIRCUMFERENCE;
    const missed = RING_CIRCUMFERENCE - earned;
    return {
      earned: `${earned} ${RING_CIRCUMFERENCE}`,
      missed: `${missed} ${RING_CIRCUMFERENCE}`,
      missedOffset: -earned
    };
  }
}
