import { ClassGroup, Subject, Teacher, User } from '../models';

/**
 * Pure helpers that resolve the Teacher ↔ Subject ↔ Child relationships.
 *
 * The data model is:
 *  - A Teacher owns the subjects they can educate (`Teacher.subjectIds`).
 *  - A ClassGroup lists the subjects studied there (`ClassGroup.subjectIds`)
 *    and the teachers assigned to it (`ClassGroup.teacherIds`).
 *  - A child belongs to one class (`classId`).
 *
 * So the teacher for a subject a child studies is the teacher who is both
 * assigned to the child's class AND educates that subject. These rules live
 * here so the admin, parent, and child views all resolve them identically.
 */

/** A subject taught in a class, paired with the teachers who educate it there. */
export interface SubjectTeaching {
  subjectId: string;
  /** Teachers assigned to the class whose subjectIds include this subject. */
  teacherIds: string[];
}

/**
 * For a class, map each subject it studies to the teacher(s) responsible —
 * i.e. teachers assigned to the class who also educate that subject.
 */
export function resolveSubjectTeaching(cls: ClassGroup | null | undefined, teachers: Teacher[]): SubjectTeaching[] {
  if (!cls?.subjectIds?.length) return [];
  const classTeacherIds = new Set(cls.teacherIds ?? []);
  const classTeachers = teachers.filter(t => classTeacherIds.has(t.id));
  return cls.subjectIds.map(subjectId => ({
    subjectId,
    teacherIds: classTeachers
      .filter(t => (t.subjectIds ?? []).includes(subjectId))
      .map(t => t.id)
  }));
}

/**
 * The classes a teacher actually educates in: classes they're assigned to that
 * also study at least one of the teacher's subjects.
 */
export function classesForTeacher(teacher: Teacher, classes: ClassGroup[]): ClassGroup[] {
  const subjects = new Set(teacher.subjectIds ?? []);
  return classes.filter(c =>
    (c.teacherIds ?? []).includes(teacher.id) &&
    (c.subjectIds ?? []).some(s => subjects.has(s))
  );
}

/**
 * The children a teacher educates: children whose class is one the teacher
 * educates in (see {@link classesForTeacher}).
 */
export function studentsForTeacher(teacher: Teacher, classes: ClassGroup[], children: User[]): User[] {
  const classIds = new Set(classesForTeacher(teacher, classes).map(c => c.id));
  return children.filter(ch => ch.classId && classIds.has(ch.classId));
}

/** Resolve a subject's display name from a lookup list, falling back to its id. */
export function subjectName(subjectId: string, subjects: Subject[]): string {
  return subjects.find(s => s.id === subjectId)?.name ?? subjectId;
}

/** Resolve a teacher's full name from a lookup list, falling back to its id. */
export function teacherName(teacherId: string, teachers: Teacher[]): string {
  const t = teachers.find(t => t.id === teacherId);
  return t ? `${t.firstName} ${t.lastName}`.trim() : teacherId;
}
