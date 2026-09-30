/**
 * Coverage for what happens when a student walks out of a "One Time Join"
 * attempt.
 *
 * The rule being pinned: **one exit ends the sitting.** Minimising, switching
 * app or tab, Back and closing all arrive here through the same
 * `QuizLockdownService.reportExit` funnel, and every one of them must lock the
 * attempt and hand the quiz page a breach to act on. Anything softer — a
 * counter, a warning, a second chance — is what this replaced.
 *
 * The real `QuizLockdownService` is used rather than a stub: it owns the
 * `active` flag that makes the second exit a no-op, which is the half of the
 * behaviour most likely to regress. Only Firestore is stubbed out.
 */

import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { QuizRunnerService } from './quiz-runner.service';
import { QuizService } from './quiz.service';
import { AuthService } from './auth';
import { NotificationService } from './notification.service';
import { QuizLockService } from './quiz/quiz-lock.service';
import { QuizLockdownService } from './quiz/quiz-lockdown.service';
import { QuizSubmissionService } from './quiz-submission.service';
import {
  Question, Quiz, QuizAttemptLock, QuizConfig, QuizExitReason, QUESTION_TYPE,
  DEFAULT_QUESTION_DURATION_SECONDS
} from '../models';

const containedConfig: QuizConfig = {
  allowBack: true, allowReview: false, autoMove: false, duration: 300, pageSize: 1,
  requiredAll: false, richText: false, shuffleQuestions: false, shuffleOptions: false,
  showClock: false, showPager: false, oneTimeJoin: true
};

function question(id: number): Question {
  return {
    id, name: `Q${id}`, questionTypeId: QUESTION_TYPE.CHOOSE,
    userAnsweredQuestion: false, duration: DEFAULT_QUESTION_DURATION_SECONDS,
    options: [{ id: 1, name: 'A', isAnswer: false, userSelected: false }]
  };
}

function lockRecord(): QuizAttemptLock {
  return {
    id: 'child-1__bank:7', childId: 'child-1', childName: 'Sara',
    scopeKey: 'bank:7', quizId: 7, quizName: 'Science quiz',
    homeworkId: null, teacherId: null, classId: 'c1',
    status: 'in-progress', startedAt: 1_000, exitAttempts: 0,
    lockedAt: null, lastExitReason: null,
    releasedAt: null, releasedBy: null, releasedByName: null
  };
}

describe('QuizRunnerService — One Time Join containment', () => {
  let runner: QuizRunnerService;
  let lockdown: QuizLockdownService;
  let currentQuiz: ReturnType<typeof signal<Quiz | null>>;
  let exitWrites: { lock: QuizAttemptLock; reason: QuizExitReason }[];
  /** When false, `begin()` rejects — the "lock could not be written" path. */
  let lockWritable: boolean;

  /** Opens a contained attempt and lets the deliberately un-awaited lock write settle. */
  async function openContainedQuiz(): Promise<void> {
    currentQuiz.set({ id: 7, name: 'Science quiz', description: '', config: containedConfig, questions: [question(1)] });
    await runner.start(7);
    // `start()` fires the lock write without awaiting it, so the student is
    // never made to wait on a round trip. Flush it here.
    await new Promise(resolve => setTimeout(resolve));
  }

  beforeEach(() => {
    exitWrites = [];
    lockWritable = true;
    currentQuiz = signal<Quiz | null>(null);

    TestBed.configureTestingModule({
      providers: [
        QuizRunnerService,
        QuizLockdownService,
        {
          provide: QuizService,
          useValue: {
            currentQuiz,
            loadSitting: () => Promise.resolve(),
            refresh: () => Promise.resolve(),
            touchCurrentQuiz: () => undefined
          }
        },
        {
          provide: AuthService,
          useValue: {
            user: signal({ uid: 'child-1', displayName: 'Sara', stageId: 's1', classId: 'c1' }),
            refreshUserData: () => Promise.resolve()
          }
        },
        { provide: NotificationService, useValue: { success: () => undefined, error: () => undefined, warning: () => undefined } },
        {
          provide: QuizLockService,
          useValue: {
            begin: () => lockWritable ? Promise.resolve(lockRecord()) : Promise.reject(new Error('offline')),
            findMine: () => Promise.resolve(lockWritable ? lockRecord() : null),
            recordExit: (lock: QuizAttemptLock, reason: QuizExitReason) => {
              exitWrites.push({ lock, reason });
              return Promise.resolve();
            }
          }
        },
        { provide: QuizSubmissionService, useValue: { submit: () => Promise.resolve() } }
      ]
    });

    runner = TestBed.inject(QuizRunnerService);
    lockdown = TestBed.inject(QuizLockdownService);
  });

  afterEach(() => lockdown.deactivate());

  it('contains the attempt and starts with no breach', async () => {
    await openContainedQuiz();

    expect(lockdown.isActive()).toBe(true);
    expect(runner.isContained()).toBe(true);
    expect(runner.containmentBreach()).toBeNull();
  });

  /** The reported requirement: minimising or switching app ends the sitting. */
  it('ends the attempt on the very first exit', async () => {
    await openContainedQuiz();

    lockdown.reportExit('hidden');

    const breach = runner.containmentBreach();
    expect(breach).not.toBeNull();
    expect(breach!.reason).toBe('hidden');
    expect(breach!.lock!.status).toBe('locked');
    expect(breach!.lock!.exitAttempts).toBe(1);
    expect(exitWrites.length).toBe(1);
  });

  /**
   * The guards come down with the first exit, so a hidden tab that also fires
   * `beforeunload` on its way out cannot bill the student twice for one exit.
   */
  it('stops counting once the attempt has ended', async () => {
    await openContainedQuiz();

    lockdown.reportExit('hidden');
    lockdown.reportExit('closed');
    lockdown.reportExit('navigated');

    expect(lockdown.isActive()).toBe(false);
    expect(exitWrites.length).toBe(1);
    expect(exitWrites[0].reason).toBe('hidden');
  });

  /**
   * A lock that never reached Firestore still leaves a student who walked out.
   * The sitting ends either way — only the "ask your teacher" dialog needs the
   * record, so it is the one thing missing.
   */
  it('reports a breach even when no lock was written', async () => {
    lockWritable = false;
    await openContainedQuiz();

    lockdown.reportExit('navigated');

    expect(runner.containmentBreach()).toEqual({ reason: 'navigated', lock: null });
    expect(exitWrites.length).toBe(0);
  });

  /** Otherwise the quiz page's handler would fire the moment the next quiz opened. */
  it('clears a previous breach when a new attempt starts', async () => {
    await openContainedQuiz();
    lockdown.reportExit('hidden');
    expect(runner.containmentBreach()).not.toBeNull();

    await openContainedQuiz();

    expect(runner.containmentBreach()).toBeNull();
  });

  it('leaves an ordinary quiz uncontained', async () => {
    currentQuiz.set({
      id: 8, name: 'Open quiz', description: '',
      config: { ...containedConfig, oneTimeJoin: false }, questions: [question(1)]
    });
    await runner.start(8);
    await new Promise(resolve => setTimeout(resolve));

    expect(lockdown.isActive()).toBe(false);
    expect(runner.isContained()).toBe(false);
  });
});
