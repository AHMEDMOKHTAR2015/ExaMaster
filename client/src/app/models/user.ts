/**
 * The signed-in person (and every account an admin screen lists), as the API
 * describes them — see `api/current-user.mapper.ts`.
 */
import { AdminRole } from './admin-role';
import { ParticipationRecord } from './participation';

export interface User {
  /**
   * The person's id in the QuizMasterPro API — what every reference to a person
   * uses (parentId, a class's students, a submission's child).
   */
  id?: string;
  /** The same API id, under the name most of the app already keys people by. */
  uid: string;
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  mobileNumber?: string;
  photoURL?: string;
  providerId: AuthProvider;
  accountType?: 'parent' | 'child';
  /**
   * The organization this account belongs to — the `tenants/{tenantId}` whose
   * subtree holds every record the user may touch. Optional only until the
   * backfill completes; `platformAdmin` accounts never carry one.
   *
   * As privileged as `roles`: only the server sets it, so a user cannot move
   * themselves into another organization.
   */
  tenantId?: string;
  roles?: AdminRole[];
  /** Links a user account with the 'teacher' role to its /teachers record. */
  teacherId?: string;
  parentId?: string;
  childIds?: string[];
  /** How many children link to this account (users lists only). */
  childCount?: number;
  stageId?: string;
  gradeId?: string;
  classId?: string;
  registrationKeyId?: string;
  active?: boolean;
  createdAt: Date;
  /** When they last used the app (a sign-in or session renewal); absent if they never have. */
  lastLoginAt?: Date;
  completedQuizzes: CompletedQuiz[];
  participations?: ParticipationRecord[];
  participationCount?: number;
}

/**
 * Completed quiz record for user history
 */
export interface CompletedQuiz {
  quizId: number;
  quizName: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  completedAt: Date;
  timeTaken: number; // in seconds
}

/**
 * Auth provider enum for tracking login method
 */
export type AuthProvider = 'google' | 'facebook' | 'email';

/**
 * User profile display data (computed from User)
 */
export interface UserProfile {
  initials: string;
  fullName: string;
  email: string;
  photoURL?: string;
  memberSince: string;
}

/**
 * Auth state for UI rendering
 */
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  error: string | null;
}

/**
 * An account being created (the fields a profile starts with).
 */
export interface CreateUserPayload {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  providerId: AuthProvider;
}
