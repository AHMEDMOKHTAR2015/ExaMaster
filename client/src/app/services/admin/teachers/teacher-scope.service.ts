import { Injectable, inject } from '@angular/core';
import {
  Teacher, ClassGroup, Subject, Stage, User
} from '../../../models';
import { classesForTeacher } from '../../../shared/teaching';
import { TeacherService } from './teacher.service';
import { ClassGroupService } from '../academic/class-group.service';
import { SubjectService } from '../academic/subject.service';
import { StageService } from '../academic/stage.service';
import { AppUserService } from '../users/app-user.service';
import { HomeworkService } from '../../homework.service';
import { QuizService } from '../../quiz.service';
import { QuizInfo, ScopedClass, TeacherScope, QuizScopeParams } from '../../../interfaces';

/**
 * Business-logic layer for teacher data scoping.
 *
 * Single source of truth for "what may this teacher see and do", expressed as
 * pure, unit-testable functions plus a batched loader. Components must go through
 * this service rather than re-deriving the relationship rules, so the filtering
 * lives in one place and can be enforced consistently (roster, quizzes, classes,
 * and the write-time guards).
 *
 * Relationship model (already in the data):
 *  - Teacher.subjectIds          → subjects the teacher educates.
 *  - ClassGroup.teacherIds       → classes the teacher is assigned to.
 *  - ClassGroup.subjectIds       → subjects studied in a class.
 *  - User(child).classId         → the class a student belongs to.
 *  - Quiz.subjectId / .stageId   → a quiz's subject and educational stage.
 *
 * A teacher "teaches" a class when they are assigned to it AND it studies one of
 * their subjects (see {@link classesForTeacher}). Their roster is every child in
 * those classes; their assignable quizzes are those tagged with their subjects
 * within their classes' stages.
 */
@Injectable({ providedIn: 'root' })
export class TeacherScopeService {
  private readonly teacherService = inject(TeacherService);
  private readonly classService = inject(ClassGroupService);
  private readonly subjectService = inject(SubjectService);
  private readonly stageService = inject(StageService);
  private readonly userService = inject(AppUserService);
  private readonly homeworkService = inject(HomeworkService);
  private readonly quizService = inject(QuizService);

  // ----------------------------------------------------------------------------
  // Orchestration (async, batched — avoids N+1)
  // ----------------------------------------------------------------------------

  /**
   * Resolve the /teachers record for an authenticated user: prefer the explicit
   * `teacherId` link written at provisioning time, fall back to matching by email.
   */
  async resolveTeacher(user: User): Promise<Teacher | null> {
    if (user.teacherId) {
      const linked = await this.teacherService.fetchTeacher(user.teacherId);
      if (linked) return linked;
    }
    const email = user.email?.toLowerCase();
    if (!email) return null;

    let cursor: string | undefined;
    do {
      const page = await this.teacherService.listTeachers(50, cursor);
      const match = page.items.find(t => t.email?.toLowerCase() === email);
      if (match) return match;
      cursor = page.nextCursor;
    } while (cursor);
    return null;
  }

  /**
   * Load everything a teacher may see, already scoped and grouped.
   *
   * Reference collections (classes, subjects, stages, quizzes) and the user list
   * are fetched concurrently in a single batch — no per-student round-trips. Roster
   * scores come from the denormalized `participationCount`/`participations` already
   * on each user record, so building the roster never triggers N+1 participation reads.
   */
  async loadScope(teacher: Teacher): Promise<TeacherScope> {
    const [allClasses, allSubjects, stages, allUsers, assignments] = await Promise.all([
      this.loadAllClasses(),
      this.loadAllSubjects(),
      this.loadAllStages(),
      this.loadAllUsers(),
      this.homeworkService.listByCreator(),
      this.ensureQuizzesLoaded() // populates quizService.quizList; result intentionally unused
    ]);

    const classes = classesForTeacher(teacher, allClasses);
    const subjects = TeacherScopeService.scopeSubjects(teacher, allSubjects);
    const students = TeacherScopeService.scopeStudents(classes, allUsers);
    const quizzes = TeacherScopeService.scopeQuizzes({ teacher, classes, quizzes: this.quizService.quizList() });
    const byClass = TeacherScopeService.groupByClass(teacher, classes, subjects, students);

    return {
      teacher, stages, allClasses, allSubjects,
      classes, subjects, students, quizzes, assignments, byClass
    };
  }

  private async ensureQuizzesLoaded(): Promise<void> {
    if (this.quizService.quizList().length === 0) {
      await this.quizService.loadAll();
    }
  }

  private async loadAllClasses(): Promise<ClassGroup[]> {
    return this.pageAll((cursor) => this.classService.listClasses(50, cursor));
  }
  private async loadAllSubjects(): Promise<Subject[]> {
    return this.pageAll((cursor) => this.subjectService.listSubjects(50, cursor));
  }
  private async loadAllStages(): Promise<Stage[]> {
    const result = await this.stageService.listStages(100);
    return result.items;
  }
  private async loadAllUsers(): Promise<User[]> {
    return this.pageAll((cursor) => this.userService.listUsers(100, cursor));
  }

  /** Drain a cursor-paginated endpoint into a single array. */
  private async pageAll<T>(
    fetchPage: (cursor?: string) => Promise<{ items: T[]; nextCursor?: string }>
  ): Promise<T[]> {
    const all: T[] = [];
    let cursor: string | undefined;
    do {
      const page = await fetchPage(cursor);
      all.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor);
    return all;
  }

  // ----------------------------------------------------------------------------
  // Pure scoping rules (synchronous, unit-testable — no I/O, no DI)
  // ----------------------------------------------------------------------------

  /** Subjects the teacher educates, resolved against the subject list. */
  static scopeSubjects(teacher: Teacher | null, allSubjects: Subject[]): Subject[] {
    const ids = new Set(teacher?.subjectIds ?? []);
    return allSubjects.filter(s => ids.has(s.id));
  }

  /** The roster: children enrolled in one of the teacher's classes. */
  static scopeStudents(teacherClasses: ClassGroup[], allUsers: User[]): User[] {
    const classIds = new Set(teacherClasses.map(c => c.id));
    if (classIds.size === 0) return [];
    return allUsers.filter(u =>
      u.accountType === 'child' && !!u.classId && classIds.has(u.classId)
    );
  }

  /**
   * Quizzes the teacher may assign: tagged with one of their subjects (or the
   * explicitly chosen subject) and, when the quiz declares a stage, a stage one of
   * their classes belongs to (or the chosen class's stage). Untagged quizzes are
   * only included when the teacher has no subject filter to apply.
   */
  static scopeQuizzes(params: QuizScopeParams): QuizInfo[] {
    const { teacher, classes, quizzes, subjectId, classId } = params;
    const teacherSubjectIds = new Set(teacher?.subjectIds ?? []);
    const selectedClass = classId ? classes.find(c => c.id === classId) : undefined;
    const allowedStages = selectedClass
      ? new Set([selectedClass.stageId])
      : new Set(classes.map(c => c.stageId));

    return quizzes.filter(quiz => {
      if (subjectId) {
        if (quiz.subjectId !== subjectId) return false;
      } else if (teacherSubjectIds.size > 0) {
        if (!quiz.subjectId || !teacherSubjectIds.has(quiz.subjectId)) return false;
      }
      if (quiz.stageId && allowedStages.size > 0 && !allowedStages.has(quiz.stageId)) {
        return false;
      }
      return true;
    });
  }

  /** Subjects the teacher teaches within a specific class (subject ∈ teacher ∩ class). */
  static subjectsTaughtIn(teacher: Teacher | null, cls: ClassGroup, subjects: Subject[]): Subject[] {
    const teacherSubjectIds = new Set(teacher?.subjectIds ?? []);
    const classSubjectIds = new Set(cls.subjectIds ?? []);
    return subjects.filter(s => teacherSubjectIds.has(s.id) && classSubjectIds.has(s.id));
  }

  /** Group a (already-scoped) roster by class for a scannable, contextual view. */
  static groupByClass(
    teacher: Teacher | null,
    teacherClasses: ClassGroup[],
    subjects: Subject[],
    students: User[]
  ): ScopedClass[] {
    return teacherClasses.map(cls => ({
      cls,
      stageId: cls.stageId,
      subjects: TeacherScopeService.subjectsTaughtIn(teacher, cls, subjects),
      students: students.filter(s => s.classId === cls.id)
    }));
  }

  // ----------------------------------------------------------------------------
  // Authorization guards (enforce the relationship at the action boundary)
  // ----------------------------------------------------------------------------

  /** Whether a class is one the teacher teaches (so may assign to / read). */
  static canAssignToClass(classId: string, teacherClasses: ClassGroup[]): boolean {
    return teacherClasses.some(c => c.id === classId);
  }

  /** Whether a student is in the teacher's roster (so their data may be read). */
  static canAccessStudent(student: User, teacherClasses: ClassGroup[]): boolean {
    return !!student.classId && teacherClasses.some(c => c.id === student.classId);
  }

  /** Throwing variant of {@link canAssignToClass} for use at write boundaries. */
  static assertCanAssignToClass(classId: string, teacherClasses: ClassGroup[]): void {
    if (!TeacherScopeService.canAssignToClass(classId, teacherClasses)) {
      throw new Error('You can only assign work to classes you teach.');
    }
  }
}
