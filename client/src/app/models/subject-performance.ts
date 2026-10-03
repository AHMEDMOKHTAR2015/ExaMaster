/** How strong a student is in a subject, from their average score (the API draws the bands: 85 / 70 / 50). */
export type SubjectLevel = 'excellent' | 'good' | 'fair' | 'weak';

/**
 * A student's standing in one subject over the past 12 months, from their graded quizzes and homework.
 * `scorePercent` and `level` are absent while every submission in the subject still waits for a teacher's mark.
 */
export interface SubjectPerformance {
  subjectId: string;
  subjectName: string;
  subjectColor?: string;
  quizCount: number;
  homeworkCount: number;
  awaitingReviewCount: number;
  scorePercent?: number;
  level?: SubjectLevel;
  /** Recent half-year average minus the half-year before it; absent unless both halves have graded work. */
  trendPoints?: number;
}
