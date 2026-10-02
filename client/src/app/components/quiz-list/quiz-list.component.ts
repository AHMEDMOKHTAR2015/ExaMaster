import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';

import { QuizInfo } from '../../interfaces';
import { QuizCardComponent } from '../quiz-card/quiz-card.component';
import { staggerList } from '../../shared/animations';

/**
 * Quiz list component - Displays grid of quiz cards
 * Follows Single Responsibility Principle - only handles list display
 */
@Component({
    selector: 'app-quiz-list',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [QuizCardComponent],
    templateUrl: './quiz-list.component.html',
    animations: [staggerList]
})
export class QuizListComponent {
  readonly quizzes = input<QuizInfo[]>([]);
  readonly loading = input(false);
  readonly skeletonCount = input(6);
  /** Count of extra cards projected via content (e.g. teacher-assigned quizzes) — keeps the grid/empty-state showing when the bank list itself is empty. */
  readonly extraCount = input(0);
  /**
   * Bank-quiz ids this student is locked out of, from a "One Time Join" attempt
   * they left. Passed as a set rather than per-card state so the list stays a
   * pure projection of the caller's data.
   */
  readonly lockedQuizIds = input<ReadonlySet<number>>(new Set<number>());
  /**
   * Subject id → name and colour, for the card's subject tag.
   *
   * `QuizInfo` carries only `subjectId`, and resolving it needs the subjects
   * collection — which this list has no business fetching. The caller already
   * holds it, so the lookup is passed down and the list stays a pure projection
   * of the caller's data, exactly as `lockedQuizIds` is.
   */
  readonly subjectLookup = input<ReadonlyMap<string, { name: string; color?: string }>>(new Map());
  readonly startQuiz = output<number>();

  /**
   * Emit start quiz event
   */
  onStartQuiz(quizId: number): void {
    this.startQuiz.emit(quizId);
  }

  /**
   * Track by for ngFor optimization
   */
  trackByQuizId(index: number, quiz: QuizInfo): number {
    return quiz.id;
  }
}
