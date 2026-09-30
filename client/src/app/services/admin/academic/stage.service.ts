import { Injectable, inject } from '@angular/core';
import { Stage, PagedResult } from '../../../models';
import { ApiClient } from '../../api/api-client.service';
import { ApiId, ApiStage } from '../../api/api-models';
import { onePage } from '../../api/list-paging';

const toStage = (stage: ApiStage): Stage => ({ id: String(stage.id), name: stage.name, order: stage.order });

@Injectable({ providedIn: 'root' })
export class StageService {
  private readonly api = inject(ApiClient);

  async fetchStage(stageId: string): Promise<Stage | null> {
    return (await this.all()).find(stage => stage.id === stageId) ?? null;
  }

  /** Every stage, in their order; the API returns the whole list, so there is only ever one page. */
  async listStages(_pageSize?: number, _cursor?: string): Promise<PagedResult<Stage>> {
    return onePage(await this.all());
  }

  /** Returns the new stage's id, which the API assigns. */
  async createStage(stage: Omit<Stage, 'id'>): Promise<string> {
    return String((await this.api.post<ApiId>('/stages', { name: stage.name, order: stage.order })).id);
  }

  async updateStage(stage: Stage): Promise<void> {
    await this.api.put(`/stages/${stage.id}`, { name: stage.name, order: stage.order });
  }

  /** Refused (409) while grades or classes are still in it. */
  async deleteStage(stageId: string): Promise<void> {
    await this.api.delete(`/stages/${stageId}`);
  }

  private async all(): Promise<Stage[]> {
    return (await this.api.get<{ stages: ApiStage[] }>('/stages')).stages.map(toStage);
  }
}
