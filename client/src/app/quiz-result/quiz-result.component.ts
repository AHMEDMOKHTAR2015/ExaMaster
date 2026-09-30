import { Component, input, output, inject, computed, ChangeDetectionStrategy } from '@angular/core';

import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Option, Question, Quiz, QUESTION_TYPE } from '../models';
import { normalizeCompleteAnswer } from '../shared/complete-question';
import { computeQuizWeighting, requiresManualReview, roundPercent, weightOf } from '../shared/question-scoring';
import { rightWrongLabelKey } from '../shared/right-wrong-question';

@Component({
  selector: 'quiz-result',
  templateUrl: './quiz-result.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, DatePipe]
})
export class QuizResultComponent {
  private router = inject(Router);
  private readonly translate = inject(TranslateService);

  readonly quiz = input.required<Quiz>();
  readonly embedded = input(false);
  readonly backToDashboard = output<void>();

  /**
   * `false` for a homework/assignment attempt submitted before its due date —
   * the server decides it (`POST /submissions`). Defaults to `true`, so every existing
   * caller (a standalone quiz, or homework read after this input was added but
   * not yet wired) renders exactly as before: this only ever *removes* the
   * per-question detail, on an explicit opt-in from the caller.
   */
  readonly resultsAvailable = input(true);
  /** When `!resultsAvailable()`, the assignment's due date — shown in the "come back later" message. */
  readonly resultsAvailableAt = input<number | null>(null);
  /**
   * The server's score/correct-count, for when `!resultsAvailable()`. The
   * per-question detail needed to recompute these client-side (`option.isAnswer`
   * etc.) is exactly what is withheld in that case, so the summary tiles use
   * these instead of the `score`/`correctCount` computed below.
   */
  readonly serverScorePercent = input<number | null>(null);
  readonly serverCorrectCount = input<number | null>(null);

  /** Exposed for the template to branch rendering on question type. */
  readonly QUESTION_TYPE = QUESTION_TYPE;

  isComplete(question: Question): boolean {
    return question.questionTypeId === QUESTION_TYPE.COMPLETE;
  }

  isExplain(question: Question): boolean {
    return question.questionTypeId === QUESTION_TYPE.EXPLAIN;
  }

  /**
   * Per-question verdict. Anything a teacher marks has no verdict at this point,
   * so it reports `'pending'` rather than being lumped in with wrong answers.
   *
   * Complete joined Explain here: a blank can have several right answers and the
   * author typed only one, so calling a synonym "wrong" on this screen would be
   * exactly the unfairness that review exists to prevent — and would contradict
   * the mark the teacher goes on to award.
   */
  isCorrect(question: Question): 'correct' | 'wrong' | 'pending' {
    if (requiresManualReview(question.questionTypeId)) return 'pending';
    return question.options.every(x => x.userSelected === x.isAnswer) ? 'correct' : 'wrong';
  };

  /** The student's typed value for a blank, or null if left empty. */
  getBlankUserAnswer(question: Question, index: number): string | null {
    const value = (question.blanks?.find(b => b.index === index)?.userAnswer ?? '').trim();
    return value.length > 0 ? value : null;
  }

  /** The correct keyword for a blank (populated at submission time). */
  getBlankCorrectAnswer(question: Question, index: number): string {
    return question.blanks?.find(b => b.index === index)?.answer ?? '';
  }

  blankIsCorrect(question: Question, index: number): boolean {
    const blank = question.blanks?.find(b => b.index === index);
    if (!blank) return false;
    return normalizeCompleteAnswer(blank.userAnswer) === normalizeCompleteAnswer(blank.answer);
  }

  /**
   * How one blank should read on a Complete question that is awaiting review.
   *
   * An exact match is shown as matched — it is all but certain to be credited,
   * and saying nothing would be needlessly anxious. A non-match is shown
   * *neutrally*, never as wrong: it may well be a valid alternative the author
   * did not think to type, which is the whole reason a human is marking this.
   * Painting it red here would deliver the very verdict review exists to avoid,
   * and would then be contradicted by the teacher's mark.
   */
  blankState(question: Question, index: number): 'matched' | 'review' {
    const blank = question.blanks?.find(b => b.index === index);
    if (!blank) return 'review';

    // Two ways an equality test would lie here, both ending in an empty string
    // on each side and so reading as a match:
    //
    //  - The student skipped the blank. `userAnswer` is ''.
    //  - The attempt is a homework submitted before its due date, so the server
    //    withholds the key (see `redactAnswerDetail`) and `answer` is ''.
    //
    // Either way there is nothing to compare, and a skipped blank must never
    // come back green. Only a real answer against a real key can match.
    if (!normalizeCompleteAnswer(blank.answer)) return 'review';
    if (!normalizeCompleteAnswer(blank.userAnswer)) return 'review';
    return this.blankIsCorrect(question, index) ? 'matched' : 'review';
  }

  GetAnswer(question: Question) {
    return question.options.findIndex(x=>x.isAnswer) + 1;
  };

  GetSelected(question: Question){
    return question.options.findIndex(x=>x.userSelected) + 1;
  }

  /**
   * Correct-answer count, derived once per `quiz()` change rather than
   * re-walked on every template read.
   *
   * Falls back to the server's count when results are withheld: `isCorrect()`
   * below reads `option.isAnswer` / `blank.answer`, which stay at their
   * zeroed, pre-submission value in that case — recomputing here would report
   * every question wrong rather than reflect the real (already-known) score.
   */
  readonly correctCount = computed(() => {
    if (!this.resultsAvailable()) return this.serverCorrectCount() ?? 0;
    const questions = this.quiz()?.questions;
    if (!questions) return 0;
    return questions.filter((q: Question) => this.isCorrect(q) === 'correct').length;
  });

  /** Questions eligible for an automatic verdict — the denominator of `correctCount`. */
  readonly autoGradedCount = computed(() =>
    (this.quiz()?.questions ?? []).filter((q: Question) => !requiresManualReview(q.questionTypeId)).length
  );

  /**
   * How the quiz is weighted. Shared with `QuizRunnerService.submit()` via
   * `computeQuizWeighting` so the score shown here and the score persisted on
   * the participation record can never disagree.
   */
  private readonly weighting = computed(() => computeQuizWeighting(this.quiz()?.questions ?? []));

  /**
   * Weighted 0–100 score earned so far, excluding anything awaiting review.
   * Falls back to the server's score when results are withheld — see
   * {@link correctCount}'s comment for why recomputing would be wrong here.
   */
  readonly score = computed(() => {
    if (!this.resultsAvailable()) return this.serverScorePercent() ?? 0;
    const questions = this.quiz()?.questions ?? [];
    if (questions.length === 0) return 0;
    const weighting = this.weighting();
    const earned = questions
      .filter((q: Question) => this.isCorrect(q) === 'correct')
      .reduce((sum: number, q: Question) => sum + weightOf(weighting, q.id), 0);
    return roundPercent(earned);
  });

  /**
   * Share of the quiz still held by answers awaiting a teacher's mark.
   *
   * Summed from the questions rather than read off `weighting.explainTotalPercent`,
   * which counts only the types carrying an *authored* weight. A Complete
   * question needs review but draws an ordinary equal share, so it is invisible
   * to that total — using it would under-report what is still outstanding and
   * tell the student their score was more final than it is.
   */
  readonly pendingPercent = computed(() => {
    const weighting = this.weighting();
    const pending = (this.quiz()?.questions ?? [])
      .filter((q: Question) => requiresManualReview(q.questionTypeId))
      .reduce((sum: number, q: Question) => sum + weightOf(weighting, q.id), 0);
    return roundPercent(pending);
  });

  /**
   * Circumference of the score ring's arc, in SVG user units. Must stay in step
   * with the `r` on both circles in the template — the dash pattern below is
   * expressed as a fraction of it.
   */
  private static readonly RING_RADIUS = 52;
  private static readonly RING_CIRCUMFERENCE = 2 * Math.PI * QuizResultComponent.RING_RADIUS;

  readonly ringRadius = QuizResultComponent.RING_RADIUS;

  /**
   * `stroke-dasharray` for the filled arc: one dash covering the earned share
   * of the circle, then a gap long enough to swallow the remainder. Clamped so
   * a malformed score can never draw a second lap around the ring.
   */
  readonly ringDash = computed(() => {
    const pct = Math.max(0, Math.min(100, this.score()));
    const filled = (pct / 100) * QuizResultComponent.RING_CIRCUMFERENCE;
    return `${filled} ${QuizResultComponent.RING_CIRCUMFERENCE}`;
  });

  readonly hasPendingReview = computed(() =>
    (this.quiz()?.questions ?? []).some((q: Question) => this.isExplain(q))
  );

  /** The student's typed answer, or null when they left it blank. */
  getExplainResponse(question: Question): string | null {
    return question.responseText?.trim() ? question.responseText : null;
  }

  /** The teacher's model answer (populated at submission time). */
  getExplainReference(question: Question): string | null {
    return question.referenceAnswer?.trim() ? question.referenceAnswer : null;
  }

  /** This question's share of the quiz, rounded for display. */
  questionWeight(question: Question): number {
    return roundPercent(weightOf(this.weighting(), question.id));
  }

  getOptionLetter(index: number): string {
    return String.fromCharCode(65 + index);
  }

  /**
   * Display text for an option. Right-or-Wrong stores the canonical English
   * pair so grading and review read one form — the translation happens here,
   * matching `QuestionOptionsComponent.optionText`.
   */
  optionText(question: Question, option: Option): string {
    if (question.questionTypeId !== QUESTION_TYPE.RIGHT_WRONG) return option.name;
    return this.translate.instant(rightWrongLabelKey(option.id));
  }

  getCorrectAnswerText(question: Question): string {
    const correctOption = question.options.find(o => o.isAnswer);
    return correctOption ? this.optionText(question, correctOption) : '';
  }

  goToDashboard(): void {
    if (this.embedded()) {
      this.backToDashboard.emit();
    } else {
      this.router.navigate(['/available-quizzes']);
    }
  }
}
