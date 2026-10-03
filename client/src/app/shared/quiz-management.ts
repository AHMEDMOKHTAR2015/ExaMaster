import { HomeworkAssignment, AssignmentKind, HomeworkSemester } from '../models';
import { QuizInfo } from '../interfaces';

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

/**
 * Quiz Management's filter bar; an empty/`'all'` field is "no constraint". The API
 * applies it to the assignments, their results and the review queue (`assignmentFilterParams`).
 */
/** Quiz Management's filter bar; the API applies it to the assignments, their results and the review queue. */
export interface AssignmentFilter {
  subjectId?: string;
  semester?: SemesterFilter;
  classId?: string;
  kind?: KindFilter;
  search?: string;
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
  /** Mean score percent over the students who submitted, 0–100 (0 when none did); the API's `AssignmentProgress`. */
  averageScore: number;
  /** Completed submissions that carry a teacher validation. */
  validated: number;
}

/**
 * One assignment's progress as the API works it out (`GET /assignments/results`),
 * with the subject and semester it counts under — its own, else its quiz's.
 */
export interface AssignmentResultRow {
  assignmentId: string;
  subjectId?: string;
  semester?: HomeworkSemester;
  result: AssignmentResult;
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
