import { TestBed } from '@angular/core/testing';
import { QuestionCompleteComponent } from './question-complete.component';
import { QuizService } from '../services/quiz.service';
import { Question, QUESTION_TYPE, DEFAULT_QUESTION_DURATION_SECONDS } from '../models';

function completeQuestion(): Question {
  // Passage "New(Complete)York(Complete)" — every word is a blank, no static text.
  return {
    id: 1,
    name: '__________',
    questionTypeId: QUESTION_TYPE.COMPLETE,
    options: [],
    segments: [
      { kind: 'blank', index: 0, expectedLength: 3 },
      { kind: 'blank', index: 1, expectedLength: 4 }
    ],
    blanks: [
      { index: 0, answer: '', userAnswer: '' },
      { index: 1, answer: '', userAnswer: '' }
    ],
    userAnsweredQuestion: false,
    duration: DEFAULT_QUESTION_DURATION_SECONDS
  };
}

describe('QuestionCompleteComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [QuestionCompleteComponent],
      providers: [{ provide: QuizService, useValue: { touchCurrentQuiz: () => {} } }]
    });
  });

  it('renders one textbox per blank even when the passage is all blanks', () => {
    const fixture = TestBed.createComponent(QuestionCompleteComponent);
    fixture.componentRef.setInput('question', completeQuestion());
    fixture.detectChanges();

    const inputs = fixture.nativeElement.querySelectorAll('input.passage__blank');
    expect(inputs.length).toBe(2);
  });
});
