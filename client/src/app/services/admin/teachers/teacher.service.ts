import { Injectable, inject } from '@angular/core';
import { Teacher, PagedResult } from '../../../models';
import { ApiClient } from '../../api/api-client.service';
import { ApiId, ApiTeacher, idNumbers } from '../../api/api-models';
import { onePage, pagedList } from '../../api/list-paging';
import { PagedSource } from '../../shared/query-spec';

const toTeacher = (teacher: ApiTeacher): Teacher => ({
  id: String(teacher.id),
  firstName: teacher.firstName,
  lastName: teacher.lastName,
  email: teacher.email ?? undefined,
  photoURL: teacher.photoUrl ?? undefined,
  subjectIds: teacher.subjectIds.length > 0 ? teacher.subjectIds.map(String) : undefined
});

// Surname first, as the roster reads (the API orders by first name).
const bySurname = (a: Teacher, b: Teacher) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);

/** The school's teacher roster. A roster entry may have no sign-in; `TeacherAccountService` gives it one. */
@Injectable({ providedIn: 'root' })
export class TeacherService {
  private readonly api = inject(ApiClient);

  async fetchTeacher(teacherId: string): Promise<Teacher | null> {
    return (await this.all()).find(teacher => teacher.id === teacherId) ?? null;
  }

  /** Every teacher; the API returns the whole list, so there is only ever one page. */
  async listTeachers(_pageSize?: number, _cursor?: string): Promise<PagedResult<Teacher>> {
    return onePage(await this.all());
  }

  async countTeachers(): Promise<number> {
    return (await this.all()).length;
  }

  /** The Teachers admin table, by surname; only teachers whose name, email or subject contains `search` (the API matches it). */
  pagedSource(search?: string): PagedSource<Teacher> {
    return pagedList(() => this.all(search));
  }

  /** Returns the new teacher's id, which the API assigns. */
  async createTeacher(teacher: Omit<Teacher, 'id'>): Promise<string> {
    return String((await this.api.post<ApiId>('/teachers', this.body(teacher))).id);
  }

  async updateTeacher(teacher: Teacher): Promise<void> {
    await this.api.put(`/teachers/${teacher.id}`, this.body(teacher));
  }

  /** The classes they taught are left unassigned, and a signed-in teacher keeps their account without the link. */
  async deleteTeacher(teacherId: string): Promise<void> {
    await this.api.delete(`/teachers/${teacherId}`);
  }

  private body(teacher: Omit<Teacher, 'id'>) {
    return {
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      email: teacher.email ?? null,
      photoUrl: teacher.photoURL ?? null,
      subjectIds: idNumbers(teacher.subjectIds)
    };
  }

  private async all(search?: string): Promise<Teacher[]> {
    const { teachers } = await this.api.get<{ teachers: ApiTeacher[] }>('/teachers', { search: search?.trim() || undefined });
    return teachers.map(toTeacher).sort(bySurname);
  }
}
