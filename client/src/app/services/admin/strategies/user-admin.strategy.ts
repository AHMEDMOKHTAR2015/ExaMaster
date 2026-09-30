import { AdminRoleStrategy } from '../../../interfaces';

export class UserAdminStrategy implements AdminRoleStrategy {
  canAccessApplicationAdmin(): boolean {
    return false;
  }

  canAccessAdminDashboard(): boolean {
    return true;
  }

  // UserAdmin can manage their own children
  canManageChildren(): boolean {
    return true;
  }

  canViewChildParticipations(): boolean {
    return true;
  }

  // UserAdmin cannot access global user management
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

  canManageHomework(): boolean {
    return false;
  }

  canAccessTeacherDashboard(): boolean {
    return false;
  }

  getRoleType(): 'userAdmin' | 'applicationAdmin' | 'teacher' | 'none' {
    return 'userAdmin';
  }
}
