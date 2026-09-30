import { QuestionSemester } from '../services/admin/quizzes/quiz-admin.service';
import { QuizConfig } from '../models/quiz-config';

/** Summary shape for a quiz — powers quiz browsing/list UI without loading its questions. */
export interface QuizInfo {
  id: number;
  name: string;
  description: string;
  config: Partial<QuizConfig>;
  questionCount: number;
  stageId?: string;
  classId?: string;
  subjectId?: string;
  semester?: QuestionSemester;
  /** Teacher (API user id) who reviews attempts at this quiz — see `QuizAdminItem.reviewerId`. */
  reviewerId?: string;
  reviewerName?: string;
  /** For a student: whether they have submitted it before (from the API). */
  completedByMe?: boolean;
}
