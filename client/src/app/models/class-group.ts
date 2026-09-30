export interface ClassGroup {
  id: string;
  stageId: string;
  gradeId: string;
  name: string;
  teacherIds?: string[];
  subjectIds?: string[];
}
