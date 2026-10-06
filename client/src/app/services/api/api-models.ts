/**
 * The QuizMasterPro.Backend API's response shapes, as it serializes them
 * (camelCase properties, enums as their names). Kept apart from `models/`:
 * those are the app's own types, and each API service maps into them so the
 * components do not change while the data source does.
 */

export type ApiRole = 'PLATFORM_ADMIN' | 'APPLICATION_ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';

export type ApiRegistrationKeyProblem = 'Missing' | 'Inactive' | 'Expired';

export interface ApiUser {
  id: number;
  signInUid: string;                                   // which sign-in is theirs; the app refers to a person by id
  email: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  mobileNumber: string | null;
  photoUrl: string | null;
  roles: ApiRole[];
  isActive: boolean;
  parentId: number | null;
  teacherId: number | null;
  stageId: number | null;
  gradeId: number | null;
  classId: number | null;
  registrationKeyId: number | null;
  createdOn: string;
  lastActiveOn: string | null;                         // latest sign-in or session renewal; null until they first sign in
  childCount?: number | null;                          // GET /users only
  participationCount?: number | null;                  // GET /users only
}

export interface ApiTenant {
  id: number;
  slug: string;
  name: string;
  isActive: boolean;
  plan: 'Trial' | 'Standard' | 'Enterprise';
  logoUrl: string | null;
  primaryColor: string | null;
  createdOn: string;
}

export interface ApiRegistrationKey {
  id: number;
  code: string;
  role: ApiRole;
  isActive: boolean;
  expiresOn: string | null;
  status: 'Active' | 'Inactive' | 'Expired' | 'Used';
  parentId: number | null;
  claimedOn: string | null;
  maxChildren: number | null;
  childCount: number;
  createdOn: string;
}

/** A page of a server-paged list (GET /users, /registration-keys). */
/** /platform/access-requests */
export interface ApiAccessRequest {
  id: number;
  kind: 'Parent' | 'Child';
  firstName: string;
  lastName: string;
  mobileNumber: string;
  contactEmail: string | null;
  schoolName: string;                                    // '' on a request stored before it was required
  gradeName: string | null;
  parentName: string | null;
  parentMobileNumber: string | null;
  note: string | null;
  status: 'Pending' | 'Approved' | 'Rejected';
  createdOn: string;
  decidedOn: string | null;
  rejectionReason: string | null;
  approvedTenantId: number | null;
  approvedTenantName: string | null;
  approvedUserId: number | null;
}

/** /platform/tenants/{id}/classes */
export interface ApiTenantClassOption { id: number; name: string; gradeId: number; gradeName: string; stageId: number; stageName: string; }

/** /platform/tenants/{id}/parents */
export interface ApiTenantParentOption {
  id: number;
  displayName: string;
  mobileNumber: string | null;
  childCount: number;
  maxChildren: number | null;
  hasUsableKey: boolean;
}

export interface ApiPage<T> { items: T[]; page: number; pageSize: number; totalCount: number; }

/** GET /me */
export interface ApiCurrentUser {
  user: ApiUser;
  tenant: ApiTenant | null;                              // none for a platform administrator
  registrationKey: ApiRegistrationKey | null;
  registrationKeyProblem: ApiRegistrationKeyProblem | null;
}

/** Ids are integers in the API and strings in the app's models (they were Firestore document ids). */
export const idString = (id: number | null | undefined): string | undefined => (id == null ? undefined : String(id));

// ---- school structure (GET /stages, /grades, /classes, /subjects, /teachers) ----

export interface ApiStage { id: number; name: string; order: number; }
export interface ApiGrade { id: number; stageId: number; name: string; order: number; }
export interface ApiClassGroup { id: number; stageId: number; gradeId: number; name: string; teacherIds: number[]; subjectIds: number[]; }
export interface ApiSubjectTag { id: number; name: string; }
export interface ApiSubject { id: number; name: string; color: string | null; tags: ApiSubjectTag[]; }
export interface ApiTeacher { id: number; firstName: string; lastName: string; email: string | null; photoUrl: string | null; subjectIds: number[]; }

/** What a create returns. */
export interface ApiId { id: number; }

/**
 * The app's string ids back to the API's integers. An id that is not a whole
 * number (a Firestore id on a screen not yet moved) cannot name an API record,
 * so it is dropped rather than sent as NaN.
 */
export const idNumbers = (ids: readonly string[] | undefined): number[] =>
  (ids ?? []).map(Number).filter(id => Number.isInteger(id) && id > 0);

export const idNumber = (id: string | undefined): number | null => {
  const value = Number(id);
  return Number.isInteger(value) && value > 0 ? value : null;
};

// ---- questions and quizzes ----

export type ApiQuestionType = 'Choose' | 'Complete' | 'RightWrong' | 'Explain';
export type ApiSemester = 'First' | 'Second' | 'Full';

export interface ApiSegment { kind: 'Text' | 'Blank'; text?: string | null; index?: number | null; expectedLength?: number | null; }
export interface ApiAnswerKey { questionId: number; correctOptionId: number | null; correctBlanks: string[] | null; referenceAnswer: string | null; }

/** A bank question as its author sees it (GET /questions, /questions/{id}). */
export interface ApiQuestion {
  id: number; type: ApiQuestionType; name: string; text: string | null;
  options: { id: number; name: string }[]; segments: ApiSegment[];
  subjectHtml: string | null; weightPercent: number | null; durationSeconds: number | null;
  key: ApiAnswerKey;
  subjectId: number | null; stageId: number | null; gradeId: number | null; semester: ApiSemester | null;
  tagIds: number[];                                      // tags of its subject
}

/** What authoring sends: the question as typed (the server parses and validates it). */
export interface ApiQuestionDraft {
  type: ApiQuestionType; text: string | null; options: string[] | null; correctOption: number | null; isRight: boolean | null;
  subjectHtml: string | null; referenceAnswer: string | null; weightPercent: number | null; durationSeconds: number | null;
}

export interface ApiQuizSettings {
  allowBack: boolean; allowReview: boolean; autoMove: boolean; durationSeconds: number; pageSize: number; requiredAll: boolean;
  richText: boolean; shuffleQuestions: boolean; shuffleOptions: boolean; showClock: boolean; showPager: boolean; oneTimeJoin: boolean;
  imagePath: string | null;
}

export interface ApiBankQuiz {
  id: number; name: string; description: string; settings: ApiQuizSettings;
  subjectId: number | null; stageId: number | null; gradeId: number | null; classId: number | null; semester: ApiSemester | null;
  reviewerId: number | null; questionIds: number[]; createdOn: string;
}
export interface ApiBankQuizSummary extends Omit<ApiBankQuiz, 'questionIds' | 'createdOn'> { questionCount: number; completedByMe: boolean; }

export interface ApiTeacherQuizQuestion {
  number: number; type: ApiQuestionType; name: string; text: string | null;
  options: { id: number; name: string }[]; segments: ApiSegment[];
  subjectHtml: string | null; weightPercent: number | null; durationSeconds: number | null; key: ApiAnswerKey;
  tagIds: number[];                                      // tags of the quiz's subject
}
export interface ApiTeacherQuiz {
  id: number; name: string; description: string; settings: ApiQuizSettings; subjectId: number; stageId: number | null;
  semester: ApiSemester | null; createdById: number; createdOn: string; questions: ApiTeacherQuizQuestion[];
}
export interface ApiTeacherQuizSummary {
  id: number; name: string; description: string; subjectId: number; stageId: number | null; semester: ApiSemester | null;
  createdById: number; questionCount: number; createdOn: string;
}

// ---- sitting a quiz ----

/** What a student receives to sit a quiz: no member an answer could be carried in. */
export interface ApiSitting {
  bankQuizId: number | null; teacherQuizId: number | null; homeworkId: number | null; name: string;
  settings: ApiQuizSettings; questions: ApiSittingQuestion[];
}
export interface ApiSittingQuestion {
  questionId: number; type: ApiQuestionType; name: string; options: { id: number; name: string }[]; segments: ApiSegment[];
  subjectHtml: string | null; weightPercent: number | null; durationSeconds: number;
}

/** Exactly one of the three ids: the assignment (whose quiz is then authoritative), or a quiz practised on its own. */
export interface ApiAttemptTarget { homeworkId: number | null; bankQuizId: number | null; teacherQuizId: number | null; }

export interface ApiSubmissionResult {
  participationId: number; score: number; scorePercent: number; correctCount: number; wrongCount: number; pendingReviewCount: number;
  key: ApiAnswerKey[];                                  // empty while results are withheld
  resultsAvailable: boolean; resultsAvailableAt: string | null;
}

export type ApiAttemptLockStatus = 'InProgress' | 'Locked' | 'Released';
export type ApiAttemptExitReason = 'Closed' | 'Hidden' | 'Navigated' | 'FullscreenExit';
export interface ApiAttemptLock {
  id: number; childId: number; childName: string | null; scopeKey: string;
  bankQuizId: number | null; teacherQuizId: number | null; homeworkId: number | null; quizName: string; classId: number | null;
  status: ApiAttemptLockStatus; isBlocking: boolean; startedOn: string; lockedOn: string | null; exitAttempts: number;
  lastExitReason: ApiAttemptExitReason | null; releasedOn: string | null; releasedById: number | null;
}

// ---- assignments and attempts ----

export type ApiAssignmentKind = 'Homework' | 'Quiz';
export type ApiQuizSource = 'Bank' | 'Custom';
export type ApiValidationStatus = 'Approved' | 'Rejected';

export interface ApiAssignment {
  id: number; title: string; kind: ApiAssignmentKind; source: ApiQuizSource; bankQuizId: number | null; teacherQuizId: number | null;
  quizName: string; questionCount: number; durationSeconds: number; oneTimeJoin: boolean;
  stageId: number; gradeId: number | null; classId: number; subjectId: number | null; semester: ApiSemester | null;
  dueAt: string; isActive: boolean; assignedChildIds: number[]; createdById: number; createdByName: string | null; createdOn: string;
  submission: { participationId: number; scorePercent: number; pendingReviewCount: number; validationStatus: ApiValidationStatus | null; endedOn: string } | null;
}

/** A submitted attempt, as a list shows it (GET /participations). */
export interface ApiParticipationSummary {
  id: number; type: 'Quiz' | 'Homework'; bankQuizId: number | null; teacherQuizId: number | null; quizName: string;
  homeworkId: number | null; homeworkTitle: string | null; childId: number; childName: string | null; reviewerId: number | null;
  classId: number | null; score: number; scorePercent: number; correctCount: number; wrongCount: number; pendingReviewCount: number;
  startedOn: string; endedOn: string; validationStatus: ApiValidationStatus | null;
  /** The answered assignment's kind; null when it answers none (a bank quiz). GET /participations only. */
  assignmentKind?: ApiAssignmentKind | null;
}

/** One assignment's progress (GET /assignments/results); subject and semester are its own, else its quiz's. */
export interface ApiAssignmentResult {
  assignmentId: number; subjectId: number | null; semester: ApiSemester | null;
  targeted: number; completed: number; notStarted: number; overdue: number; validated: number;
  completionRate: number; averageScore: number;
}

/** One of a teacher's students (GET /me/students): the account, plus the counts of their work in that teacher's subjects. */
export interface ApiMyStudent {
  student: ApiUser; parentName: string | null; stageName: string | null; gradeName: string | null; className: string;
  quizCount: number; homeworkCount: number; lastSubmittedOn: string | null;
}

/** A student's standing in one subject over the past year (GET /me/subject-performance). */
export interface ApiSubjectPerformance {
  subjectId: number; subjectName: string; subjectColor: string | null;
  quizCount: number; homeworkCount: number; awaitingReviewCount: number;
  pointsEarned: number; pointsPossible: number;
  scorePercent: number | null; earlierPercent: number | null; recentPercent: number | null;
  level: 'Excellent' | 'Good' | 'Fair' | 'Weak' | null;
}

/** One attempt in full (GET /participations/{id}): what was answered, and the teacher's verdict. */
export interface ApiParticipation extends Omit<ApiParticipationSummary, 'childName' | 'validationStatus'> {
  parentId: number | null; stageId: number | null; gradeId: number | null;
  validation: { status: ApiValidationStatus; feedback: string | null; validatedById: number; validatedOn: string } | null;
  resultsAvailable: boolean;
  answers: ApiParticipationAnswer[];
}
export interface ApiParticipationAnswer {
  questionId: number; questionName: string; selectedOptionId: number | null; selectedOptionText: string | null;
  correctOptionId: number | null; correctOptionText: string | null; isCorrect: boolean;
  blanks: { index: number; userAnswer: string | null; correctAnswer: string; isCorrect: boolean }[] | null;
  responseText: string | null; referenceAnswer: string | null; weightPercent: number; earnedPercent: number | null;
  requiresReview: boolean; suggestedAward: number | null;
  manualGrade: { awardedPercent: number; comment: string | null; gradedById: number; gradedOn: string } | null;
}
