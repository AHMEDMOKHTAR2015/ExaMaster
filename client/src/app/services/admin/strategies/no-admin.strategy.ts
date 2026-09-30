import { AdminRoleStrategy } from '../../../interfaces';

export class NoAdminStrategy implements AdminRoleStrategy {
  canAccessApplicationAdmin(): boolean {
    return false;
  }

  canAccessAdminDashboard(): boolean {
    return false;
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

  canManageHomework(): boolean {
    return false;
  }

  canAccessTeacherDashboard(): boolean {
    return false;
  }

  getRoleType(): 'userAdmin' | 'applicationAdmin' | 'teacher' | 'none' {
    return 'none';
  }
}
