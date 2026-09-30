import { Injectable, inject } from '@angular/core';
import { Grade, PagedResult } from '../../../models';
import { ApiClient } from '../../api/api-client.service';
import { ApiGrade, ApiId, idNumber } from '../../api/api-models';
import { onePage } from '../../api/list-paging';

const toGrade = (grade: ApiGrade): Grade => ({ id: String(grade.id), stageId: String(grade.stageId), name: grade.name, order: grade.order });

@Injectable({ providedIn: 'root' })
export class GradeService {
  private readonly api = inject(ApiClient);

  async fetchGrade(gradeId: string): Promise<Grade | null> {
    return (await this.all()).find(grade => grade.id === gradeId) ?? null;
  }

  /** Every grade; the API returns the whole list, so there is only ever one page. */
  async listGrades(_pageSize?: number, _cursor?: string): Promise<PagedResult<Grade>> {
    return onePage(await this.all());
  }

  /** Returns the new grade's id, which the API assigns. */
  async createGrade(grade: Omit<Grade, 'id'>): Promise<string> {
    return String((await this.api.post<ApiId>('/grades', this.body(grade))).id);
  }

  async updateGrade(grade: Grade): Promise<void> {
    await this.api.put(`/grades/${grade.id}`, this.body(grade));
  }

  /** Refused (409) while classes are still in it. */
  async deleteGrade(gradeId: string): Promise<void> {
    await this.api.delete(`/grades/${gradeId}`);
  }

  private body(grade: Omit<Grade, 'id'>) {
    return { stageId: idNumber(grade.stageId), name: grade.name, order: grade.order ?? 1 };
  }

  private async all(): Promise<Grade[]> {
    return (await this.api.get<{ grades: ApiGrade[] }>('/grades')).grades.map(toGrade);
  }
}
