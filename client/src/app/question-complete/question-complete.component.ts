import { Component, inject, input, output, ChangeDetectionStrategy } from '@angular/core';
import { Question } from '../models';
import { QuizService } from '../services/quiz.service';
import { isQuestionAnswered } from '../shared/quiz-runner';
import { AutoWidthInputDirective } from '../directives';

/**
 * Renders a Complete (fill-in-the-blank) question: the parsed passage with each
 * blank shown as an inline textbox. Sibling to {@link QuestionOptionsComponent}
 * (the Choose renderer) — the quiz template picks between them on
 * `questionTypeId`.
 *
 * Answer state lives directly on `question.blanks[i].userAnswer` (mirroring how
 * Choose state lives on `option.userSelected`), so navigating between questions
 * preserves in-progress answers with no extra bookkeeping.
 */
@Component({
  selector: 'question-complete',
  templateUrl: './question-complete.component.html',
  standalone: true,
  imports: [AutoWidthInputDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuestionCompleteComponent {
  readonly question = input.required<Question>();
  readonly answerSelected = output<Question>();

  private readonly quizService = inject(QuizService);

  /** The blank's starting (minimum) width in `ch`, scaled to the expected answer length; it grows as the student types. */
  blankWidthCh(expectedLength: number): number {
    return Math.min(30, Math.max(5, expectedLength + 2));
  }

  onBlankInput(question: Question, blankIndex: number, value: string): void {
    const blank = question.blanks?.find(b => b.index === blankIndex);
    if (!blank) return;

    blank.userAnswer = value;
    this.quizService.touchCurrentQuiz();
  }

  /**
   * Complete questions are typed incrementally, so unlike picking a Choose
   * option, "answered" isn't a good autoMove trigger — it flips true on
   * whatever keystroke happens to fill the last blank, advancing mid-word.
   * Require an explicit Enter once every blank is filled instead.
   */
  onBlankEnter(question: Question): void {
    if (isQuestionAnswered(question)) {
      this.answerSelected.emit(question);
    }
  }
}
