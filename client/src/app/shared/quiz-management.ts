import { HomeworkAssignment, AssignmentKind, HomeworkSemester, ParticipationRecord } from '../models';
import { QuizInfo } from '../interfaces';
import { participationScorePercent } from './participation-score';

/**
 * Pure helpers backing the teacher Quiz Management workspace.
 *
 * Kept out of the component so the subject/semester filtering and the results
 * roll-ups are reusable and unit-testable in isolation (mirrors the approach in
 * `shared/teaching.ts`). Nothing here does I/O or depends on Angular.
 *
 * Subject/semester live on both the assignment and the quiz it links to. Teacher
 * assignments created before this feature may not carry them, so the "effective"
 * value falls back to the linked quiz — that fallback is the single rule every
 * filter and roll-up resolves through.
 */

/** A semester selection in the UI; `'all'` means no semester constraint. */
export type SemesterFilter = HomeworkSemester | 'all';

/** A kind selection in the UI; `'all'` means quizzes and homework together. */
export type KindFilter = AssignmentKind | 'all';

/** Index a quiz list by id for O(1) lookups while filtering/joining. */
export function indexQuizzesById(quizzes: QuizInfo[]): Map<number, QuizInfo> {
  return new Map(quizzes.map(q => [q.id, q]));
}

/** Assignment's own subject, else the linked quiz's subject. */
export function effectiveSubjectId(
  assignment: HomeworkAssignment,
  quizById: Map<number, QuizInfo>
): string | undefined {
  return assignment.subjectId ?? quizById.get(assignment.quizId)?.subjectId;
}

/** Assignment's own semester, else the linked quiz's semester. */
export function effectiveSemester(
  assignment: HomeworkAssignment,
  quizById: Map<number, QuizInfo>
): HomeworkSemester | undefined {
  return assignment.semester ?? quizById.get(assignment.quizId)?.semester;
}

/** The effective assignment kind; legacy records without `kind` are homework. */
export function assignmentKind(assignment: HomeworkAssignment): AssignmentKind {
  return assignment.kind ?? 'homework';
}

/** Criteria for {@link filterAssignments}; an empty/`'all'` field is "no constraint". */
export interface AssignmentFilter {
  subjectId?: string;
  semester?: SemesterFilter;
  classId?: string;
  kind?: KindFilter;
  search?: string;
}

/**
 * Narrow a teacher's assignments by the Quiz Management filter bar. Subject and
 * semester resolve through {@link effectiveSubjectId}/{@link effectiveSemester}
 * so quiz-tagged-only records still match. `search` matches the assignment title
 * or the linked quiz's name (resolved via `quizName`).
 */
export function filterAssignments(
  assignments: HomeworkAssignment[],
  filter: AssignmentFilter,
  quizById: Map<number, QuizInfo>,
  quizName: (assignment: HomeworkAssignment) => string
): HomeworkAssignment[] {
  const subjectId = filter.subjectId || '';
  const semester = filter.semester ?? 'all';
  const classId = filter.classId || '';
  const kind = filter.kind ?? 'all';
  const search = (filter.search ?? '').toLowerCase().trim();

  return assignments.filter(a => {
    if (subjectId && effectiveSubjectId(a, quizById) !== subjectId) return false;
    if (semester !== 'all' && effectiveSemester(a, quizById) !== semester) return false;
    if (classId && a.classId !== classId) return false;
    if (kind !== 'all' && assignmentKind(a) !== kind) return false;
    if (search) {
      const haystack = `${a.title} ${quizName(a)}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

/** Aggregate progress/score figures for one assignment. */
export interface AssignmentResult {
  /** Students the assignment targets (picked uids, or the whole class). */
  targeted: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  overdue: number;
  /** completed / targeted, as a 0–100 percentage (0 when nothing is targeted). */
  completionRate: number;
  /**
   * Mean score over completed submissions, 0–100 (0 when none completed).
   * Resolved per submission via `participationScorePercent` — `record.score` is
   * a raw correct-answer count, not a percentage, so it must never be averaged
   * directly.
   */
  averageScore: number;
  /** Completed submissions that carry a teacher validation. */
  validated: number;
}

/**
 * Roll a single assignment's progress up from its target roster and the
 * submissions recorded against it. A target with no record counts as overdue
 * when the due date has passed, otherwise not-started — matching the status
 * logic used by the dashboard's tracking popup.
 */
export function computeAssignmentResult(
  targetUids: string[],
  recordsByChild: Map<string, ParticipationRecord>,
  dueAt: number,
  now: number = Date.now()
): AssignmentResult {
  const isOverdue = dueAt < now;
  let completed = 0, inProgress = 0, notStarted = 0, overdue = 0, validated = 0;
  let scoreSum = 0;

  for (const uid of targetUids) {
    const record = recordsByChild.get(uid);
    if (record?.status === 'completed') {
      completed++;
      scoreSum += participationScorePercent(record);
      if (record.validation) validated++;
    } else if (record?.status === 'in-progress') {
      inProgress++;
    } else if (isOverdue) {
      overdue++;
    } else {
      notStarted++;
    }
  }

  const targeted = targetUids.length;
  return {
    targeted,
    completed,
    inProgress,
    notStarted,
    overdue,
    completionRate: targeted > 0 ? Math.round((completed / targeted) * 100) : 0,
    averageScore: completed > 0 ? Math.round(scoreSum / completed) : 0,
    validated
  };
}

/** Sum a set of per-assignment results into one roll-up (e.g. per subject/semester). */
export function sumAssignmentResults(results: AssignmentResult[]): AssignmentResult {
  const acc = results.reduce(
    (sum, r) => {
      sum.targeted += r.targeted;
      sum.completed += r.completed;
      sum.inProgress += r.inProgress;
      sum.notStarted += r.notStarted;
      sum.overdue += r.overdue;
      sum.validated += r.validated;
      // Weight each assignment's average by its completed count to recover the true mean.
      sum.scoreSum += r.averageScore * r.completed;
      return sum;
    },
    { targeted: 0, completed: 0, inProgress: 0, notStarted: 0, overdue: 0, validated: 0, scoreSum: 0 }
  );

  return {
    targeted: acc.targeted,
    completed: acc.completed,
    inProgress: acc.inProgress,
    notStarted: acc.notStarted,
    overdue: acc.overdue,
    validated: acc.validated,
    completionRate: acc.targeted > 0 ? Math.round((acc.completed / acc.targeted) * 100) : 0,
    averageScore: acc.completed > 0 ? Math.round(acc.scoreSum / acc.completed) : 0
  };
}
