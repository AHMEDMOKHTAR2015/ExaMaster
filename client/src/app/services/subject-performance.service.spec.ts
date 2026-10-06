import { TestBed } from '@angular/core/testing';
import { SubjectPerformanceService } from './subject-performance.service';
import { ApiClient } from './api/api-client.service';
import { ApiSubjectPerformance } from './api/api-models';

function row(overrides: Partial<ApiSubjectPerformance>): ApiSubjectPerformance {
  return {
    subjectId: 1, subjectName: 'Math', subjectColor: '#1565C0', quizCount: 2, homeworkCount: 1, awaitingReviewCount: 0,
    pointsEarned: 216, pointsPossible: 300, scorePercent: 72, earlierPercent: 60, recentPercent: 80, level: 'Good', ...overrides
  };
}

describe('SubjectPerformanceService', () => {
  let rows: ApiSubjectPerformance[];
  let requestedPath: string | undefined;

  beforeEach(() => {
    rows = [];
    requestedPath = undefined;
    TestBed.configureTestingModule({
      providers: [{
        provide: ApiClient,
        useValue: { get: (path: string) => { requestedPath = path; return Promise.resolve(rows); } }
      }]
    });
  });

  it('reads the caller\'s own standing without naming anyone', async () => {
    await TestBed.inject(SubjectPerformanceService).listMine();
    expect(requestedPath).toBe('/me/subject-performance');
  });

  it('maps a graded subject: string id, lower-case level, trend as recent minus earlier', async () => {
    rows = [row({})];
    const [subject] = await TestBed.inject(SubjectPerformanceService).listMine();
    expect(subject).toEqual({
      subjectId: '1', subjectName: 'Math', subjectColor: '#1565C0', quizCount: 2, homeworkCount: 1,
      awaitingReviewCount: 0, pointsEarned: 216, pointsPossible: 300, scorePercent: 72, level: 'good', trendPoints: 20
    });
  });

  it('reports a falling trend as negative points', async () => {
    rows = [row({ earlierPercent: 90, recentPercent: 55 })];
    const [subject] = await TestBed.inject(SubjectPerformanceService).listMine();
    expect(subject.trendPoints).toBe(-35);
  });

  it('has no trend unless both halves of the year have graded work', async () => {
    rows = [row({ earlierPercent: null }), row({ subjectId: 2, recentPercent: null })];
    const subjects = await TestBed.inject(SubjectPerformanceService).listMine();
    expect(subjects.map(subject => subject.trendPoints)).toEqual([undefined, undefined]);
  });

  it('leaves score and level out while every submission still waits for a mark', async () => {
    rows = [row({ scorePercent: null, level: null, earlierPercent: null, recentPercent: null, subjectColor: null, awaitingReviewCount: 2 })];
    const [subject] = await TestBed.inject(SubjectPerformanceService).listMine();
    expect(subject.scorePercent).toBeUndefined();
    expect(subject.level).toBeUndefined();
    expect(subject.subjectColor).toBeUndefined();
    expect(subject.awaitingReviewCount).toBe(2);
  });
});
