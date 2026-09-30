/**
 * The school-structure services on the API. Two things are easy to get wrong
 * and invisible until data is corrupt: the id conversions (the app's models
 * hold strings, the API integers) and whether a save creates or updates.
 */

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../../environments/environment';
import { StageService } from './stage.service';
import { GradeService } from './grade.service';
import { ClassGroupService } from './class-group.service';
import { SubjectService } from './subject.service';
import { TeacherService } from '../teachers/teacher.service';
import { TeacherAccountService, DEFAULT_TEACHER_PASSWORD } from '../teachers/teacher-account.service';
import { pagedList } from '../../api/list-paging';

const api = (path: string) => `${environment.apiUrl}${path}`;
const settle = () => new Promise(resolve => setTimeout(resolve));

describe('school structure on the API', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads a class with string ids, and empty lists as undefined', async () => {
    const result = TestBed.inject(ClassGroupService).fetchClass('7');
    http.expectOne(api('/classes')).flush({ classes: [
      { id: 7, stageId: 1, gradeId: 2, name: '4A', teacherIds: [3, 4], subjectIds: [] },
      { id: 8, stageId: 1, gradeId: 2, name: '4B', teacherIds: [], subjectIds: [5] }
    ] });

    expect(await result).toEqual({ id: '7', stageId: '1', gradeId: '2', name: '4A', teacherIds: ['3', '4'], subjectIds: undefined });
  });

  it('returns every row as one page, so paging callers stop after it', async () => {
    const result = TestBed.inject(StageService).listStages(2, undefined);
    http.expectOne(api('/stages')).flush({ stages: [{ id: 1, name: 'A', order: 1 }, { id: 2, name: 'B', order: 2 }, { id: 3, name: 'C', order: 3 }] });

    const page = await result;
    expect(page.items.length).toBe(3);
    expect(page.nextCursor).toBeUndefined();
  });

  it('creates with POST and returns the id the API assigned', async () => {
    const result = TestBed.inject(GradeService).createGrade({ stageId: '1', name: 'Grade 5', order: 5 });
    const request = http.expectOne(api('/grades'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ stageId: 1, name: 'Grade 5', order: 5 });
    request.flush({ id: 42 });

    expect(await result).toBe('42');
  });

  it('updates with PUT to the record, never a create', async () => {
    const result = TestBed.inject(SubjectService).updateSubject({ id: '9', name: 'Science', color: '#2E7D32' });
    const request = http.expectOne(api('/subjects/9'));
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ name: 'Science', color: '#2E7D32' });
    request.flush({ id: 9 });
    await result;
  });

  it('sends a class its grade but not its stage, and drops ids that are not API ids', async () => {
    const result = TestBed.inject(ClassGroupService).updateClass({ id: '7', stageId: '1', gradeId: '2', name: '4A', teacherIds: ['3', 'abc123'], subjectIds: undefined });
    const request = http.expectOne(api('/classes/7'));
    expect(request.request.body).toEqual({ gradeId: 2, name: '4A', teacherIds: [3], subjectIds: [] });
    request.flush({ id: 7 });
    await result;
  });

  it('lists teachers by surname', async () => {
    const result = TestBed.inject(TeacherService).listTeachers();
    http.expectOne(api('/teachers')).flush({ teachers: [
      { id: 1, firstName: 'Zed', lastName: 'Young', email: null, photoUrl: null, subjectIds: [] },
      { id: 2, firstName: 'Amy', lastName: 'Adams', email: 'amy@x.test', photoUrl: null, subjectIds: [4] }
    ] });

    const teachers = (await result).items;
    expect(teachers.map(t => t.lastName)).toEqual(['Adams', 'Young']);
    expect(teachers[0]).toEqual({ id: '2', firstName: 'Amy', lastName: 'Adams', email: 'amy@x.test', photoURL: undefined, subjectIds: ['4'] });
  });

  it("provisions a teacher's login on the server and words the outcome as before", async () => {
    const result = TestBed.inject(TeacherAccountService).ensureTeacherAccount({ id: '5', firstName: 'Tarek', lastName: 'T', email: 't@x.test' });
    const request = http.expectOne(api('/teachers/5/login'));
    expect(request.request.body).toEqual({ password: DEFAULT_TEACHER_PASSWORD });
    request.flush({ status: 'ExistsUnmanaged', userId: null });

    expect((await result).status).toBe('exists-unmanaged');
  });

  it('pages a whole list in memory for the admin tables', async () => {
    const source = pagedList(() => Promise.resolve([1, 2, 3, 4, 5]));

    const first = await source.fetchPage(2);
    const second = await source.fetchPage(2, first.nextCursor);
    const last = await source.fetchPage(2, second.nextCursor);

    expect([first.items, second.items, last.items]).toEqual([[1, 2], [3, 4], [5]]);
    expect(last.nextCursor).toBeUndefined();
    expect(await source.fetchCount()).toBe(5);
    await settle();
  });
});
