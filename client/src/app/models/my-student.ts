/**
 * One of the signed-in teacher's students: a student of a group they teach.
 * `quizCount` / `homeworkCount` are the student's submissions in this teacher's
 * subjects (or to an assignment the teacher set), counted by the kind the
 * student sees — an assigned quiz is a quiz.
 */
export interface MyStudent {
  id: string;
  displayName: string;
  mobileNumber?: string;
  parentName?: string;
  stageName?: string;
  gradeName?: string;
  classId: string;
  className: string;
  quizCount: number;
  homeworkCount: number;
  lastSubmittedAt?: number;
}
