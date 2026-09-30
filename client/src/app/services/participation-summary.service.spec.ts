/**
 * Coverage for the one thing this service must never get wrong: it is a root
 * singleton holding one student's history, and the SPA never reloads on
 * sign-out, so its state outlives the account that produced it.
 *
 * These pin the privacy boundary rather than the summarising arithmetic — the
 * assertion throughout is that the previous account's data is *gone*, not that
 * the next account's numbers are right. The failure this guards against is a
 * parent handing a phone to a second child, or a teacher signing into another
 * organization, and seeing the first account's totals on screen.
 */

import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ParticipationSummaryService } from './participation-summary.service';
import { AuthService } from './auth';
import { HomeworkService } from './homework.service';
import { ApiClient } from './api/api-client.service';
import { ApiPage, ApiParticipationSummary } from './api/api-models';
import { User } from '../models';

function record(id: number, childId: number): ApiParticipationSummary {
  return {
    id, type: 'Quiz', bankQuizId: 1, teacherQuizId: null, quizName: 'Quiz', homeworkId: null, homeworkTitle: null,
    childId, childName: null, reviewerId: null, classId: 1, score: 8, scorePercent: 80, correctCount: 8, wrongCount: 2,
    pendingReviewCount: 0, startedOn: '2026-09-01T00:00:00Z', endedOn: '2026-09-01T00:10:00Z', validationStatus: null
  };
}

function user(uid: string): User {
  return { uid, displayName: uid, completedQuizzes: [] } as unknown as User;
}

describe('ParticipationSummaryService — session isolation', () => {
  let service: ParticipationSummaryService;
  let currentUser: ReturnType<typeof signal<User | null>>;
  /** Resolves the pending `GET /participations`, so a fetch can be held open mid-test. */
  let releaseFetch: (records: ApiParticipationSummary[]) => void;

  beforeEach(() => {
    currentUser = signal<User | null>(user('teacher-a'));

    TestBed.configureTestingModule({
      providers: [
        ParticipationSummaryService,
        {
          provide: AuthService,
          useValue: { user: currentUser, waitForAuthReady: () => Promise.resolve() }
        },
        {
          provide: ApiClient,
          useValue: {
            get: () => new Promise<ApiPage<ApiParticipationSummary>>(resolve => {
              releaseFetch = records => resolve({ items: records, page: 1, pageSize: 100, totalCount: records.length });
            })
          }
        },
        { provide: HomeworkService, useValue: { getById: () => Promise.resolve(null) } }
      ]
    });

    service = TestBed.inject(ParticipationSummaryService);
    TestBed.flushEffects();
  });

  async function loadFor(uid: string): Promise<void> {
    currentUser.set(user(uid));
    TestBed.flushEffects();
    const loading = service.ensureLoaded();
    await Promise.resolve();
    releaseFetch([record(1, 7), record(2, 7)]);
    await loading;
  }

  it('empties every signal the moment the user signs out', async () => {
    await loadFor('teacher-a');
    expect(service.participationRecords().length).toBe(2);

    currentUser.set(null);
    TestBed.flushEffects();

    // Synchronously — nothing re-renders between sign-out and the login screen,
    // so anything still here would be on screen at the next sign-in.
    expect(service.participationRecords()).toEqual([]);
    expect(service.quizStats().completedCount).toBe(0);
    expect(service.completedQuizzes()).toEqual([]);
    expect(service.completedHomeworkIds().size).toBe(0);
    expect(service.needsRevisionFeedback().size).toBe(0);
  });

  it('lists exactly the attempts its completed-quizzes tile counts', async () => {
    // The side panel once read a profile copy the API does not have, so it said
    // "No completed quizzes yet" beside a tile that said 2.
    await loadFor('teacher-a');

    expect(service.quizStats().completedCount).toBe(2);
    expect(service.completedQuizzes().map(q => [q.quizName, q.percentage])).toEqual([['Quiz', 80], ['Quiz', 80]]);
  });

  it('empties on a switch straight from one account to another, before the new load runs', async () => {
    await loadFor('teacher-a');
    expect(service.participationRecords().length).toBe(2);

    // No sign-out in between: the uid simply changes, which is what a second
    // account signing in on the same device looks like to this service.
    currentUser.set(user('teacher-b'));
    TestBed.flushEffects();

    expect(service.participationRecords()).toEqual([]);
    expect(service.quizStats().completedCount).toBe(0);
  });

  it('keeps a first load when its effect runs again for the same account mid-flight', async () => {
    // Straight after sign-in the first screen loads before the effect has settled; the old effect cleared whenever
    // nothing had finished loading yet, so its late run (or any fresh copy of the same user) threw that load away.
    releaseFetch = undefined as unknown as typeof releaseFetch;
    const loading = service.ensureLoaded();
    while (!releaseFetch) await Promise.resolve();       // the first load is in flight...
    currentUser.set(user('teacher-a'));                  // ...when the same account's user is set again
    TestBed.flushEffects();
    releaseFetch([record(1, 7)]);
    await loading;

    expect(service.participationRecords().length).toBe(1);
  });

  it('discards a scan that was still running when the account changed', async () => {
    // The scan is paginated and can outlive the session that started it.
    currentUser.set(user('teacher-a'));
    TestBed.flushEffects();
    const inFlight = service.ensureLoaded();
    await Promise.resolve();

    currentUser.set(user('teacher-b'));
    TestBed.flushEffects();

    // teacher-a's pages arrive after teacher-b is already signed in.
    releaseFetch([record(1, 7), record(2, 7)]);
    await inFlight;

    expect(service.participationRecords()).toEqual([]);
    expect(service.quizStats().completedCount).toBe(0);
  });
});
