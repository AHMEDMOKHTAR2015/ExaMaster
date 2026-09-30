import { Teacher, ClassGroup, Subject, Stage, User, HomeworkAssignment } from '../models';
import { QuizInfo } from './quiz-info';

/** One class in the teacher's scope, with the subjects they teach there and its roster. */
export interface ScopedClass {
  cls: ClassGroup;
  stageId: string;
  subjects: Subject[];
  students: User[];
}

/**
 * Everything an authenticated teacher is allowed to see, already filtered to the
 * relationship between the teacher and the students they teach. This is the
 * structured "response" the dashboard renders — scannable, grouped by class.
 */
export interface TeacherScope {
  teacher: Teacher;
  stages: Stage[];
  /** Full reference lists, kept for name/colour lookups (not roster-scoped). */
  allClasses: ClassGroup[];
  allSubjects: Subject[];
  /** Scoped views: only what the teacher teaches. */
  classes: ClassGroup[];      // classes the teacher educates in
  subjects: Subject[];        // subjects the teacher teaches
  students: User[];           // children enrolled in those classes (the roster)
  quizzes: QuizInfo[];        // quizzes the teacher may assign (subject/stage scoped)
  assignments: HomeworkAssignment[];
  /** The roster grouped by class for display. */
  byClass: ScopedClass[];
}

/** Inputs for {@link TeacherScopeService.scopeQuizzes}; the optional fields narrow the result. */
export interface QuizScopeParams {
  teacher: Teacher | null;
  /** The teacher's classes (already scoped via {@link classesForTeacher}). */
  classes: ClassGroup[];
  quizzes: QuizInfo[];
  /** Narrow to a single subject (e.g. the one chosen in the assignment form). */
  subjectId?: string;
  /** Narrow to a single class's stage (e.g. the one chosen in the form). */
  classId?: string;
}
