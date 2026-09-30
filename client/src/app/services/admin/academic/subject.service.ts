import { Injectable, inject } from '@angular/core';
import { Subject, PagedResult } from '../../../models';
import { ApiClient } from '../../api/api-client.service';
import { ApiId, ApiSubject } from '../../api/api-models';
import { onePage, pagedList } from '../../api/list-paging';
import { PagedSource } from '../../shared/query-spec';

const toSubject = (subject: ApiSubject): Subject => ({ id: String(subject.id), name: subject.name, color: subject.color ?? undefined });

@Injectable({ providedIn: 'root' })
export class SubjectService {
  private readonly api = inject(ApiClient);

  async fetchSubject(subjectId: string): Promise<Subject | null> {
    return (await this.all()).find(subject => subject.id === subjectId) ?? null;
  }

  /** Every subject, by name; the API returns the whole list, so there is only ever one page. */
  async listSubjects(_pageSize?: number, _cursor?: string): Promise<PagedResult<Subject>> {
    return onePage(await this.all());
  }

  async countSubjects(): Promise<number> {
    return (await this.all()).length;
  }

  /** The Subjects admin table, by name (the API's order). */
  pagedSource(): PagedSource<Subject> {
    return pagedList(() => this.all());
  }

  /** Returns the new subject's id, which the API assigns. */
  async createSubject(subject: Omit<Subject, 'id'>): Promise<string> {
    return String((await this.api.post<ApiId>('/subjects', { name: subject.name, color: subject.color ?? null })).id);
  }

  async updateSubject(subject: Subject): Promise<void> {
    await this.api.put(`/subjects/${subject.id}`, { name: subject.name, color: subject.color ?? null });
  }

  /** Classes and teachers drop it too; refused (409) while a teacher quiz is still written in it. */
  async deleteSubject(subjectId: string): Promise<void> {
    await this.api.delete(`/subjects/${subjectId}`);
  }

  private async all(): Promise<Subject[]> {
    return (await this.api.get<{ subjects: ApiSubject[] }>('/subjects')).subjects.map(toSubject);
  }
}
