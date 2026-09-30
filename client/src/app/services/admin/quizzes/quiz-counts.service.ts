import { Injectable, inject } from '@angular/core';
import { StoredQuizCounts, countQuizzes } from '../../../shared/quiz-breakdown';
import { StageService } from '../academic/stage.service';
import { GradeService } from '../academic/grade.service';
import { ClassGroupService } from '../academic/class-group.service';
import { QuizAdminService } from './quiz-admin.service';
import { TeacherQuizService } from '../../teacher-quiz.service';
import { HomeworkService } from '../../homework.service';

/**
 * The application admin's "Quizzes by Grade & Group" breakdown.
 *
 * Built on request from the lists the API returns whole — the school
 * structure, the bank, teachers' quizzes and every assignment — by the same
 * rules the Firebase trigger used ({@link countQuizzes}). There is no stored
 * aggregate any more, so nothing can drift and nothing needs rebuilding.
 */
@Injectable({ providedIn: 'root' })
export class QuizCountsService {
  private readonly stages = inject(StageService);
  private readonly grades = inject(GradeService);
  private readonly classes = inject(ClassGroupService);
  private readonly bank = inject(QuizAdminService);
  private readonly teacherQuizzes = inject(TeacherQuizService);
  private readonly homework = inject(HomeworkService);

  async getBreakdown(): Promise<StoredQuizCounts> {
    const [stages, grades, classes, bankQuizzes, teacherQuizzes, assignments] = await Promise.all([
      this.stages.listStages(),
      this.grades.listGrades(),
      this.classes.listClasses(),
      this.bank.listQuizzes(),
      this.teacherQuizzes.listAll(),
      this.homework.listAll()
    ]);
    return countQuizzes({
      stages: stages.items,
      grades: grades.items,
      classes: classes.items,
      bankQuizzes: bankQuizzes.items,
      teacherQuizzes: teacherQuizzes.items,
      assignments: assignments.items
    });
  }
}
