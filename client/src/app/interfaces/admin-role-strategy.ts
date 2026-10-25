export interface AdminRoleStrategy {
  canAccessApplicationAdmin(): boolean;
  canAccessAdminDashboard(): boolean;

  // Dashboard-specific permissions
  canManageChildren(): boolean;
  canViewChildParticipations(): boolean;
  /**
   * May open My Children and a child's profile. Parents only: the pages read
   * `GET /me/children`, which the API serves to the Parent role alone — an
   * application admin can view participations school-wide but has no family.
   */
  canViewMyChildren(): boolean;
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

  /**
   * May open Teaching Materials (the list and the lesson reader). A teacher
   * sees the material they uploaded; an application admin sees every
   * teacher's. The API decides which rows each one gets.
   */
  canViewTeachingMaterials(): boolean;
  /**
   * May upload teaching material. Teachers only: a material belongs to a
   * subject on the uploader's roster record, which an admin does not have.
   */
  canUploadTeachingMaterials(): boolean;

  // Get the role type for UI display
  getRoleType(): 'userAdmin' | 'applicationAdmin' | 'teacher' | 'none';
}
