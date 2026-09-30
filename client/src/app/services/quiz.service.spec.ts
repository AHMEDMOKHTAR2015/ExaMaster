import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { QuizService, SittingTarget } from './quiz.service';
import { AuthService } from './auth/auth.service';
import { Quiz, QuizConfig, QUESTION_TYPE, DEFAULT_QUESTION_DURATION_SECONDS } from '../models';
import { ApiBankQuizSummary, ApiSitting } from './api/api-models';
import { toQuizSettings } from './api/question-mapping';
import { environment } from '../../environments/environment';

const fakeConfig: QuizConfig = {
  allowBack: true,
  allowReview: true,
  autoMove: false,
  duration: 300,
  pageSize: 1,
  requiredAll: false,
  richText: false,
  shuffleQuestions: false,
  shuffleOptions: false,
  showClock: true,
  showPager: true
};

/**
 * Regression coverage for `touchCurrentQuiz()`. `QuizRunnerService`'s
 * `allAnswered`/`firstUnansweredIndex`/`reviewItems` computed signals derive
 * from `currentQuiz().questions` — since answer selection mutates a question's
 * options in place (no `.set()`/`.update()` on `currentQuiz`), those computed
 * signals would otherwise freeze at whatever they evaluated to on their first
 * read and never reflect later answers for the rest of the quiz session.
 */
describe('QuizService.touchCurrentQuiz', () => {
  let service: QuizService;

  function fakeQuiz(): Quiz {
    return {
      id: 1,
      name: 'Test Quiz',
      description: '',
      config: fakeConfig,
      questions: [
        {
          id: 1,
          name: 'Q1',
          questionTypeId: 1,
          userAnsweredQuestion: false,
          duration: DEFAULT_QUESTION_DURATION_SECONDS,
          options: [
            { id: 1, name: 'A', isAnswer: false, userSelected: false },
            { id: 2, name: 'B', isAnswer: false, userSelected: false }
          ]
        }
      ]
    };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      // Signed out: the tests below only exercise `currentQuiz`/`touchCurrentQuiz`.
      providers: [
        QuizService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { isAuthenticated: signal(false), user: signal(null) } }
      ]
    });
    service = TestBed.inject(QuizService);
  });

  it('recomputes a dependent computed signal only after touchCurrentQuiz() is called', () => {
    service.currentQuiz.set(fakeQuiz());
    const questions = computed(() => service.currentQuiz()?.questions ?? []);
    const allAnswered = computed(() => questions().every(q => q.options.some(o => o.userSelected)));

    expect(allAnswered()).toBe(false);

    // Simulate question-options.component.ts's onSelect() mutating in place.
    service.currentQuiz()!.questions[0].options[0].userSelected = true;

    // Without touching the signal, the computed stays stale.
    expect(allAnswered()).toBe(false);

    service.touchCurrentQuiz();

    expect(allAnswered()).toBe(true);
  });

  it('is a no-op when there is no current quiz', () => {
    service.currentQuiz.set(null);
    expect(() => service.touchCurrentQuiz()).not.toThrow();
    expect(service.currentQuiz()).toBeNull();
  });
});

/**
 * The core security invariant: the live quiz object never carries a correct
 * answer before submission. The API's sitting has no member an answer could
 * travel in, so the mapping's job is only to leave the app's answer fields
 * empty — and to ask for the right sitting: an assignment is sat through the
 * assignment, whose quiz the server decides.
 */
describe('QuizService sittings and list', () => {
  let service: QuizService;
  let http: HttpTestingController;
  const user = signal<{ uid: string } | null>({ uid: 'student-1' });

  const sitting: ApiSitting = {
    bankQuizId: null, teacherQuizId: 7, homeworkId: 12, name: 'Unit 4 homework', settings: toQuizSettings({ ...fakeConfig, oneTimeJoin: true }),
    questions: [
      { questionId: 1, type: 'Choose', name: 'Pick one', options: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }], segments: [],
        subjectHtml: null, weightPercent: null, durationSeconds: 45 },
      { questionId: 2, type: 'Complete', name: 'Plants use _____.', options: [],
        segments: [{ kind: 'Text', text: 'Plants use ' }, { kind: 'Blank', index: 0, expectedLength: 5 }, { kind: 'Text', text: '.' }],
        subjectHtml: null, weightPercent: null, durationSeconds: 60 },
      { questionId: 3, type: 'Explain', name: 'Explain photosynthesis.', options: [], segments: [],
        subjectHtml: '<p>Explain <b>photosynthesis</b>.</p>', weightPercent: 30, durationSeconds: 120 }
    ]
  };

  beforeEach(() => {
    user.set({ uid: 'student-1' });
    TestBed.configureTestingModule({
      providers: [
        QuizService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { isAuthenticated: signal(true), user } }
      ]
    });
    service = TestBed.inject(QuizService);
    http = TestBed.inject(HttpTestingController);
    TestBed.flushEffects();
  });

  afterEach(() => http.verify());

  async function load(target: SittingTarget, path: string): Promise<void> {
    const loaded = service.loadSitting(target);
    http.expectOne(`${environment.apiUrl}${path}`).flush(sitting);
    await loaded;
  }

  it('asks for the assignment\'s sitting, the bank quiz\'s, or the teacher quiz\'s', async () => {
    await load({ homeworkId: '12' }, '/assignments/12/sitting');
    await load({ bankQuizId: 3 }, '/quizzes/3/sitting');
    await load({ teacherQuizId: '7' }, '/teacher-quizzes/7/sitting');
  });

  it('maps the questions with every answer field empty, keeping what is not an answer', async () => {
    await load({ homeworkId: '12' }, '/assignments/12/sitting');
    const quiz = service.currentQuiz()!;
    expect([quiz.name, quiz.config.oneTimeJoin, quiz.questions.map(q => q.duration)]).toEqual(['Unit 4 homework', true, [45, 60, 120]]);
    expect(quiz.questions[0].options.every(o => !o.isAnswer && !o.userSelected)).toBe(true);
    expect(quiz.questions[1].questionTypeId).toBe(QUESTION_TYPE.COMPLETE);
    expect(quiz.questions[1].blanks).toEqual([{ index: 0, answer: '', userAnswer: '' }]);
    expect([quiz.questions[2].referenceAnswer, quiz.questions[2].subjectHtml, quiz.questions[2].weightPercent])
      .toEqual(['', '<p>Explain <b>photosynthesis</b>.</p>', 30]);
  });

  it('loads the list once per account, and clears it when someone else signs in', async () => {
    const summary = { id: 4, name: 'Science Basics', description: '', settings: toQuizSettings({}), subjectId: 2, stageId: 1,
      gradeId: null, classId: null, semester: 'First', reviewerId: 9, questionCount: 5, completedByMe: true } as ApiBankQuizSummary;
    const first = service.loadAll();
    http.expectOne(`${environment.apiUrl}/quizzes`).flush({ quizzes: [summary] });
    await first;
    await service.loadAll();                              // no second request
    expect(service.quizList().map(q => [q.id, q.completedByMe, q.reviewerId, q.semester])).toEqual([[4, true, '9', 'first']]);

    user.set({ uid: 'student-2' });
    TestBed.flushEffects();
    expect(service.quizList()).toEqual([]);
  });

  it('keeps a list asked for straight after sign-in, before its effect has run', async () => {
    // The first screen after sign-in loads before the effect notices the new account; the effect must not then
    // discard that load as the previous account's.
    user.set({ uid: 'student-2' });
    const loading = service.loadAll();
    http.expectOne(`${environment.apiUrl}/quizzes`).flush({ quizzes: [{ id: 4, name: 'Science Basics', settings: toQuizSettings({}) }] });
    TestBed.flushEffects();
    await loading;

    expect(service.quizList().map(q => q.id)).toEqual([4]);
  });
});
