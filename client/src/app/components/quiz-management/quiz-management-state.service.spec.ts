import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { QuizManagementStateService } from './quiz-management-state.service';
import { AuthService } from '../../services/auth';
import {
  TeacherScopeService, TeacherStatsService, HomeworkParticipationService, GradeService
} from '../../services/admin';
import { HomeworkService } from '../../services/homework.service';
import { QuizService } from '../../services/quiz.service';
import { TeacherQuizService } from '../../services/teacher-quiz.service';
import { NotificationService } from '../../services/notification.service';
import { HomeworkAssignment, User } from '../../models';

function teacherUser(uid: string): User {
  return { uid, displayName: `Teacher ${uid}`, email: `${uid}@school.test` } as User;
}

function assignmentFor(uid: string): HomeworkAssignment {
  return {
    id: `hw-${uid}`, quizId: 1, title: `${uid}'s assignment`,
    stageId: 'stage-1', classId: 'class-1', dueAt: Date.now() + 86_400_000,
    createdBy: uid, createdAt: Date.now(), active: true
  } as HomeworkAssignment;
}

/**
 * The workspace state is provided on the `/quiz-management` route, so in
 * principle it dies with the route. These cover the case where it does not:
 * signing out flips `isAuthenticated()` before the navigation to `/login`
 * lands, which rebuilds the shell against the same route injector and the same
 * instance. Without an identity guard the next teacher sees the previous one's
 * classes, assignments and participation cache.
 */
describe('QuizManagementStateService — account isolation', () => {
  let user: ReturnType<typeof signal<User | null>>;
  let scopeLoads: string[];

  function setup(): QuizManagementStateService {
    user = signal<User | null>(teacherUser('teacher-1'));
    scopeLoads = [];

    const scopeStub = {
      resolveTeacher: (u: User) => Promise.resolve({ id: `t-${u.uid}`, firstName: 'A', lastName: 'B' }),
      // Scoped by the teacher record alone: the API knows who is asking.
      loadScope: (teacher: { id: string }) => {
        const uid = teacher.id.replace(/^t-/, '');
        scopeLoads.push(uid);
        return Promise.resolve({
          stages: [], allClasses: [], allSubjects: [], students: [],
          assignments: [assignmentFor(uid)]
        });
      }
    };

    TestBed.configureTestingModule({
      providers: [
        QuizManagementStateService,
        { provide: AuthService, useValue: { user } },
        { provide: TeacherScopeService, useValue: scopeStub },
        { provide: TeacherStatsService, useValue: { getRosterStats: () => Promise.resolve({ studentCount: 0, averageScore: 0, scoredCount: 0 }) } },
        { provide: HomeworkParticipationService, useValue: {} },
        { provide: HomeworkService, useValue: { listByCreator: () => Promise.resolve([]) } },
        { provide: QuizService, useValue: { quizList: signal([]) } },
        { provide: TeacherQuizService, useValue: { listByCreator: () => Promise.resolve([]) } },
        { provide: NotificationService, useValue: { error: () => undefined, success: () => undefined } },
        { provide: TranslateService, useValue: { instant: (k: string) => k } },
        { provide: GradeService, useValue: { listGrades: () => Promise.resolve({ items: [], nextCursor: undefined }) } }
      ]
    });

    return TestBed.inject(QuizManagementStateService);
  }

  it('loads the signed-in teacher’s scope', async () => {
    const state = setup();

    await state.init();

    expect(scopeLoads).toEqual(['teacher-1']);
    expect(state.assignments()[0].createdBy).toBe('teacher-1');
  });

  /** The reported bug: teacher 2 opening Results and seeing teacher 1's data. */
  it('clears the previous teacher’s data when the account changes', async () => {
    const state = setup();
    await state.init();
    expect(state.assignments().length).toBe(1);

    user.set(teacherUser('teacher-2'));
    TestBed.flushEffects();

    expect(state.assignments()).toEqual([]);
    expect(state.teacher()).toBeNull();
    expect(state.recordsByAssignment().size).toBe(0);
  });

  /**
   * Clearing the signals is only half of it: `init()` memoizes, so without
   * also dropping that promise the next call is a no-op and the workspace
   * stays empty for the new teacher.
   */
  it('re-loads for the new teacher on the next init', async () => {
    const state = setup();
    await state.init();

    user.set(teacherUser('teacher-2'));
    TestBed.flushEffects();
    await state.init();

    expect(scopeLoads).toEqual(['teacher-1', 'teacher-2']);
    expect(state.assignments()[0].createdBy).toBe('teacher-2');
  });

  it('clears on sign-out, and does not memoize a signed-out load', async () => {
    const state = setup();
    await state.init();

    user.set(null);
    TestBed.flushEffects();
    await state.init(); // the rebuilt shell calls this while signed out

    expect(state.assignments()).toEqual([]);
    // Still only the one load: nothing was fetched for a null user, and
    // nothing was memoized that would block the next real sign-in.
    expect(scopeLoads).toEqual(['teacher-1']);

    user.set(teacherUser('teacher-2'));
    TestBed.flushEffects();
    await state.init();

    expect(scopeLoads).toEqual(['teacher-1', 'teacher-2']);
  });

  it('drops filters belonging to the previous teacher', async () => {
    const state = setup();
    await state.init();
    state.filterClassId.set('class-only-teacher-1-can-see');
    state.searchQuery.set('algebra');

    user.set(teacherUser('teacher-2'));
    TestBed.flushEffects();

    expect(state.filterClassId()).toBe('');
    expect(state.searchQuery()).toBe('');
  });
});
