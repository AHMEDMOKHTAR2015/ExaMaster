import { Component, OnInit, OnDestroy, input, output, inject, ChangeDetectionStrategy } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { QuizService } from '../services/quiz.service';
import { QuizRunnerService } from '../services/quiz-runner.service';
import { QuestionOptionsComponent } from '../question-options/question-options.component';
import { QuestionCompleteComponent } from '../question-complete/question-complete.component';
import { QuestionExplainComponent } from '../question-explain/question-explain.component';
import { QuizResultComponent } from '../quiz-result/quiz-result.component';
import { QUESTION_TYPE } from '../models';

@Component({
    selector: 'app-quiz',
    templateUrl: './quiz.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, QuestionOptionsComponent, QuestionCompleteComponent, QuestionExplainComponent, QuizResultComponent, TranslatePipe]
})
export class QuizComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly quizService = inject(QuizService);
  readonly runner = inject(QuizRunnerService);

  /** Exposed for the template to branch question rendering on type. */
  readonly QUESTION_TYPE = QUESTION_TYPE;

  readonly quizId = input<number | null>(null);
  readonly embedded = input(false);
  readonly homeworkId = input<string | null>(null);
  readonly backToDashboard = output<void>();

  ngOnInit() {
    const quizId = this.quizId();
    if (this.embedded() && quizId) {
      this.runner.start(quizId, { homeworkId: this.homeworkId() });
    } else {
      const routeQuizId = this.route.snapshot.paramMap.get('id');
      if (routeQuizId) {
        this.runner.start(parseInt(routeQuizId, 10));
      } else if (!this.embedded()) {
        this.router.navigate(['/available-quizzes']);
      }
    }
  }

  ngOnDestroy() {
    this.runner.reset();
  }

  goToDashboard(): void {
    if (this.embedded()) {
      this.backToDashboard.emit();
    } else {
      this.router.navigate(['/available-quizzes']);
    }
  }
}
