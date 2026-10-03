import { TestBed } from '@angular/core/testing';
import { TeacherStudentsService, filterMyStudents } from './teacher-students.service';
import { ApiClient } from '../../api/api-client.service';
import { ApiMyStudent, ApiUser } from '../../api/api-models';
import { MyStudent } from '../../../models';

const sara: ApiUser = {
  id: 6, signInUid: 'u-6', email: 'sara@demo.local', displayName: 'Sara Student', firstName: 'Sara', lastName: 'Student',
  mobileNumber: null, photoUrl: null, roles: ['STUDENT'], isActive: true, parentId: 5, teacherId: null,
  stageId: 1, gradeId: 1, classId: 1, registrationKeyId: null, createdOn: '2026-09-01T00:00:00Z', lastActiveOn: '2026-10-01T08:00:00Z'
};

function apiStudent(overrides: Partial<ApiMyStudent> = {}): ApiMyStudent {
  return {
    student: sara, parentName: 'Paula Parent', stageName: 'Primary', gradeName: 'Grade 4', className: '4A',
    quizCount: 2, homeworkCount: 1, lastSubmittedOn: '2026-10-02T12:00:00Z', ...overrides
  };
}

describe('TeacherStudentsService', () => {
  let requestedPath: string | undefined;
  let rows: ApiMyStudent[];

  beforeEach(() => {
    requestedPath = undefined;
    rows = [];
    TestBed.configureTestingModule({
      providers: [{
        provide: ApiClient,
        useValue: { get: (path: string) => { requestedPath = path; return Promise.resolve({ students: rows }); } }
      }]
    });
  });

  it('asks the server for the caller\'s own students, naming no one', async () => {
    await TestBed.inject(TeacherStudentsService).listMine();
    expect(requestedPath).toBe('/me/students');
  });

  it('maps a student with string ids and a timestamp', async () => {
    rows = [apiStudent()];
    const [student] = await TestBed.inject(TeacherStudentsService).listMine();
    expect(student).toEqual({
      id: '6', displayName: 'Sara Student', mobileNumber: undefined, parentName: 'Paula Parent',
      stageName: 'Primary', gradeName: 'Grade 4', classId: '1', className: '4A',
      quizCount: 2, homeworkCount: 1, lastSubmittedAt: Date.parse('2026-10-02T12:00:00Z')
    });
  });

  it('hands the roster screens the accounts, counting only this teacher\'s work', async () => {
    rows = [apiStudent()];
    const [student] = await TestBed.inject(TeacherStudentsService).listRoster();
    expect(student.uid).toBe('6');
    expect(student.classId).toBe('1');
    expect(student.lastLoginAt).toEqual(new Date('2026-10-01T08:00:00Z'));
    expect(student.participationCount).toBe(3);   // 2 quizzes + 1 homework
  });

  it('leaves absent details out rather than inventing them', async () => {
    rows = [apiStudent({ parentName: null, stageName: null, gradeName: null, lastSubmittedOn: null })];
    const [student] = await TestBed.inject(TeacherStudentsService).listMine();
    expect(student.parentName).toBeUndefined();
    expect(student.gradeName).toBeUndefined();
    expect(student.lastSubmittedAt).toBeUndefined();
  });
});

describe('filterMyStudents', () => {
  const student = (id: string, displayName: string, classId: string, extra: Partial<MyStudent> = {}): MyStudent => ({
    id, displayName, classId, className: classId === '1' ? '4A' : '5B', quizCount: 0, homeworkCount: 0, ...extra
  });
  const roster = [
    student('1', 'Sara Ali', '1', { parentName: 'Paula Parent', mobileNumber: '01555299871' }),
    student('2', 'Omar Hassan', '2'),
    student('3', 'Mona Adel', '1')
  ];
  const names = (students: MyStudent[]) => students.map(s => s.displayName);

  it('returns everyone with no search and no group', () => {
    expect(names(filterMyStudents(roster, '', ''))).toEqual(['Sara Ali', 'Omar Hassan', 'Mona Adel']);
  });

  it('narrows to one group', () => {
    expect(names(filterMyStudents(roster, '', '1'))).toEqual(['Sara Ali', 'Mona Adel']);
  });

  it('searches name, mobile, parent and group, ignoring case and spaces around the query', () => {
    expect(names(filterMyStudents(roster, '  omar ', ''))).toEqual(['Omar Hassan']);
    expect(names(filterMyStudents(roster, '0155529', ''))).toEqual(['Sara Ali']);
    expect(names(filterMyStudents(roster, 'paula', ''))).toEqual(['Sara Ali']);
    expect(names(filterMyStudents(roster, '5b', ''))).toEqual(['Omar Hassan']);
  });

  it('applies the search within the chosen group', () => {
    expect(names(filterMyStudents(roster, 'omar', '1'))).toEqual([]);
  });
});
