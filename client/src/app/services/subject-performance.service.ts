import { Injectable, inject } from '@angular/core';
import { ApiClient } from './api/api-client.service';
import { ApiSubjectPerformance } from './api/api-models';
import { SubjectLevel, SubjectPerformance } from '../models';

/**
 * The signed-in student's level in each subject (`GET /me/subject-performance`). The server works it out from
 * the caller's own sign-in, so nothing identifying is sent. Holds no state: the dashboard owns what it loaded, so
 * nothing outlives a change of account on a shared device.
 */
@Injectable({ providedIn: 'root' })
export class SubjectPerformanceService {
  private readonly api = inject(ApiClient);

  async listMine(): Promise<SubjectPerformance[]> {
    const rows = await this.api.get<ApiSubjectPerformance[]>('/me/subject-performance');
    return rows.map(toSubjectPerformance);
  }
}

function toSubjectPerformance(row: ApiSubjectPerformance): SubjectPerformance {
  return {
    subjectId: String(row.subjectId),
    subjectName: row.subjectName,
    subjectColor: row.subjectColor ?? undefined,
    quizCount: row.quizCount,
    homeworkCount: row.homeworkCount,
    awaitingReviewCount: row.awaitingReviewCount,
    pointsEarned: row.pointsEarned,
    pointsPossible: row.pointsPossible,
    scorePercent: row.scorePercent ?? undefined,
    level: row.level ? (row.level.toLowerCase() as SubjectLevel) : undefined,
    trendPoints: row.earlierPercent !== null && row.recentPercent !== null
      ? row.recentPercent - row.earlierPercent
      : undefined
  };
}
