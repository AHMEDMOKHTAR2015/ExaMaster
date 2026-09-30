/**
 * Coverage for `QuizConfig.requiredAll`'s effect on `next()`.
 *
 * `requestSubmit()`/`submit()` already route a student to the first
 * unanswered question when submission is blocked (covered indirectly via
 * `goToFirstUnanswered` elsewhere) — this file pins what happens *after*
 * that: clicking Next must skip forward past anything already answered to
 * the next gap, not just the immediately-following page, or a student could
 * "Next" straight past the very gap they were routed to fix. A quiz without
 * `requiredAll` must keep the plain, sequential next-page behavior.
 */

import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { QuizRunnerService } from './quiz-runner.service';
import { QuizService } from './quiz.service';
import { AuthService } from './auth';
import { NotificationService } from './notification.service';
import { NotificationCenterService } from './notification-center.service';
import { QuizLockService } from './quiz/quiz-lock.service';
import { QuizSubmissionService } from './quiz-submission.service';
import { Question, Quiz, QuizConfig, QUESTION_TYPE, DEFAULT_QUESTION_DURATION_SECONDS } from '../models';

function chooseQuestion(id: number, answered: boolean): Question {
  return {
    id,
    name: `Q${id}`,
    questionTypeId: QUESTION_TYPE.CHOOSE,
    userAnsweredQuestion: false,
    duration: DEFAULT_QUESTION_DURATION_SECONDS,
    options: [
      { id: id * 10 + 1, name: 'A', isAnswer: false, userSelected: answered },
      { id: id * 10 + 2, name: 'B', isAnswer: false, userSelected: false }
    ]
  };
}

function quizWith(questions: Question[], config: Partial<QuizConfig>): Quiz {
  return {
    id: 7,
    name: 'Required-all quiz',
    description: '',
    config: {
      allowBack: true, allowReview: false, autoMove: false, duration: 300, pageSize: 1,
      requiredAll: false, richText: false, shuffleQuestions: false, shuffleOptions: false,
      showClock: false, showPager: false,
      ...config
    },
    questions
  };
}

describe('QuizRunnerService requiredAll navigation', () => {
  let runner: QuizRunnerService;
  let currentQuiz: ReturnType<typeof signal<Quiz | null>>;

  beforeEach(() => {
    currentQuiz = signal<Quiz | null>(null);

    TestBed.configureTestingModule({
      providers: [
        QuizRunnerService,
        { provide: QuizService, useValue: { currentQuiz, loadSitting: () => Promise.resolve(), touchCurrentQuiz: () => {}, refresh: () => Promise.resolve() } },
        { provide: AuthService, useValue: { user: signal({ uid: 'child-1', displayName: 'Sara', parentId: 'parent-1', stageId: 's1', classId: 'c1' }), refreshUserData: () => Promise.resolve() } },
        { provide: NotificationService, useValue: { success: () => {}, error: () => {}, warning: () => {} } },
        { provide: NotificationCenterService, useValue: { notify: () => Promise.resolve() } },
        // Containment is off for every fixture here (`oneTimeJoin` is unset), but
        // the runner injects the service unconditionally and the real one needs
        // Firestore. Stubbed rather than provided, so these specs stay
        // Firebase-free.
        { provide: QuizLockService, useValue: { begin: () => Promise.resolve(), find: () => Promise.resolve(null), recordExit: () => Promise.resolve() } },
        { provide: QuizSubmissionService, useValue: { submit: () => Promise.reject(new Error('not exercised in these tests')) } }
      ]
    });

    runner = TestBed.inject(QuizRunnerService);
  });

  it('skips already-answered questions and lands on the next gap', async () => {
    // Q1 answered, Q2 answered, Q3 unanswered, Q4 answered, Q5 unanswered.
    const questions = [
      chooseQuestion(1, true), chooseQuestion(2, true), chooseQuestion(3, false),
      chooseQuestion(4, true), chooseQuestion(5, false)
    ];
    currentQuiz.set(quizWith(questions, { requiredAll: true }));
    await runner.start(7);

    expect(runner.currentPageQuestions().map(q => q.id)).toEqual([1]);

    runner.next();
    expect(runner.currentPageQuestions().map(q => q.id)).toEqual([3]);

    runner.next();
    expect(runner.currentPageQuestions().map(q => q.id)).toEqual([5]);
    expect(runner.isLastPage()).toBe(true);
  });

  it('falls through to the last page once nothing unanswered remains ahead', async () => {
    // Everything after Q1 is already answered — Next should land Submit-ready on the last page.
    const questions = [
      chooseQuestion(1, false), chooseQuestion(2, true), chooseQuestion(3, true)
    ];
    currentQuiz.set(quizWith(questions, { requiredAll: true }));
    await runner.start(7);

    runner.next();
    expect(runner.currentPageQuestions().map(q => q.id)).toEqual([3]);
    expect(runner.isLastPage()).toBe(true);
  });

  it('skips across multi-question pages too, honoring pageSize', async () => {
    // Page 1 = [1,2] both answered, page 2 = [3,4] with 4 unanswered.
    const questions = [
      chooseQuestion(1, true), chooseQuestion(2, true),
      chooseQuestion(3, true), chooseQuestion(4, false)
    ];
    currentQuiz.set(quizWith(questions, { requiredAll: true, pageSize: 2 }));
    await runner.start(7);

    runner.next();
    expect(runner.currentPageQuestions().map(q => q.id)).toEqual([3, 4]);
  });

  it('does not skip anything for a quiz that does not require every answer', async () => {
    // Q2 already answered, but plain sequential Next must still stop there.
    const questions = [
      chooseQuestion(1, false), chooseQuestion(2, true), chooseQuestion(3, false)
    ];
    currentQuiz.set(quizWith(questions, { requiredAll: false }));
    await runner.start(7);

    runner.next();
    expect(runner.currentPageQuestions().map(q => q.id)).toEqual([2]);
  });
});
