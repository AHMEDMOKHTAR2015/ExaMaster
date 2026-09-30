export type HomeworkSemester = 'first' | 'second' | 'full';

/**
 * Quiz and homework assignments share one pipeline; `kind` labels which one a
 * record is. Legacy records without it are homework.
 */
export type AssignmentKind = 'quiz' | 'homework';

/**
 * Where the linked quiz content comes from. `'bank'` (default/legacy) means
 * `quizId` points at the application-admin's shared `Quizes` node. `'custom'`
 * means the quiz was authored by the assigning teacher and lives at
 * `teacherQuizzes/{customQuizId}` — `quizId` is unused (`0`) in that case.
 */
export type AssignmentQuizSource = 'bank' | 'custom';

export interface HomeworkAssignment {
  id: string;
  quizId: number;
  title: string;
  stageId: string;
  gradeId?: string;
  classId: string;
  dueAt: number;
  createdBy: string;
  /**
   * Display name of whoever created the assignment, denormalized at write time.
   *
   * A student cannot join `createdBy` back to a name on their own: `users/{uid}`
   * is readable only by staff, the account owner and their parent, and `teachers`
   * documents are keyed by their own id rather than the creator's auth uid — so
   * there is no client-side path from the uid to a person. Absent on assignments
   * written before this field existed; the child view falls back to the teacher
   * who educates the assignment's subject in that child's class.
   */
  createdByName?: string;
  createdAt: number;
  active: boolean;
  semester?: HomeworkSemester;
  kind?: AssignmentKind;
  /** Subject this assignment belongs to (set by teacher-created assignments). */
  subjectId?: string;
  /** Defaults to `'bank'` for back-compat with assignments created before this field existed. */
  quizSource?: AssignmentQuizSource;
  /** Set when `quizSource === 'custom'`; id of the `teacherQuizzes` record. */
  customQuizId?: string;
  /**
   * When present and non-empty, the assignment targets only these child uids.
   * Absent/empty means the whole class receives it (legacy behavior).
   */
  assignedChildIds?: string[];
  /**
   * Composed question set for this homework, authored via the homework wizard.
   * The API does not store it: an assignment is sat and graded on its quiz's
   * own questions (as it always was — nothing ever read this but a count).
   */
  questionIds?: number[];
  /** The quiz's shape, read off the assignment: a student cannot read a teacher's quiz. */
  questionCount?: number;
  quizDurationSeconds?: number;
  oneTimeJoin?: boolean;
  /** For a student (or their parent): their latest attempt at it. */
  submission?: AssignmentSubmission | null;
}

export interface AssignmentSubmission {
  participationId: string;
  scorePercent: number;
  pendingReviewCount: number;
  validationStatus: 'approved' | 'rejected' | null;
  endedAt: number;
}
