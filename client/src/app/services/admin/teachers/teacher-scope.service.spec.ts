import { TeacherScopeService } from './teacher-scope.service';
import { ClassGroup, Subject, Teacher, User } from '../../../models';
import { QuizInfo } from '../../../interfaces';

/**
 * Pure-function tests for the teacher scoping rules. No TestBed/DI needed — the
 * relationship logic is static and deterministic, which is the whole point of
 * moving it into the business-logic layer.
 */
describe('TeacherScopeService scoping rules', () => {
  // ---- Fixtures: a teacher of Math (s-math) assigned to class c1 (Primary). ----
  const teacher: Teacher = {
    id: 't1', firstName: 'Ada', lastName: 'L', email: 'ada@x.com',
    subjectIds: ['s-math']
  };

  const subjects: Subject[] = [
    { id: 's-math', name: 'Math' },
    { id: 's-arabic', name: 'Arabic' }
  ];

  const classes: ClassGroup[] = [
    // c1: teacher assigned + studies Math → in scope
    { id: 'c1', stageId: 'primary', gradeId: 'g1', name: 'Class 1-A', teacherIds: ['t1'], subjectIds: ['s-math'] },
    // c2: teacher assigned but studies only Arabic → NOT taught by this teacher
    { id: 'c2', stageId: 'primary', gradeId: 'g1', name: 'Class 1-B', teacherIds: ['t1'], subjectIds: ['s-arabic'] },
    // c3: Math class but teacher not assigned → out of scope
    { id: 'c3', stageId: 'prep', gradeId: 'g2', name: 'Class 2-A', teacherIds: ['t9'], subjectIds: ['s-math'] }
  ];

  const child = (uid: string, classId?: string): User => ({
    uid, email: `${uid}@x.com`, displayName: uid, providerId: 'email',
    accountType: 'child', classId, createdAt: new Date(), lastLoginAt: new Date(),
    completedQuizzes: []
  });

  // The roster as the API returns it (GET /me/students): only this teacher's students, so no
  // scoping rule runs in the browser any more — the server's is tested in the API's suites.
  const roster: User[] = [child('stu1', 'c1'), child('stu2', 'c1')];

  const myClasses = classes.filter(c => c.id === 'c1'); // = classesForTeacher(teacher, classes)

  describe('scopeSubjects / subjectsTaughtIn', () => {
    it('resolves only the teacher’s subjects', () => {
      expect(TeacherScopeService.scopeSubjects(teacher, subjects).map(s => s.id)).toEqual(['s-math']);
    });

    it('intersects teacher subjects with the class subjects', () => {
      const taught = TeacherScopeService.subjectsTaughtIn(teacher, classes[0], subjects);
      expect(taught.map(s => s.id)).toEqual(['s-math']);
      // c2 studies Arabic which the teacher does not teach → none
      expect(TeacherScopeService.subjectsTaughtIn(teacher, classes[1], subjects)).toEqual([]);
    });
  });

  describe('scopeQuizzes', () => {
    const quizzes: QuizInfo[] = [
      { id: 1, name: 'Math P', description: '', config: {}, questionCount: 5, subjectId: 's-math', stageId: 'primary' },
      { id: 2, name: 'Math Prep', description: '', config: {}, questionCount: 5, subjectId: 's-math', stageId: 'prep' },
      { id: 3, name: 'Arabic P', description: '', config: {}, questionCount: 5, subjectId: 's-arabic', stageId: 'primary' },
      { id: 4, name: 'Untagged', description: '', config: {}, questionCount: 5 }
    ];

    it('keeps quizzes tagged with the teacher’s subjects and class stages', () => {
      const result = TeacherScopeService.scopeQuizzes({ teacher, classes: myClasses, quizzes });
      // q1 (Math/primary) only: q2 wrong stage, q3 wrong subject, q4 untagged excluded
      expect(result.map(q => q.id)).toEqual([1]);
    });

    it('narrows to an explicitly chosen subject', () => {
      const result = TeacherScopeService.scopeQuizzes({
        teacher, classes: myClasses, quizzes, subjectId: 's-arabic'
      });
      // q3 matches the chosen subject and primary stage
      expect(result.map(q => q.id)).toEqual([3]);
    });

    it('includes untagged quizzes only when the teacher has no subjects', () => {
      const noSubjectTeacher: Teacher = { ...teacher, subjectIds: [] };
      const result = TeacherScopeService.scopeQuizzes({ teacher: noSubjectTeacher, classes: myClasses, quizzes });
      expect(result.map(q => q.id)).toEqual([1, 3, 4]); // all primary-stage or untagged
    });
  });

  describe('authorization guards', () => {
    it('canAssignToClass only allows the teacher’s classes', () => {
      expect(TeacherScopeService.canAssignToClass('c1', myClasses)).toBe(true);
      expect(TeacherScopeService.canAssignToClass('c3', myClasses)).toBe(false);
    });

    it('canAccessStudent only allows roster members', () => {
      expect(TeacherScopeService.canAccessStudent(child('x', 'c1'), myClasses)).toBe(true);
      expect(TeacherScopeService.canAccessStudent(child('x', 'c3'), myClasses)).toBe(false);
      expect(TeacherScopeService.canAccessStudent(child('x', undefined), myClasses)).toBe(false);
    });

    it('assertCanAssignToClass throws for a foreign class', () => {
      expect(() => TeacherScopeService.assertCanAssignToClass('c3', myClasses)).toThrowError(/classes you teach/);
    });
  });

  describe('groupByClass', () => {
    it('groups the roster by class with the subjects taught there', () => {
      const grouped = TeacherScopeService.groupByClass(teacher, myClasses, subjects, roster);
      expect(grouped.length).toBe(1);
      expect(grouped[0].cls.id).toBe('c1');
      expect(grouped[0].students.map(s => s.uid)).toEqual(['stu1', 'stu2']);
      expect(grouped[0].subjects.map(s => s.id)).toEqual(['s-math']);
    });
  });
});
