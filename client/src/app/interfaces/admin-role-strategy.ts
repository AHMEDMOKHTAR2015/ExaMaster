export interface AdminRoleStrategy {
  canAccessApplicationAdmin(): boolean;
  canAccessAdminDashboard(): boolean;

  // Dashboard-specific permissions
  canManageChildren(): boolean;
  canViewChildParticipations(): boolean;
  canManageAllUsers(): boolean;
  canViewGlobalParticipations(): boolean;
  canManageRegistrationKeys(): boolean;
  canManageQuizzes(): boolean;
  /**
   * May customise this school's UI labels. Application admins only — the
   * overrides are per-school, so this is a school-level setting, not a
   * platform one.
   */
  canManageTranslations(): boolean;
  canManageStagesAndClasses(): boolean;
  canManageHomework(): boolean;

  // Teacher-specific: view own students' rosters/participation and assign work to them
  canAccessTeacherDashboard(): boolean;

  // Get the role type for UI display
  getRoleType(): 'userAdmin' | 'applicationAdmin' | 'teacher' | 'none';
}
