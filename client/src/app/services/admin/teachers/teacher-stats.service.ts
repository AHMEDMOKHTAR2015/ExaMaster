import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../../api/api-client.service';

/** One class's roster and results (`GET /classes/{id}/stats`), counted by the server on request. */
interface ApiClassStats {
  classId: number;
  students: number;
  submissions: number;
  averageScorePercent: number | null;
  awaitingReview: number;
}

export interface TeacherRosterStats {
  studentCount: number;
  averageScore: number;
  /** Submissions the average is taken over; `0` means there is no average yet. */
  scoredCount: number;
}

/**
 * The teacher dashboard's roster and average-score tiles, across the teacher's
 * classes. Each class is counted on the server; the classes are combined here,
 * weighting each average by its number of submissions.
 */
@Injectable({ providedIn: 'root' })
export class TeacherStatsService {
  private readonly api = inject(ApiClient);

  async getRosterStats(classIds: string[]): Promise<TeacherRosterStats> {
    const stats = await Promise.all(classIds.map(id => this.api.get<ApiClassStats>(`/classes/${id}/stats`)));

    let studentCount = 0;
    let scoreSum = 0;
    let scoredCount = 0;
    for (const entry of stats) {
      studentCount += entry.students;
      if (entry.averageScorePercent === null) continue;
      scoreSum += entry.averageScorePercent * entry.submissions;
      scoredCount += entry.submissions;
    }

    return {
      studentCount,
      scoredCount,
      averageScore: scoredCount > 0 ? Math.round(scoreSum / scoredCount) : 0
    };
  }
}
