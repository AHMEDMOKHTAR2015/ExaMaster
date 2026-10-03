import { Injectable, inject } from '@angular/core';
import { Subject, PagedResult } from '../../../models';
import { ApiClient } from '../../api/api-client.service';
import { ApiId, ApiSubject, idNumber } from '../../api/api-models';
import { onePage, pagedList } from '../../api/list-paging';
import { PagedSource } from '../../shared/query-spec';

const toSubject = (subject: ApiSubject): Subject => ({
  id: String(subject.id),
  name: subject.name,
  color: subject.color ?? undefined,
  tags: (subject.tags ?? []).map(tag => ({ id: String(tag.id), name: tag.name }))
});

/** The tag list as the API takes it (a kept tag by its id, a new one without), or null to leave the tags alone. */
const tagsBody = (subject: Omit<Subject, 'id'>) =>
  subject.tags ? subject.tags.map(tag => ({ id: idNumber(tag.id), name: tag.name })) : null;

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

  /** The Subjects admin table, by name (the API's order); only subjects whose name contains `search` (the API matches it). */
  pagedSource(search?: string): PagedSource<Subject> {
    return pagedList(() => this.all(search));
  }

  /** Returns the new subject's id, which the API assigns. */
  async createSubject(subject: Omit<Subject, 'id'>): Promise<string> {
    return String((await this.api.post<ApiId>('/subjects', { name: subject.name, color: subject.color ?? null, tags: tagsBody(subject) })).id);
  }

  /** A tag left out of `tags` is removed from the subject and from every question carrying it; no `tags` keeps them. */
  async updateSubject(subject: Subject): Promise<void> {
    await this.api.put(`/subjects/${subject.id}`, { name: subject.name, color: subject.color ?? null, tags: tagsBody(subject) });
  }

  /** Classes and teachers drop it too; refused (409) while a teacher quiz is still written in it. */
  async deleteSubject(subjectId: string): Promise<void> {
    await this.api.delete(`/subjects/${subjectId}`);
  }

  private async all(search?: string): Promise<Subject[]> {
    return (await this.api.get<{ subjects: ApiSubject[] }>('/subjects', { search: search?.trim() || undefined })).subjects.map(toSubject);
  }
}
