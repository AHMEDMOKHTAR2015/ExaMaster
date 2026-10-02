import { Component, inject, input, output, ChangeDetectionStrategy } from '@angular/core';
import { Question } from '../models';
import { QuizService } from '../services/quiz.service';
import { RichTextEditorComponent } from '../shared/rich-text-editor/rich-text-editor.component';
import { isQuestionAnswered } from '../shared/quiz-runner';

/**
 * Renders an Explain (open response) question: the authored subject followed by
 * a rich-text field for the student's answer. Sibling to
 * {@link QuestionOptionsComponent} and {@link QuestionCompleteComponent} — the
 * quiz template picks between them on `questionTypeId`.
 *
 * Answer state lives directly on `question.responseText` (mirroring how Choose
 * state lives on `option.userSelected`), so navigating between questions
 * preserves in-progress answers with no extra bookkeeping.
 *
 * The subject is rendered with `[innerHTML]`, which Angular sanitizes. It is
 * authored content from a teacher, and it is never the answer — the model
 * answer stays on `/Answers` until submission.
 */
@Component({
    selector: 'question-explain',
    templateUrl: './question-explain.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RichTextEditorComponent]
})
export class QuestionExplainComponent {
  readonly question = input.required<Question>();
  readonly answerSelected = output<Question>();

  private readonly quizService = inject(QuizService);

  onResponseChange(question: Question, value: string): void {
    question.responseText = value;
    this.quizService.touchCurrentQuiz();
  }

  /**
   * Explain answers are typed incrementally, so "answered" is a poor autoMove
   * trigger — it flips true on whatever keystroke completes the first word.
   * Signal only once the student leaves the field, matching the reason
   * {@link QuestionCompleteComponent} waits for an explicit Enter.
   */
  onEditingFinished(question: Question): void {
    if (isQuestionAnswered(question)) {
      this.answerSelected.emit(question);
    }
  }
}
