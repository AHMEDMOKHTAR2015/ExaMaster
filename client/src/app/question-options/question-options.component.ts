import { Component, inject, input, output, ChangeDetectionStrategy } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Option, Question, QUESTION_TYPE } from '../models';
import { QuizService } from '../services/quiz.service';
import { rightWrongLabelKey } from '../shared/right-wrong-question';

@Component({
  selector: 'question-options',
  templateUrl: './question-options.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuestionOptionsComponent {
  readonly question = input.required<Question>();
  readonly richText = input(false);
  readonly answerSelected = output<Question>();

  quizService = inject(QuizService);
  private readonly translate = inject(TranslateService);

  /** Display marker for an option (A, B, C, …) based on its position. */
  optionLabel(index: number): string {
    return String.fromCharCode(65 + index);
  }

  /**
   * The text to show for an option.
   *
   * Right-or-Wrong questions store the canonical English `Right`/`Wrong` pair so
   * that grading, persisted participation records and teacher review all read
   * one form regardless of the authoring language — which means the *display*
   * has to be translated here. Every other type shows its authored text as-is.
   */
  optionText(question: Question, option: Option): string {
    if (question.questionTypeId !== QUESTION_TYPE.RIGHT_WRONG) return option.name;
    return this.translate.instant(rightWrongLabelKey(option.id));
  }

  /** Right-or-Wrong labels are generated, never author-supplied, so never rich text. */
  showRichText(question: Question): boolean {
    return this.richText() && question.questionTypeId !== QUESTION_TYPE.RIGHT_WRONG;
  }

  onSelect(question: Question, option: Option) {
    question.options.forEach((x) => x.userSelected = x.id == option.id ? true : false);
    this.quizService.touchCurrentQuiz();
    this.answerSelected.emit(question);
  }

}
