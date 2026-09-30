/**
 * Coverage for what `QuizRunnerService.submit()` sends, and what it does with
 * the answer.
 *
 * Unlike the pure-function specs in `shared/`, this one needs TestBed — the
 * behaviour under test is the orchestration itself. Every collaborator is a
 * plain object stub (the convention in `app.component.spec.ts`).
 *
 * Grading runs on the server, so the stub below stands in for the wire — but it
 * grades with the real `gradeQuiz`, as the server's own grader does. Who is
 * notified of a submission is the server's decision now, and its tests.
 */

import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { QuizRunnerService } from './quiz-runner.service';
import { QuizService } from './quiz.service';
import { AuthService } from './auth';
import { NotificationService } from './notification.service';
import { QuizLockService } from './quiz/quiz-lock.service';
import { QuizSubmissionService, SubmitQuizRequest } from './quiz-submission.service';
import { ServiceError } from './shared/service-error';
import { gradeQuiz, hydrateQuestion } from '../shared/grade-quiz';
import {
  Question, Quiz, QuizConfig, QUESTION_TYPE,
  DEFAULT_QUESTION_DURATION_SECONDS
} from '../models';

const config: QuizConfig = {
  allowBack: true, allowReview: false, autoMove: false, duration: 300, pageSize: 1,
  requiredAll: false, richText: false, shuffleQuestions: false, shuffleOptions: false,
  showClock: false, showPager: false
};

function chooseQuestion(id: number): Question {
  return {
    id,
    name: `Q${id}`,
    questionTypeId: QUESTION_TYPE.CHOOSE,
    userAnsweredQuestion: false,
    duration: DEFAULT_QUESTION_DURATION_SECONDS,
    options: [
      { id: 1, name: 'A', isAnswer: false, userSelected: true },
      { id: 2, name: 'B', isAnswer: false, userSelected: false }
    ]
  };
}

function explainQuestion(id: number): Question {
  return {
    id,
    name: 'Explain photosynthesis.',
    questionTypeId: QUESTION_TYPE.EXPLAIN,
    userAnsweredQuestion: false,
    duration: DEFAULT_QUESTION_DURATION_SECONDS,
    options: [],
    subjectHtml: '<p>Explain photosynthesis.</p>',
    referenceAnswer: '',
    responseText: '<p>Chlorophyll absorbs light.</p>',
    weightPercent: 40
  };
}

function quizWith(questions: Question[]): Quiz {
  return { id: 7, name: 'Science quiz', description: '', config, questions };
}

describe('QuizRunnerService submit', () => {
  let runner: QuizRunnerService;
  let currentQuiz: ReturnType<typeof signal<Quiz | null>>;
  let loadedTarget: unknown;
  let submittedRequest: SubmitQuizRequest | null;
  /** When set, the submission stub rejects instead of grading. */
  let submitRejection: Error | null;
  /** When set, the submission stub reports results as withheld — for the delayed-reveal tests. */
  let resultsAvailable: boolean;
  let resultsAvailableAt: number | null;
  let listRefreshes: number;

  /** Starts an assignment's run through the real `start()`, then submits it. */
  async function startAndSubmit(questions: Question[]): Promise<void> {
    currentQuiz.set(quizWith(questions));
    await runner.start(7, { homeworkId: '12' });
    await runner.submit();
  }

  beforeEach(() => {
    submittedRequest = null;
    submitRejection = null;
    resultsAvailable = true;
    resultsAvailableAt = null;
    loadedTarget = null;
    listRefreshes = 0;
    currentQuiz = signal<Quiz | null>(null);

    TestBed.configureTestingModule({
      providers: [
        QuizRunnerService,
        {
          provide: QuizService,
          useValue: {
            currentQuiz,
            // `start()` loads the sitting; the fixture is already staged in the signal.
            loadSitting: (target: unknown) => { loadedTarget = target; return Promise.resolve(); },
            touchCurrentQuiz: () => {},
            refresh: () => { listRefreshes++; return Promise.resolve(); }
          }
        },
        {
          provide: AuthService,
          useValue: {
            user: signal({ uid: 'child-1', displayName: 'Sara', parentId: 'parent-1', stageId: 's1', classId: 'c1' }),
            refreshUserData: () => Promise.resolve()
          }
        },
        { provide: NotificationService, useValue: { success: () => {}, error: () => {}, warning: () => {} } },
        // Containment is off for every fixture here (`oneTimeJoin` is unset), but
        // the runner injects the service unconditionally.
        { provide: QuizLockService, useValue: { begin: () => Promise.resolve(null), findMine: () => Promise.resolve(null), recordExit: () => Promise.resolve() } },
        {
          provide: QuizSubmissionService,
          useValue: {
            submit: (request: SubmitQuizRequest) => {
              submittedRequest = request;
              if (submitRejection) return Promise.reject(submitRejection);
              // Grade the way the server will: rebuild each question from the
              // student's response and run the shared grader.
              const questions = (currentQuiz()?.questions ?? []).map(q =>
                hydrateQuestion(
                  q,
                  { questionId: q.id, correctOptionId: 1, correctBlanks: null, referenceAnswer: null },
                  request.responses.find(r => r.questionId === q.id)
                )
              );
              const grade = gradeQuiz(questions);
              return Promise.resolve({
                participationId: '41',
                score: grade.score,
                scorePercent: grade.scorePercent,
                correctCount: grade.correctCount,
                wrongCount: grade.wrongCount,
                pendingReviewCount: grade.pendingReviewCount,
                key: resultsAvailable
                  ? questions.map(q => ({ questionId: q.id, correctOptionId: 1, correctBlanks: null, referenceAnswer: null }))
                  : [],
                resultsAvailable,
                resultsAvailableAt
              });
            }
          }
        }
      ]
    });

    runner = TestBed.inject(QuizRunnerService);
  });

  it('sits and submits an assignment through the assignment, never through ids sent alongside it', async () => {
    await startAndSubmit([chooseQuestion(1)]);

    expect(loadedTarget).toEqual({ homeworkId: '12' });
    expect(submittedRequest!.target).toEqual({ homeworkId: '12' });
  });

  it('sits and submits a practice run as the quiz itself', async () => {
    currentQuiz.set(quizWith([chooseQuestion(1)]));
    await runner.startCustom('5');
    await runner.submit();

    expect(submittedRequest!.target).toEqual({ teacherQuizId: '5' });
  });

  it('sends only the student\'s responses — never a score or an answer', async () => {
    await startAndSubmit([chooseQuestion(1), explainQuestion(2)]);

    const serialized = JSON.stringify(submittedRequest);
    expect(serialized).not.toContain('score');
    expect(serialized).not.toContain('isAnswer');
    expect(serialized).not.toContain('correctOptionId');
    // What it does carry: which option was picked, and the typed response.
    expect(submittedRequest!.responses.length).toBe(2);
    expect(submittedRequest!.responses[0].selectedOptionId).toBe(1);
    expect(submittedRequest!.responses[1].responseText).toBe('<p>Chlorophyll absorbs light.</p>');
  });

  it('puts the returned key on the questions and reloads the quiz list', async () => {
    await startAndSubmit([chooseQuestion(1)]);

    expect(currentQuiz()!.questions[0].options.find(o => o.id === 1)!.isAnswer).toBe(true);
    expect(runner.mode()).toBe('result');
    expect(listRefreshes).toBe(1);
  });

  it('forgets the target on reset, so a later run cannot submit against it', async () => {
    await startAndSubmit([chooseQuestion(1)]);
    runner.reset();
    submittedRequest = null;

    await runner.submit();

    expect(submittedRequest).toBeNull();
  });

  describe('refusals', () => {
    it('shows the server\'s own reason and does not enter the result screen', async () => {
      submitRejection = new ServiceError('400', 'You have already submitted this assignment.');
      const errors: string[] = [];
      TestBed.inject(NotificationService).error = (msg: string) => errors.push(msg);

      await startAndSubmit([chooseQuestion(1)]);

      expect(errors).toEqual(['You have already submitted this assignment.']);
      expect(runner.mode()).not.toBe('result');
    });

    it('falls back to the generic failure message when the server could not be reached', async () => {
      submitRejection = new ServiceError('unavailable', 'The server could not be reached.');
      const errors: string[] = [];
      TestBed.inject(NotificationService).error = (msg: string) => errors.push(msg);

      await startAndSubmit([chooseQuestion(1)]);

      expect(errors).toEqual(['Failed to submit quiz. Please try again.']);
    });
  });

  describe('delayed results', () => {
    it('propagates a withheld result into lastSubmissionSummary for the result screen', async () => {
      resultsAvailable = false;
      resultsAvailableAt = 1_900_000_000_000;

      await startAndSubmit([chooseQuestion(1)]);

      expect(runner.lastSubmissionSummary()).toEqual(jasmine.objectContaining({
        resultsAvailable: false,
        resultsAvailableAt: 1_900_000_000_000
      }));
      // The submission still succeeded and reached the result screen — only
      // the per-question detail is withheld, not the outcome itself.
      expect(runner.mode()).toBe('result');
    });

    it('clears the previous summary on reset, so a stale withheld-result flag cannot leak into the next run', async () => {
      resultsAvailable = false;
      await startAndSubmit([chooseQuestion(1)]);
      expect(runner.lastSubmissionSummary()).not.toBeNull();

      runner.reset();

      expect(runner.lastSubmissionSummary()).toBeNull();
    });

    it('propagates a standalone-quiz submission into lastSubmissionSummary the same way', async () => {
      currentQuiz.set(quizWith([chooseQuestion(1)]));
      await runner.start(7);
      await runner.submit();

      expect(submittedRequest!.target).toEqual({ bankQuizId: 7 });
      expect(runner.lastSubmissionSummary()?.resultsAvailable).toBe(true);
    });
  });
});
