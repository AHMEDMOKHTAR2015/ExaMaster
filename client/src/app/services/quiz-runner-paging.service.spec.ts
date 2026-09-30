/**
 * Coverage for `QuizConfig.pageSize` — how many questions the runner shows
 * together on one screen. `pageSize: 1` (the default, exercised throughout
 * `quiz-runner.service.spec.ts`) must behave exactly as a single-question
 * screen always has; this file pins the `pageSize > 1` behavior specifically:
 * paged navigation, page-level answered/timer aggregation, and autoMove
 * waiting for the whole page rather than any one question on it.
 */

import { TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { signal } from '@angular/core';
import { QuizRunnerService } from './quiz-runner.service';
import { QuizService } from './quiz.service';
import { AuthService } from './auth';
import { NotificationService } from './notification.service';
import { NotificationCenterService } from './notification-center.service';
import { QuizLockService } from './quiz/quiz-lock.service';
import { QuizSubmissionService } from './quiz-submission.service';
import { Question, Quiz, QuizConfig, QUESTION_TYPE, DEFAULT_QUESTION_DURATION_SECONDS } from '../models';

function chooseQuestion(id: number, duration = DEFAULT_QUESTION_DURATION_SECONDS): Question {
  return {
    id,
    name: `Q${id}`,
    questionTypeId: QUESTION_TYPE.CHOOSE,
    userAnsweredQuestion: false,
    duration,
    options: [
      { id: id * 10 + 1, name: 'A', isAnswer: false, userSelected: false },
      { id: id * 10 + 2, name: 'B', isAnswer: false, userSelected: false }
    ]
  };
}

function answer(question: Question): void {
  question.options.forEach(o => o.userSelected = true);
}

function quizWith(questions: Question[], config: Partial<QuizConfig>): Quiz {
  return {
    id: 7,
    name: 'Paged quiz',
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

describe('QuizRunnerService paging (pageSize > 1)', () => {
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

  it('shows pageSize questions per page and paginates in whole-page steps', async () => {
    const questions = [1, 2, 3, 4, 5].map(id => chooseQuestion(id));
    currentQuiz.set(quizWith(questions, { pageSize: 2 }));
    await runner.start(7);

    expect(runner.currentPageQuestions().map(q => q.id)).toEqual([1, 2]);
    expect(runner.isLastPage()).toBe(false);

    runner.next();
    expect(runner.currentPageQuestions().map(q => q.id)).toEqual([3, 4]);

    // Last page is a partial page — 1 question, not 2 — and is correctly flagged.
    runner.next();
    expect(runner.currentPageQuestions().map(q => q.id)).toEqual([5]);
    expect(runner.isLastPage()).toBe(true);

    runner.prev();
    expect(runner.currentPageQuestions().map(q => q.id)).toEqual([3, 4]);
  });

  it('snaps goTo/reviewQuestion to the page containing the given question index', async () => {
    const questions = [1, 2, 3, 4, 5, 6].map(id => chooseQuestion(id));
    currentQuiz.set(quizWith(questions, { pageSize: 3 }));
    await runner.start(7);

    // Question index 4 (id 5, 0-based index 4) lives on the second page [3,4,5].
    runner.reviewQuestion(4);
    expect(runner.currentPageQuestions().map(q => q.id)).toEqual([4, 5, 6]);
  });

  it('formats the page label as a range and never as a single number when pageSize > 1', async () => {
    const questions = [1, 2, 3].map(id => chooseQuestion(id));
    currentQuiz.set(quizWith(questions, { pageSize: 2 }));
    await runner.start(7);

    expect(runner.pageQuestionLabel()).toBe('1-2');
    expect(runner.progressText()).toBe('Question 1-2 of 3');

    runner.next();
    // Partial last page collapses back to a single number, same as pageSize 1.
    expect(runner.pageQuestionLabel()).toBe('3');
    expect(runner.progressText()).toBe('Question 3 of 3');
  });

  it('does not schedule autoMove until every question on the page is answered', fakeAsync(() => {
    const questions = [1, 2].map(id => chooseQuestion(id));
    currentQuiz.set(quizWith(questions, { pageSize: 2, autoMove: true }));
    runner.start(7);
    tick();

    answer(questions[0]);
    runner.onAnswerSelected();
    tick(500);
    // Only one of the two questions on this page is answered — must not have advanced.
    expect(runner.currentPageQuestions().map(q => q.id)).toEqual([1, 2]);

    answer(questions[1]);
    runner.onAnswerSelected();
    tick(500);
    // Both are answered now — autoMove fires and advances past the (only) page.
    expect(runner.isLastPage()).toBe(true);

    runner.reset();
    discardPeriodicTasks();
  }));

  it('starts the page countdown from the sum of its questions\' durations', async () => {
    const questions = [chooseQuestion(1, 20), chooseQuestion(2, 25), chooseQuestion(3, 100)];
    currentQuiz.set(quizWith(questions, { pageSize: 2 }));
    await runner.start(7);

    // Page 1 = questions 1+2 = 20 + 25 = 45s.
    expect(runner.questionDurationLabel()).toBe('00:45');

    runner.next();
    // Page 2 = question 3 alone = 100s.
    expect(runner.questionDurationLabel()).toBe('01:40');
  });

  it('treats a non-positive pageSize as 1 rather than producing an empty page', async () => {
    const questions = [chooseQuestion(1), chooseQuestion(2)];
    currentQuiz.set(quizWith(questions, { pageSize: 0 }));
    await runner.start(7);

    expect(runner.currentPageQuestions().map(q => q.id)).toEqual([1]);
  });
});
