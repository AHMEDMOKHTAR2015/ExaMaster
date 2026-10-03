import { Component, ChangeDetectionStrategy, OnInit, inject, signal } from '@angular/core';
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
 */
@Component({
  selector: 'app-subject-performance',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <section class="subject-perf" aria-labelledby="subject-perf-title">
      <div class="subject-perf__head">
        <h2 id="subject-perf-title" class="subject-perf__title">{{ 'availableQuizzes.subjectPerformance.title' | translate }}</h2>
        <p class="subject-perf__subtitle">{{ 'availableQuizzes.subjectPerformance.subtitle' | translate }}</p>
      </div>

      @if (loading()) {
        <p class="subject-perf__note">{{ 'availableQuizzes.subjectPerformance.loading' | translate }}</p>
      } @else if (hasError()) {
        <p class="subject-perf__note subject-perf__note--error">{{ 'availableQuizzes.subjectPerformance.loadFailed' | translate }}</p>
      } @else if (subjects().length === 0) {
        <p class="subject-perf__note">{{ 'availableQuizzes.subjectPerformance.empty' | translate }}</p>
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

                <span class="subject-perf__meta">
                  {{ 'availableQuizzes.subjectPerformance.counts' | translate : { quizzes: subject.quizCount, homework: subject.homeworkCount } }}
                </span>

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
export class SubjectPerformanceComponent extends BaseComponent implements OnInit {
  private readonly subjectPerformanceService = inject(SubjectPerformanceService);

  protected readonly ringRadius = RING_RADIUS;
  protected readonly subjects = signal<SubjectPerformance[]>([]);

  async ngOnInit(): Promise<void> {
    this.setLoading(true);
    try {
      this.subjects.set(await this.subjectPerformanceService.listMine());
      this.setLoading(false);
    } catch (error) {
      this.setError(error instanceof Error ? error.message : String(error));
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
