import { QuestionAdminItem } from '../interfaces';

/** The builder's current selections, as the question picker sees them. */
export interface BankFilter {
  stageId?: string;
  /**
   * The year the question targets. This is the only classification below stage
   * that questions actually carry — there is no `classId` on a bank question,
   * so a group can never narrow this pool directly.
   */
  gradeId?: string;
  subjectId?: string;
  semester?: string;
  /** Already lower-cased and trimmed by the caller. */
  search?: string;
}

/**
 * Whether one bank question survives the builder's filters.
 *
 * Extracted from the component so the rule is testable without standing up the
 * builder and its four injected services — the same reason
 * `shared/quiz-filters.ts` exists.
 *
 * The two unset-value rules are deliberately opposite, and that asymmetry is
 * the whole point:
 *
 * - **Semester** is permissive. A question with no semester is treated as
 *   belonging to any of them, because most banks are authored without one and
 *   excluding them would empty the picker for every teacher who sets a term.
 * - **Grade** is strict. A question with no grade is *not* "suitable for every
 *   year" — it is one nobody has classified yet. Folding those into a specific
 *   group's pool is how a question written for a different year quietly ends
 *   up in a quiz.
 */
export function matchesBankFilter(question: QuestionAdminItem, filter: BankFilter): boolean {
  const { stageId, gradeId, subjectId, semester, search } = filter;
  return (
    (!stageId || question.stageId === stageId) &&
    (!gradeId || question.gradeId === gradeId) &&
    (!subjectId || question.subjectId === subjectId) &&
    (!semester || !question.semester || String(question.semester) === String(semester)) &&
    (!search || question.name.toLowerCase().includes(search))
  );
}
