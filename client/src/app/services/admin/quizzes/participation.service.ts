import { Injectable, inject } from '@angular/core';
import { ParticipationRecord, PagedResult } from '../../../models';
import { ApiClient } from '../../api/api-client.service';
import { ApiPage, ApiParticipation, ApiParticipationSummary } from '../../api/api-models';
import { toParticipationDetail, toParticipationRecord } from '../../api/participation-mapping';
import { ServiceError } from '../../shared/service-error';

/**
 * Submitted attempts, through the API (`/participations`), newest first.
 *
 * The server decides whose attempts a caller may see — staff their
 * organization's, a parent their children's, a student their own — so the
 * parent id the Firestore query needed is no longer passed. Lists carry no
 * answers; {@link getById} returns an attempt whole, which is what the answer
 * popups and the review screen read. The cursor is the next page number.
 */
const MAX_PAGE = 100;                                    // the API's page-size limit

@Injectable({ providedIn: 'root' })
export class ParticipationService {
  private readonly api = inject(ApiClient);

  /** One student's attempts (`childId` is their API user id). */
  listByUser(childId: string, pageSize = 10, cursor?: string): Promise<PagedResult<ParticipationRecord>> {
    return this.search({ childId: Number(childId) }, pageSize, cursor);
  }

  /** A parent's view of one of their children: the same list, which the server limits to their own children. */
  listByUserDesc(childId: string, _parentId?: string, pageSize = 10, cursor?: string): Promise<PagedResult<ParticipationRecord>> {
    return this.listByUser(childId, pageSize, cursor);
  }

  /** One attempt, with its answers and the teacher's verdict. */
  async getById(id: string): Promise<ParticipationRecord | null> {
    try {
      return toParticipationDetail((await this.api.get<{ participation: ApiParticipation }>(`/participations/${id}`)).participation);
    } catch (error) {
      if (error instanceof ServiceError && error.code === '404') return null;
      throw error;
    }
  }

  /** Administrators only. The student's completion history is derived from what remains. */
  async remove(record: ParticipationRecord): Promise<void> {
    await this.api.delete(`/participations/${record.id}`);
  }

  /**
   * One page of attempts. The API serves at most {@link MAX_PAGE} per request,
   * so a larger page is gathered from consecutive requests; the cursor is then
   * in pages of that larger size.
   */
  async search(filters: Record<string, number | boolean>, pageSize: number, cursor?: string): Promise<PagedResult<ParticipationRecord>> {
    const size = Math.min(pageSize, MAX_PAGE);
    const perPage = Math.ceil(pageSize / size);                  // API pages per page asked for
    let apiPage = (cursor ? Number(cursor) - 1 : 0) * perPage + 1;
    const items: ParticipationRecord[] = [];
    let total = 0;
    for (let i = 0; i < perPage; i++, apiPage++) {
      const result = await this.api.get<ApiPage<ApiParticipationSummary>>('/participations', { ...filters, page: apiPage, pageSize: size });
      items.push(...result.items.map(toParticipationRecord));
      total = result.totalCount;
      if (apiPage * size >= total) break;
    }
    const page = cursor ? Number(cursor) : 1;
    return { items, nextCursor: page * perPage * size < total ? String(page + 1) : undefined };
  }
}
