/**
 * Containment state for a "One Time Join" attempt.
 *
 *  - `in-progress` — the student confirmed the warning and opened the quiz.
 *    Already blocking: a second entry is refused while one is open, which is
 *    what makes a force-quit (killed tab, pulled network, closed laptop) fail
 *    safe. Nothing has to be written on the way out for re-entry to be denied.
 *  - `locked`      — the client observed them leaving and said so. Same
 *    blocking effect; it exists to tell the teacher *that* they left and how
 *    often, which `in-progress` alone cannot distinguish from "still sitting
 *    the quiz".
 *  - `released`    — the attempt finished (by the server, on submission)
 *    or a teacher cleared it. The only status a student may never write.
 */
export type QuizLockStatus = 'in-progress' | 'locked' | 'released';

/**
 * Why the containment layer believes the student left.
 *
 * `fullscreen-exit` is the weakest of the four — the page is still open and
 * still visible. It is treated as leaving because on a desktop browser it is
 * the *necessary first step* to reach another tab: the tab strip does not exist
 * until fullscreen ends. Nothing can block a tab switch, so the act of
 * uncovering the tabs is what gets caught instead.
 */
export type QuizExitReason = 'closed' | 'hidden' | 'navigated' | 'fullscreen-exit';

/**
 * One student's lock on one piece of work (`/attempt-locks`). The piece of work
 * is named by `scopeKey`, built the same way on both sides (see
 * `shared/quiz-attempt-scope.ts`), which is how the quiz list matches a lock to
 * its card.
 */
export interface QuizAttemptLock {
  /** `${childId}__${scopeKey}` — mirrors the document id. */
  id: string;
  childId: string;
  /** Denormalized so the teacher's list needs no join back to `users`. */
  childName?: string | null;
  /** `homework:{id}` | `teacher:{id}` | `bank:{numericId}`. */
  scopeKey: string;
  quizId: number;
  quizName?: string | null;
  homeworkId?: string | null;
  /**
   * Author of the assignment this attempt answers — who may be looking for it.
   * Null for a standalone practice quiz, which has no assigning teacher.
   */
  teacherId?: string | null;
  classId?: string | null;
  status: QuizLockStatus;
  startedAt: number;
  lockedAt?: number | null;
  /**
   * How many times the student was seen leaving. Counts every observed exit,
   * not just the first, so a teacher can tell one dropped connection from
   * repeated attempts to get back out.
   */
  exitAttempts: number;
  lastExitReason?: QuizExitReason | null;
  releasedAt?: number | null;
  /** uid of the teacher who unlocked, or `'system'` when the submission released it. */
  releasedBy?: string | null;
  releasedByName?: string | null;
}
