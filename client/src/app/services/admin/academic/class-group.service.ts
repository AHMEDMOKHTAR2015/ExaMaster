import { Injectable, inject } from '@angular/core';
import { ClassGroup, PagedResult } from '../../../models';
import { ApiClient } from '../../api/api-client.service';
import { ApiClassGroup, ApiId, idNumber, idNumbers } from '../../api/api-models';
import { onePage } from '../../api/list-paging';

// Empty lists read as undefined, as the Firestore version stored them.
const orUndefined = (ids: number[]) => (ids.length > 0 ? ids.map(String) : undefined);

const toClass = (group: ApiClassGroup): ClassGroup => ({
  id: String(group.id),
  stageId: String(group.stageId),
  gradeId: String(group.gradeId),
  name: group.name,
  teacherIds: orUndefined(group.teacherIds),
  subjectIds: orUndefined(group.subjectIds)
});

@Injectable({ providedIn: 'root' })
export class ClassGroupService {
  private readonly api = inject(ApiClient);

  async fetchClass(classId: string): Promise<ClassGroup | null> {
    return (await this.all()).find(group => group.id === classId) ?? null;
  }

  /** Every class; the API returns the whole list, so there is only ever one page. */
  async listClasses(_pageSize?: number, _cursor?: string): Promise<PagedResult<ClassGroup>> {
    return onePage(await this.all());
  }

  /** Returns the new class's id, which the API assigns. Its stage comes from its grade. */
  async createClass(group: Omit<ClassGroup, 'id'>): Promise<string> {
    return String((await this.api.post<ApiId>('/classes', this.body(group))).id);
  }

  async updateClass(group: ClassGroup): Promise<void> {
    await this.api.put(`/classes/${group.id}`, this.body(group));
  }

  async deleteClass(classId: string): Promise<void> {
    await this.api.delete(`/classes/${classId}`);
  }

  // The stage is not sent: the API derives it from the grade, so the two can never disagree.
  private body(group: Omit<ClassGroup, 'id'>) {
    return { gradeId: idNumber(group.gradeId), name: group.name, teacherIds: idNumbers(group.teacherIds), subjectIds: idNumbers(group.subjectIds) };
  }

  private async all(): Promise<ClassGroup[]> {
    return (await this.api.get<{ classes: ApiClassGroup[] }>('/classes')).classes.map(toClass);
  }
}
