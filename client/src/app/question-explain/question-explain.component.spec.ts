import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { QuestionExplainComponent } from './question-explain.component';
import { QuizService } from '../services/quiz.service';
import { Question, QUESTION_TYPE, DEFAULT_QUESTION_DURATION_SECONDS } from '../models';

function explainQuestion(responseText = ''): Question {
  return {
    id: 1,
    name: 'Explain photosynthesis.',
    questionTypeId: QUESTION_TYPE.EXPLAIN,
    options: [],
    subjectHtml: '<p>Explain <b>photosynthesis</b>.</p>',
    // Zeroed exactly as `QuizService` leaves it before submission.
    referenceAnswer: '',
    responseText,
    weightPercent: 30,
    userAnsweredQuestion: false,
    duration: DEFAULT_QUESTION_DURATION_SECONDS
  };
}

describe('QuestionExplainComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [QuestionExplainComponent],
      providers: [
        { provide: QuizService, useValue: { touchCurrentQuiz: () => {} } },
        // The rich-text editor's toolbar uses TranslatePipe, which calls
        // `translate()` and reads the signal it returns — echo the key back.
        {
          provide: TranslateService,
          useValue: { instant: (key: string) => key, translate: (key: string) => signal(key) }
        }
      ]
    });
  });

  it('renders the authored subject and an editable response surface', () => {
    const fixture = TestBed.createComponent(QuestionExplainComponent);
    fixture.componentRef.setInput('question', explainQuestion());
    fixture.detectChanges();

    const subject = fixture.nativeElement.querySelector('.question__subject');
    expect(subject.textContent).toContain('photosynthesis');

    const surface = fixture.nativeElement.querySelector('.rte__surface');
    expect(surface).toBeTruthy();
    expect(surface.getAttribute('contenteditable')).toBe('true');
  });

  it('does not leak the reference answer into the rendered question', () => {
    const question = explainQuestion();
    question.referenceAnswer = '';
    const fixture = TestBed.createComponent(QuestionExplainComponent);
    fixture.componentRef.setInput('question', question);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('chemical energy');
  });

  it('writes the typed response back onto the question', () => {
    const question = explainQuestion();
    const fixture = TestBed.createComponent(QuestionExplainComponent);
    fixture.componentRef.setInput('question', question);
    fixture.detectChanges();

    fixture.componentInstance.onResponseChange(question, '<p>Because of chlorophyll.</p>');
    expect(question.responseText).toBe('<p>Because of chlorophyll.</p>');
  });

  it('signals a finished answer only when the response is non-empty', () => {
    const question = explainQuestion();
    const fixture = TestBed.createComponent(QuestionExplainComponent);
    fixture.componentRef.setInput('question', question);
    fixture.detectChanges();

    let emitted = 0;
    fixture.componentInstance.answerSelected.subscribe(() => emitted++);

    fixture.componentInstance.onResponseChange(question, '<p><br></p>');
    fixture.componentInstance.onEditingFinished(question);
    expect(emitted).toBe(0);

    fixture.componentInstance.onResponseChange(question, '<p>An answer.</p>');
    fixture.componentInstance.onEditingFinished(question);
    expect(emitted).toBe(1);
  });
});
