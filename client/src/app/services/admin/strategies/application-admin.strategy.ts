import { AdminRoleStrategy } from '../../../interfaces';

export class ApplicationAdminStrategy implements AdminRoleStrategy {
  canAccessApplicationAdmin(): boolean {
    return true;
  }

  canAccessAdminDashboard(): boolean {
    return true;
  }

  // Full access to child management (inherited from userAdmin capabilities)
  canManageChildren(): boolean {
    return true;
  }

  canViewChildParticipations(): boolean {
    return true;
  }

  // Application admin specific capabilities
  canManageAllUsers(): boolean {
    return true;
  }

  canViewGlobalParticipations(): boolean {
    return true;
  }

  canManageRegistrationKeys(): boolean {
    return true;
  }

  canManageQuizzes(): boolean {
    return true;
  }

  canManageTranslations(): boolean {
    return true;
  }

  canManageStagesAndClasses(): boolean {
    return true;
  }

  canManageHomework(): boolean {
    return true;
  }

  canAccessTeacherDashboard(): boolean {
    return false;
  }

  getRoleType(): 'userAdmin' | 'applicationAdmin' | 'teacher' | 'none' {
    return 'applicationAdmin';
  }
}
