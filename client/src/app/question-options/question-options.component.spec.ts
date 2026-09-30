import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { QuestionOptionsComponent } from './question-options.component';
import { Question, QUESTION_TYPE, DEFAULT_QUESTION_DURATION_SECONDS } from '../models';
import { QuizService } from '../services/quiz.service';

/**
 * Pins the half of "the previous answer still looks selected on the next
 * question" that lives in this component.
 *
 * Two questions in a row carry options with the same ids — the authoring form
 * numbers them from 1 per question, and every Right-or-Wrong question stores
 * the same fixed pair — and Angular recycles detached views inside `@for`, so
 * the very same <button> renders question 2's option after question 1's. That
 * is fine for anything Angular owns: the test below pins that `.is-selected`
 * follows the new question's data. What it cannot cover is the state the DOM
 * node owns instead — a tapped button keeps `:hover` on a touch screen until
 * something else is tapped, and that tint is close enough to `.is-selected` to
 * read as a stale selection. That half is fixed by gating `.option:hover` on
 * `(hover: hover)` in styles.css.
 */

function chooseQuestion(id: number): Question {
  return {
    id,
    name: `Q${id}`,
    questionTypeId: QUESTION_TYPE.CHOOSE,
    userAnsweredQuestion: false,
    duration: DEFAULT_QUESTION_DURATION_SECONDS,
    options: [
      { id: 1, name: `Q${id}-A`, isAnswer: false, userSelected: false },
      { id: 2, name: `Q${id}-B`, isAnswer: false, userSelected: false }
    ]
  };
}

function optionButtons(fixture: { nativeElement: HTMLElement }): HTMLButtonElement[] {
  return Array.from(fixture.nativeElement.querySelectorAll<HTMLButtonElement>('.option'));
}

describe('QuestionOptionsComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [QuestionOptionsComponent],
      providers: [
        { provide: TranslateService, useValue: { instant: (key: string) => key, translate: (key: string) => signal(key) } },
        // Only reached to mark the quiz dirty on select; the real one pulls in Firestore.
        { provide: QuizService, useValue: { touchCurrentQuiz: () => undefined } }
      ]
    });
  });

  it('carries no selected state onto the next question', () => {
    const fixture = TestBed.createComponent(QuestionOptionsComponent);
    const first = chooseQuestion(1);
    fixture.componentRef.setInput('question', first);
    fixture.detectChanges();

    optionButtons(fixture)[0].click();
    fixture.detectChanges();
    expect(optionButtons(fixture)[0].classList).toContain('is-selected');
    expect(first.options[0].userSelected).toBeTrue();

    fixture.componentRef.setInput('question', chooseQuestion(2));
    fixture.detectChanges();

    optionButtons(fixture).forEach(button => {
      expect(button.classList).not.toContain('is-selected');
      expect(button.getAttribute('aria-checked')).toBe('false');
    });
  });

  it('leaves the first question untouched when the second is answered', () => {
    const fixture = TestBed.createComponent(QuestionOptionsComponent);
    const first = chooseQuestion(1);
    const second = chooseQuestion(2);

    fixture.componentRef.setInput('question', first);
    fixture.detectChanges();
    optionButtons(fixture)[0].click();

    fixture.componentRef.setInput('question', second);
    fixture.detectChanges();
    optionButtons(fixture)[1].click();

    expect(first.options.map(o => o.userSelected)).toEqual([true, false]);
    expect(second.options.map(o => o.userSelected)).toEqual([false, true]);
  });
});
