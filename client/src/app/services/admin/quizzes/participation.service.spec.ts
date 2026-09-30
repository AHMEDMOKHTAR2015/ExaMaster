/**
 * The API serves at most 100 attempts per request; a caller asking for more
 * (the teacher dashboard asks for 200) must still get them, not a 400.
 */

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ParticipationService } from './participation.service';
import { ApiParticipationSummary } from '../../api/api-models';
import { environment } from '../../../../environments/environment';

function attempt(id: number): ApiParticipationSummary {
  return {
    id, type: 'Quiz', bankQuizId: 1, teacherQuizId: null, quizName: 'Q', homeworkId: null, homeworkTitle: null, childId: 5, childName: null,
    reviewerId: null, classId: 1, score: 1, scorePercent: 50, correctCount: 1, wrongCount: 1, pendingReviewCount: 0,
    startedOn: '2026-09-01T00:00:00Z', endedOn: '2026-09-01T00:05:00Z', validationStatus: null
  };
}

describe('ParticipationService paging', () => {
  let http: HttpTestingController;
  let service: ParticipationService;
  const settle = () => new Promise(resolve => setTimeout(resolve));
  const url = (page: number, size: number) => `${environment.apiUrl}/participations?childId=5&page=${page}&pageSize=${size}`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(ParticipationService);
  });

  afterEach(() => http.verify());

  it('gathers a 200-attempt page from two requests of 100', async () => {
    const result = service.listByUser('5', 200);
    await settle();
    http.expectOne(url(1, 100)).flush({ items: Array.from({ length: 100 }, (_, i) => attempt(i + 1)), page: 1, pageSize: 100, totalCount: 150 });
    await settle();
    http.expectOne(url(2, 100)).flush({ items: Array.from({ length: 50 }, (_, i) => attempt(i + 101)), page: 2, pageSize: 100, totalCount: 150 });
    const page = await result;
    expect([page.items.length, page.nextCursor]).toEqual([150, undefined]);
  });

  it('stops early when the first request already holds everything', async () => {
    const result = service.listByUser('5', 200);
    await settle();
    http.expectOne(url(1, 100)).flush({ items: [attempt(1)], page: 1, pageSize: 100, totalCount: 1 });
    expect((await result).items.length).toBe(1);
  });

  it('pages as the API does below the limit, the cursor being the next page', async () => {
    const result = service.listByUser('5', 20, '2');
    await settle();
    http.expectOne(url(2, 20)).flush({ items: [attempt(21)], page: 2, pageSize: 20, totalCount: 45 });
    expect((await result).nextCursor).toBe('3');
  });
});
