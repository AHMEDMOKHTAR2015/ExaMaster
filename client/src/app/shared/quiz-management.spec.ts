import {
  indexQuizzesById,
  effectiveSubjectId,
  effectiveSemester,
  sumAssignmentResults,
  AssignmentResult
} from './quiz-management';
import { HomeworkAssignment } from '../models';
import { QuizInfo } from '../interfaces';

/**
 * Pure-function tests for the Quiz Management helpers that stay in the browser.
 * Filtering the assignments and working out each one's progress are the API's
 * now (`AssignmentFilters`, `AssignmentProgress` — tested there); what is left
 * is naming an assignment's subject and semester, and adding results up.
 */
describe('quiz-management helpers', () => {
  const quiz = (id: number, over: Partial<QuizInfo> = {}): QuizInfo => ({
    id, name: `Quiz ${id}`, description: '', config: {}, questionCount: 5, ...over
  });

  // q1 → Math/first, q2 → Arabic/second, q3 → untagged.
  const quizzes: QuizInfo[] = [
    quiz(1, { subjectId: 's-math', semester: 'first' }),
    quiz(2, { subjectId: 's-arabic', semester: 'second' }),
    quiz(3)
  ];
  const quizById = indexQuizzesById(quizzes);

  const assignment = (over: Partial<HomeworkAssignment> = {}): HomeworkAssignment => ({
    id: 'a', quizId: 1, title: 'Untitled', stageId: 'primary', classId: 'c1',
    dueAt: 0, createdBy: 't1', createdAt: 0, active: true, ...over
  });

  // ---- effective subject/semester (own value wins, else quiz fallback) -------

  it('reads subject/semester off the assignment when present', () => {
    const a = assignment({ quizId: 1, subjectId: 's-arabic', semester: 'second' });
    expect(effectiveSubjectId(a, quizById)).toBe('s-arabic');
    expect(effectiveSemester(a, quizById)).toBe('second');
  });

  it('falls back to the linked quiz when the assignment is untagged', () => {
    const a = assignment({ quizId: 1, subjectId: undefined, semester: undefined });
    expect(effectiveSubjectId(a, quizById)).toBe('s-math');
    expect(effectiveSemester(a, quizById)).toBe('first');
  });

  it('is undefined when neither assignment nor quiz carries the tag', () => {
    const a = assignment({ quizId: 3, subjectId: undefined, semester: undefined });
    expect(effectiveSubjectId(a, quizById)).toBeUndefined();
    expect(effectiveSemester(a, quizById)).toBeUndefined();
  });

  // ---- sumAssignmentResults --------------------------------------------------

  it('combines results with a completed-weighted average', () => {
    // A: 1 completed @ 90; B: 3 completed @ 50 → mean = (90 + 150) / 4 = 60.
    const result = (targeted: number, completed: number, averageScore: number): AssignmentResult => ({
      targeted, completed, inProgress: 0, notStarted: targeted - completed, overdue: 0,
      completionRate: Math.round((completed / targeted) * 100), averageScore, validated: 0
    });
    const total = sumAssignmentResults([result(1, 1, 90), result(3, 3, 50)]);
    expect(total.completed).toBe(4);
    expect(total.targeted).toBe(4);
    expect(total.averageScore).toBe(60);
    expect(total.completionRate).toBe(100);
  });
});
