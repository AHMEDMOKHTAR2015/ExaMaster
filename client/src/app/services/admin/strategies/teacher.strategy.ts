import { AdminRoleStrategy } from '../../../interfaces';

/**
 * Teachers get the shared admin dashboard (rendered as the teacher view) where
 * they see the students of their own classes and assign quizzes/homework to
 * them. They have no access to global user/quiz/key administration.
 */
export class TeacherStrategy implements AdminRoleStrategy {
  canAccessApplicationAdmin(): boolean {
    return false;
  }

  canAccessAdminDashboard(): boolean {
    return true;
  }

  canManageChildren(): boolean {
    return false;
  }

  canViewChildParticipations(): boolean {
    return false;
  }

  canManageAllUsers(): boolean {
    return false;
  }

  canViewGlobalParticipations(): boolean {
    return false;
  }

  canManageRegistrationKeys(): boolean {
    return false;
  }

  canManageQuizzes(): boolean {
    return false;
  }

  canManageTranslations(): boolean {
    return false;
  }

  canManageStagesAndClasses(): boolean {
    return false;
  }

  // Teachers manage homework, but only their own assignments (scoped in the UI
  // by createdBy and enforced by the Firestore rules).
  canManageHomework(): boolean {
    return true;
  }

  canAccessTeacherDashboard(): boolean {
    return true;
  }

  getRoleType(): 'userAdmin' | 'applicationAdmin' | 'teacher' | 'none' {
    return 'teacher';
  }
}
