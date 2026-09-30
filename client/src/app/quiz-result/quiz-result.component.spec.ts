import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { QuizResultComponent } from './quiz-result.component';
import { Question, Quiz, QuizConfig, QUESTION_TYPE, DEFAULT_QUESTION_DURATION_SECONDS } from '../models';

/**
 * `score()`/`correctCount()` recompute from the live `Question` array by
 * default, but fall back to server-supplied values when `resultsAvailable` is
 * `false` (see `functions/src/submit-quiz.ts`'s delayed reveal). This is the
 * one piece of new logic in the component — everything else it does is
 * unchanged, which the first test below pins.
 */

const config: QuizConfig = {
  allowBack: true, allowReview: true, autoMove: false, duration: 300, pageSize: 1,
  requiredAll: false, richText: false, shuffleQuestions: false, shuffleOptions: false,
  showClock: true, showPager: true
};

function chooseQuestion(id: number, correct: boolean): Question {
  return {
    id,
    name: `Q${id}`,
    questionTypeId: QUESTION_TYPE.CHOOSE,
    userAnsweredQuestion: true,
    duration: DEFAULT_QUESTION_DURATION_SECONDS,
    options: [
      { id: 1, name: 'A', isAnswer: correct, userSelected: true },
      { id: 2, name: 'B', isAnswer: !correct, userSelected: false }
    ]
  };
}

function quizWith(questions: Question[]): Quiz {
  return { id: 1, name: 'Quiz', description: '', config, questions };
}

describe('QuizResultComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [QuizResultComponent],
      providers: [
        provideRouter([]),
        { provide: TranslateService, useValue: { instant: (key: string) => key, translate: (key: string) => signal(key) } }
      ]
    });
  });

  it('recomputes score from the live questions by default, unaffected by the new inputs', () => {
    const fixture = TestBed.createComponent(QuizResultComponent);
    fixture.componentRef.setInput('quiz', quizWith([chooseQuestion(1, true), chooseQuestion(2, false)]));
    fixture.detectChanges();

    expect(fixture.componentInstance.score()).toBe(50);
    expect(fixture.componentInstance.correctCount()).toBe(1);
  });

  it('uses the server score instead of recomputing when results are withheld', () => {
    // With the key withheld, every option's `isAnswer` stays `false` — a naive
    // recompute would report 0% regardless of the real, already-known score.
    const fixture = TestBed.createComponent(QuizResultComponent);
    fixture.componentRef.setInput('quiz', quizWith([chooseQuestion(1, false), chooseQuestion(2, false)]));
    fixture.componentRef.setInput('resultsAvailable', false);
    fixture.componentRef.setInput('serverScorePercent', 80);
    fixture.componentRef.setInput('serverCorrectCount', 4);
    fixture.detectChanges();

    expect(fixture.componentInstance.score()).toBe(80);
    expect(fixture.componentInstance.correctCount()).toBe(4);
  });

  it('hides the per-question review list when results are withheld', () => {
    const fixture = TestBed.createComponent(QuizResultComponent);
    fixture.componentRef.setInput('quiz', quizWith([chooseQuestion(1, true)]));
    fixture.componentRef.setInput('resultsAvailable', false);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.question-card')).toBeNull();
    expect(el.querySelector('.results-pending')).not.toBeNull();
  });

  it('shows the per-question review list by default (results available)', () => {
    const fixture = TestBed.createComponent(QuizResultComponent);
    fixture.componentRef.setInput('quiz', quizWith([chooseQuestion(1, true)]));
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.question-card')).not.toBeNull();
    expect(el.querySelector('.results-pending')).toBeNull();
  });

  it('offers no retake — an attempt is recorded on submit and cannot be redone', () => {
    const fixture = TestBed.createComponent(QuizResultComponent);
    fixture.componentRef.setInput('quiz', quizWith([chooseQuestion(1, true)]));
    fixture.detectChanges();

    const buttons = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('.quiz-result__button-container button')
    );
    expect(buttons.length).toBe(1);
    expect(buttons[0].textContent).toContain('quizResult.backToDashboard');
  });

  describe('score ring geometry', () => {
    /** Must match RING_RADIUS in the component. */
    const CIRCUMFERENCE = 2 * Math.PI * 52;

    /** Length of the drawn arc — the first half of the `stroke-dasharray` pair. */
    function arcLength(fixture: ReturnType<typeof TestBed.createComponent<QuizResultComponent>>): number {
      return Number(fixture.componentInstance.ringDash().split(' ')[0]);
    }

    it('draws an arc proportional to the score', () => {
      const fixture = TestBed.createComponent(QuizResultComponent);
      // 1 of 2 correct → 50%.
      fixture.componentRef.setInput('quiz', quizWith([chooseQuestion(1, true), chooseQuestion(2, false)]));
      fixture.detectChanges();

      expect(fixture.componentInstance.score()).toBe(50);
      expect(arcLength(fixture)).toBeCloseTo(CIRCUMFERENCE / 2, 5);
    });

    it('closes the ring completely at 100%', () => {
      const fixture = TestBed.createComponent(QuizResultComponent);
      fixture.componentRef.setInput('quiz', quizWith([chooseQuestion(1, true)]));
      fixture.detectChanges();

      expect(fixture.componentInstance.score()).toBe(100);
      expect(arcLength(fixture)).toBeCloseTo(CIRCUMFERENCE, 5);
    });

    it('draws nothing at 0%', () => {
      const fixture = TestBed.createComponent(QuizResultComponent);
      fixture.componentRef.setInput('quiz', quizWith([chooseQuestion(1, false)]));
      fixture.detectChanges();

      expect(fixture.componentInstance.score()).toBe(0);
      expect(arcLength(fixture)).toBe(0);
    });

    it('never laps the ring if a server score somehow exceeds 100', () => {
      // Guards the clamp: an unclamped dash longer than the circumference would
      // wrap and redraw over the start of the arc.
      const fixture = TestBed.createComponent(QuizResultComponent);
      fixture.componentRef.setInput('quiz', quizWith([chooseQuestion(1, false)]));
      fixture.componentRef.setInput('resultsAvailable', false);
      fixture.componentRef.setInput('serverScorePercent', 140);
      fixture.detectChanges();

      expect(arcLength(fixture)).toBeCloseTo(CIRCUMFERENCE, 5);
    });
  });
});
