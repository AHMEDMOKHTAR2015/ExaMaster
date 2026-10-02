/**
 * The app's question parts → what the API authors from. A mistake here would
 * save the wrong correct answer without any error, so each type is pinned.
 */

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { QUESTION_TYPE, QuizConfig } from '../../models';
import { environment } from '../../../environments/environment';
import { toDraft, toQuizConfig, toQuizSettings } from './question-mapping';
import { TeacherQuizService } from '../teacher-quiz.service';
import { ApiTeacherQuiz } from './api-models';

describe('toDraft', () => {
  it('sends a Choose question as option texts and the correct one by position, not by the app id', () => {
    const draft = toDraft({
      questionTypeId: QUESTION_TYPE.CHOOSE, name: 'Pick', duration: 60,
      options: [{ id: 3, name: 'Oxygen' }, { id: 7, name: 'Carbon dioxide' }], correctOptionId: 7
    });
    expect([draft.type, draft.text, draft.options, draft.correctOption, draft.durationSeconds]).toEqual(['Choose', 'Pick', ['Oxygen', 'Carbon dioxide'], 2, 60]);
  });

  it('sends a Right or Wrong question as its verdict', () => {
    expect(toDraft({ questionTypeId: QUESTION_TYPE.RIGHT_WRONG, name: 'The Moon makes light.', options: [], correctOptionId: 2 }).isRight).toBeFalse();
    expect(toDraft({ questionTypeId: QUESTION_TYPE.RIGHT_WRONG, name: 'Water is wet.', options: [], correctOptionId: 1 }).isRight).toBeTrue();
  });

  it('sends a Complete question as the passage with its markers, for the server to parse', () => {
    const draft = toDraft({
      questionTypeId: QUESTION_TYPE.COMPLETE, name: 'Plants make food by _____.', options: [],
      segments: [{ kind: 'text', text: 'Plants make food by ' }, { kind: 'blank', index: 0, expectedLength: 14 }, { kind: 'text', text: '.' }],
      correctBlanks: ['photosynthesis']
    });
    expect([draft.type, draft.text]).toEqual(['Complete', 'Plants make food by photosynthesis(Complete).']);
  });

  it('sends an Explain question as its prompt, model answer and weight', () => {
    const draft = toDraft({
      questionTypeId: QUESTION_TYPE.EXPLAIN, name: 'Why?', options: [], subjectHtml: '<p>Why?</p>', weightPercent: 20, referenceAnswer: '<p>Tilt</p>'
    });
    expect([draft.type, draft.subjectHtml, draft.referenceAnswer, draft.weightPercent, draft.text]).toEqual(['Explain', '<p>Why?</p>', '<p>Tilt</p>', 20, null]);
  });

  it('leaves out a per-question timer the API would refuse, so the quiz default applies', () => {
    expect(toDraft({ questionTypeId: QUESTION_TYPE.CHOOSE, name: 'x', options: [], duration: 0 }).durationSeconds).toBeNull();
  });
});

describe('quiz settings', () => {
  it('round-trip, the duration in seconds both ways', () => {
    const config: QuizConfig = {
      allowBack: false, allowReview: true, autoMove: true, duration: 600, pageSize: 2, requiredAll: true, richText: false,
      shuffleQuestions: true, shuffleOptions: false, showClock: true, showPager: false, oneTimeJoin: true, ImagePath: 'assets/quiz-images/a.png'
    };
    expect(toQuizConfig(toQuizSettings(config))).toEqual(config);
  });
});

describe('TeacherQuizService', () => {
  const stored: ApiTeacherQuiz = {
    id: 5, name: 'Unit 4', description: '', subjectId: 2, stageId: 1, semester: 'First', createdById: 9, createdOn: '2026-09-01T00:00:00Z',
    settings: toQuizSettings({}),
    questions: [
      { number: 2, type: 'RightWrong', name: 'Ice is cold.', text: 'Ice is cold.', options: [{ id: 1, name: 'Right' }, { id: 2, name: 'Wrong' }], segments: [],
        subjectHtml: null, weightPercent: null, durationSeconds: null, key: { questionId: 2, correctOptionId: 1, correctBlanks: null, referenceAnswer: null },
        tagIds: [7] },
      { number: 1, type: 'Complete', name: 'Plants use _____.', text: 'Plants use light(Complete).', options: [],
        segments: [{ kind: 'Text', text: 'Plants use ' }, { kind: 'Blank', index: 0, expectedLength: 5 }, { kind: 'Text', text: '.' }],
        subjectHtml: null, weightPercent: null, durationSeconds: 60, key: { questionId: 1, correctOptionId: null, correctBlanks: ['light'], referenceAnswer: null },
        tagIds: [] }
    ]
  };

  it('puts the answers back on the questions, in their numbered order, for the author', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);
    const loaded = TestBed.inject(TeacherQuizService).getById('5');
    http.expectOne(`${environment.apiUrl}/teacher-quizzes/5`).flush({ quiz: stored });

    const quiz = (await loaded)!;
    expect(quiz.questions.map(q => q.id)).toEqual([1, 2]);
    expect(quiz.questions[0].blanks).toEqual([{ index: 0, answer: 'light' }]);
    expect(quiz.questions[1].options.find(o => o.isAnswer)?.name).toBe('Right');
    expect([quiz.createdBy, quiz.semester]).toEqual(['9', 'first']);
    expect(quiz.questions.map(q => q.tagIds)).toEqual([[], ['7']]);
    http.verify();
  });

  it('counts a subject\'s teacher-quiz questions by adding up every quiz in it', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);
    const counted = TestBed.inject(TeacherQuizService).countQuestionsInSubject('2');
    const summary = { name: 'Q', description: '', subjectId: 2, stageId: null, semester: null, createdById: 9, createdOn: '2026-09-01T00:00:00Z' };
    http.expectOne(request => request.url === `${environment.apiUrl}/teacher-quizzes` && request.params.get('subjectId') === '2')
      .flush({ quizzes: [{ ...summary, id: 1, questionCount: 3 }, { ...summary, id: 2, questionCount: 4 }] });

    expect(await counted).toBe(7);
    http.verify();
  });

  it('sends each question\'s tags back as the API\'s ids when the quiz is saved', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);
    const service = TestBed.inject(TeacherQuizService);
    const loaded = service.getById('5');
    http.expectOne(`${environment.apiUrl}/teacher-quizzes/5`).flush({ quiz: stored });
    const quiz = (await loaded)!;

    const created = service.create(quiz);
    const request = http.expectOne(`${environment.apiUrl}/teacher-quizzes`);
    expect(request.request.body.questions.map((q: { tagIds: number[] }) => q.tagIds)).toEqual([[], [7]]);
    request.flush({ id: 6 });
    expect(await created).toBe('6');
    http.verify();
  });
});
