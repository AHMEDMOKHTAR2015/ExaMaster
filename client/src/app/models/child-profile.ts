export interface ChildProfile {
  uid: string;
  parentId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  stageId: string;
  gradeId?: string;
  classId: string;
  registrationKeyId: string;
  createdAt: number;
  lastLoginAt?: number;
}
