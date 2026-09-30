import {
  indexQuizzesById,
  effectiveSubjectId,
  effectiveSemester,
  filterAssignments,
  computeAssignmentResult,
  sumAssignmentResults
} from './quiz-management';
import { HomeworkAssignment, ParticipationRecord } from '../models';
import { QuizInfo } from '../interfaces';

/**
 * Pure-function tests for the Quiz Management filtering + roll-up rules. No
 * TestBed/DI — the logic is static and deterministic (same approach as
 * teacher-scope.service.spec.ts).
 */
describe('quiz-management helpers', () => {
  const quiz = (id: number, over: Partial<QuizInfo> = {}): QuizInfo => ({
    id, name: `Quiz ${id}`, description: '', config: {}, questionCount: 5, ...over
  });

  // q1 → Math/first, q2 → Arabic/second, q3 → untagged.
  const quizzes: QuizInfo[] = [
    quiz(1, { subjectId: 's-math', semester: 'first' }),
    quiz(2, { subjectId: 's-arabic', semester: 'second' }),
    quiz(3)
  ];
  const quizById = indexQuizzesById(quizzes);
  const quizName = (a: HomeworkAssignment) => quizById.get(a.quizId)?.name ?? `Quiz #${a.quizId}`;

  const assignment = (over: Partial<HomeworkAssignment> = {}): HomeworkAssignment => ({
    id: 'a', quizId: 1, title: 'Untitled', stageId: 'primary', classId: 'c1',
    dueAt: 0, createdBy: 't1', createdAt: 0, active: true, ...over
  });

  // ---- effective subject/semester (own value wins, else quiz fallback) -------

  it('reads subject/semester off the assignment when present', () => {
    const a = assignment({ quizId: 1, subjectId: 's-arabic', semester: 'second' });
    expect(effectiveSubjectId(a, quizById)).toBe('s-arabic');
    expect(effectiveSemester(a, quizById)).toBe('second');
  });

  it('falls back to the linked quiz when the assignment is untagged', () => {
    const a = assignment({ quizId: 1, subjectId: undefined, semester: undefined });
    expect(effectiveSubjectId(a, quizById)).toBe('s-math');
    expect(effectiveSemester(a, quizById)).toBe('first');
  });

  it('is undefined when neither assignment nor quiz carries the tag', () => {
    const a = assignment({ quizId: 3, subjectId: undefined, semester: undefined });
    expect(effectiveSubjectId(a, quizById)).toBeUndefined();
    expect(effectiveSemester(a, quizById)).toBeUndefined();
  });

  // ---- filterAssignments -----------------------------------------------------

  const assignments: HomeworkAssignment[] = [
    assignment({ id: 'a1', quizId: 1, title: 'Algebra HW', classId: 'c1', kind: 'homework' }),               // Math/first
    assignment({ id: 'a2', quizId: 2, title: 'Grammar Quiz', classId: 'c1', kind: 'quiz' }),                 // Arabic/second
    assignment({ id: 'a3', quizId: 1, title: 'Algebra Quiz', classId: 'c2', kind: 'quiz', semester: 'second' }) // Math but overridden to second
  ];

  it('filters by subject via the effective value', () => {
    const out = filterAssignments(assignments, { subjectId: 's-math' }, quizById, quizName);
    expect(out.map(a => a.id)).toEqual(['a1', 'a3']);
  });

  it('filters by semester, honoring an assignment override over its quiz', () => {
    const out = filterAssignments(assignments, { semester: 'second' }, quizById, quizName);
    // a2 (quiz=second) and a3 (override=second); a1 is first.
    expect(out.map(a => a.id)).toEqual(['a2', 'a3']);
  });

  it('filters by class and by kind', () => {
    expect(filterAssignments(assignments, { classId: 'c2' }, quizById, quizName).map(a => a.id)).toEqual(['a3']);
    expect(filterAssignments(assignments, { kind: 'quiz' }, quizById, quizName).map(a => a.id)).toEqual(['a2', 'a3']);
  });

  it('matches search against title and the linked quiz name', () => {
    expect(filterAssignments(assignments, { search: 'grammar' }, quizById, quizName).map(a => a.id)).toEqual(['a2']);
    expect(filterAssignments(assignments, { search: 'algebra' }, quizById, quizName).map(a => a.id)).toEqual(['a1', 'a3']);
  });

  it('treats empty/all filters as no constraint', () => {
    const out = filterAssignments(assignments, { subjectId: '', semester: 'all', classId: '', kind: 'all', search: '' }, quizById, quizName);
    expect(out.length).toBe(3);
  });

  // ---- computeAssignmentResult ----------------------------------------------

  /**
   * `ParticipationRecord.score` is a raw correct-answer count, never a
   * percentage — `scorePercent` is the percentage. These fixtures therefore
   * express an intended average via `scorePercent`, and a couple of cases below
   * cover legacy records that predate that field.
   */
  const record = (childId: string, over: Partial<ParticipationRecord> = {}): ParticipationRecord => ({
    id: `p-${childId}`, type: 'homework', quizId: 1, childId, stageId: 'primary', classId: 'c1',
    score: 0, status: 'completed', startedAt: 0, endedAt: 0, correctCount: 0, wrongCount: 0, ...over
  });

  it('rolls up statuses, completion rate, average score and validations', () => {
    const targets = ['s1', 's2', 's3', 's4'];
    const records = new Map<string, ParticipationRecord>([
      ['s1', record('s1', { status: 'completed', scorePercent: 80, validation: { status: 'approved', validatedBy: 't1', validatedAt: 1 } })],
      ['s2', record('s2', { status: 'completed', scorePercent: 60 })],
      ['s3', record('s3', { status: 'in-progress' })]
      // s4 has no record
    ]);

    const past = computeAssignmentResult(targets, records, /* dueAt */ 100, /* now */ 200);
    expect(past.targeted).toBe(4);
    expect(past.completed).toBe(2);
    expect(past.inProgress).toBe(1);
    expect(past.overdue).toBe(1);      // s4 missing + past due
    expect(past.notStarted).toBe(0);
    expect(past.completionRate).toBe(50);   // 2/4
    expect(past.averageScore).toBe(70);     // (80+60)/2
    expect(past.validated).toBe(1);
  });

  it('averages percentages, not the raw correct-answer count', () => {
    // 3 of 4 correct is 75%, not 3. Averaging `score` directly would report 3.
    const records = new Map<string, ParticipationRecord>([
      ['s1', record('s1', { score: 3, correctCount: 3, wrongCount: 1, scorePercent: 75 })]
    ]);
    expect(computeAssignmentResult(['s1'], records, 0, 1).averageScore).toBe(75);
  });

  it('derives the percentage for legacy records that have no scorePercent', () => {
    const records = new Map<string, ParticipationRecord>([
      ['s1', record('s1', { score: 8, correctCount: 8, wrongCount: 2 })]
    ]);
    expect(computeAssignmentResult(['s1'], records, 0, 1).averageScore).toBe(80);
  });

  it('picks up a teacher-graded score once review raises it', () => {
    // Auto-graded questions alone earned 60%; the teacher's mark took it to 90%.
    const beforeReview = new Map<string, ParticipationRecord>([
      ['s1', record('s1', { correctCount: 3, wrongCount: 0, scorePercent: 60, pendingReviewCount: 1 })]
    ]);
    const afterReview = new Map<string, ParticipationRecord>([
      ['s1', record('s1', { correctCount: 3, wrongCount: 0, scorePercent: 90, pendingReviewCount: 0 })]
    ]);
    expect(computeAssignmentResult(['s1'], beforeReview, 0, 1).averageScore).toBe(60);
    expect(computeAssignmentResult(['s1'], afterReview, 0, 1).averageScore).toBe(90);
  });

  it('counts a missing record as not-started before the due date', () => {
    const res = computeAssignmentResult(['s1'], new Map(), /* dueAt */ 500, /* now */ 100);
    expect(res.notStarted).toBe(1);
    expect(res.overdue).toBe(0);
  });

  it('guards against divide-by-zero with no targets', () => {
    const res = computeAssignmentResult([], new Map(), 0, 100);
    expect(res.completionRate).toBe(0);
    expect(res.averageScore).toBe(0);
  });

  // ---- sumAssignmentResults --------------------------------------------------

  it('combines results with a completed-weighted average', () => {
    // A: 1 completed @ 90; B: 3 completed @ 50 → mean = (90 + 150) / 4 = 60.
    const a = computeAssignmentResult(['x'], new Map([['x', record('x', { scorePercent: 90 })]]), 0, 1);
    const b = computeAssignmentResult(
      ['p', 'q', 'r'],
      new Map([
        ['p', record('p', { scorePercent: 50 })],
        ['q', record('q', { scorePercent: 50 })],
        ['r', record('r', { scorePercent: 50 })]
      ]),
      0, 1
    );
    const total = sumAssignmentResults([a, b]);
    expect(total.completed).toBe(4);
    expect(total.targeted).toBe(4);
    expect(total.averageScore).toBe(60);
    expect(total.completionRate).toBe(100);
  });
});
