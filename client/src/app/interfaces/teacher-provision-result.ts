export interface TeacherProvisionResult {
  status: 'created' | 'linked' | 'skipped-no-email' | 'exists-unmanaged';
  uid?: string;
  message: string;
}
