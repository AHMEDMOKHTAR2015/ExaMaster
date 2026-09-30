import { Injectable, inject } from '@angular/core';
import { MixinBase, ServiceStateMixin } from '../../shared/service-mixins';
import { ApiClient } from '../../api/api-client.service';

class DashboardStatsServiceBase implements MixinBase {}
const DashboardStatsServiceWithState = ServiceStateMixin(DashboardStatsServiceBase);

export interface DashboardStats {
  totalUsers: number;
  totalChildren: number;
  totalParents: number;
  totalTeachers: number;
  totalParticipations: number;
  activeHomework: number;
  registrationKeys: number;
  totalQuizzes: number;
}

/** `GET /dashboard/stats`: the organization's counts, taken by the server on request. */
interface ApiDashboardStats {
  students: number; teachers: number; parents: number; administrators: number;
  stages: number; classes: number; subjects: number; bankQuestions: number;
  bankQuizzes: number; teacherQuizzes: number; activeAssignments: number;
  submissions: number; awaitingReview: number; registrationKeys: number;
}

/**
 * The administrator dashboard's tiles. The server counts on every request —
 * there is no stored aggregate to drift, so nothing to recompute or repair.
 */
@Injectable({ providedIn: 'root' })
export class DashboardStatsService extends DashboardStatsServiceWithState {
  private readonly api = inject(ApiClient);

  async load(): Promise<DashboardStats> {
    return this.executeWithState(async () => {
      const stats = await this.api.get<ApiDashboardStats>('/dashboard/stats');
      return {
        totalUsers: stats.students + stats.teachers + stats.parents + stats.administrators,
        totalChildren: stats.students,
        totalParents: stats.parents,
        totalTeachers: stats.teachers,
        totalParticipations: stats.submissions,
        activeHomework: stats.activeAssignments,
        registrationKeys: stats.registrationKeys,
        totalQuizzes: stats.bankQuizzes + stats.teacherQuizzes
      };
    });
  }
}
