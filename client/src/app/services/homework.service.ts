import { Injectable, inject } from '@angular/core';
import { HomeworkAssignment, AssignmentKind, PagedResult } from '../models';
import { ApiClient, ApiParams } from './api/api-client.service';
import { ApiAssignment, ApiAssignmentResult, idNumber, idNumbers, idString } from './api/api-models';
import { assignmentFilterParams } from './api/assignment-filter-params';
import { AssignmentFilter, AssignmentResultRow } from '../shared/quiz-management';
import { toApiSemester, toSemester } from './api/question-mapping';
import { onePage } from './api/list-paging';
import { ServiceError } from './shared/service-error';

export type NewAssignment = Omit<HomeworkAssignment, 'id' | 'createdAt' | 'createdBy'> & { createdBy?: string };

export type AssignmentUpdate = Partial<Pick<HomeworkAssignment, 'title' | 'quizId' | 'quizSource' | 'stageId' | 'classId' | 'dueAt' | 'active' | 'questionIds'>> & {
  gradeId?: string | null;
  customQuizId?: string | null;
  subjectId?: string | null;
  semester?: HomeworkAssignment['semester'] | null;
  assignedChildIds?: string[] | null;
};

/**
 * Assignments, through the API (`/assignments`).
 *
 * The server decides who sees what: a student gets the active assignments set
 * for them (with their latest attempt), a parent their child's, staff the
 * organization's. It also stamps the author, and derives stage and grade from
 * the class. Lists come back whole, so paged callers get one page.
 */
@Injectable({
  providedIn: 'root'
})
export class HomeworkService {
  private readonly api = inject(ApiClient);

  /** Returns the new assignment's id. The author is whoever is signed in. */
  async createAssignment(input: NewAssignment): Promise<string> {
    return String((await this.api.post<{ id: number }>('/assignments', body(input))).id);
  }

  /** A class's active assignments (staff). */
  async listByClass(classId: string, _pageSize?: number, _cursor?: string): Promise<PagedResult<HomeworkAssignment>> {
    return onePage(await this.list({ classId: Number(classId) }));
  }

  /**
   * The signed-in student's assignments: the ones set for them, active only,
   * newest first. (The stage is the server's to know, so it is not passed.)
   */
  async listForMe(): Promise<HomeworkAssignment[]> {
    return this.list({});
  }

  /** The signed-in teacher's own assignments, closed ones included, newest first. */
  /** The caller's own assignments, active or not, narrowed by Quiz Management's filter bar (applied by the API). */
  async listByCreator(filter: AssignmentFilter = {}): Promise<HomeworkAssignment[]> {
    return this.list({ mine: true, includeInactive: true, ...assignmentFilterParams(filter) });
  }

  /** How far the students of each of the caller's assignments have got, worked out by the API for the filter bar's selection. */
  async listResults(filter: AssignmentFilter = {}): Promise<AssignmentResultRow[]> {
    const { results } = await this.api.get<{ results: ApiAssignmentResult[] }>('/assignments/results', assignmentFilterParams(filter));
    return results.map(row => ({
      assignmentId: String(row.assignmentId),
      subjectId: idString(row.subjectId),
      semester: toSemester(row.semester),
      result: {
        targeted: row.targeted, completed: row.completed, inProgress: 0, notStarted: row.notStarted, overdue: row.overdue,
        completionRate: row.completionRate, averageScore: row.averageScore, validated: row.validated
      }
    }));
  }

  /** Every assignment in the school, active or not, narrowed by `filter` (applied by the API), as one page. */
  async listAll(_pageSize?: number, _cursor?: string, filter: AssignmentFilter = {}): Promise<PagedResult<HomeworkAssignment>> {
    return onePage(await this.list({ includeInactive: true, ...assignmentFilterParams(filter) }));
  }

  async countAll(filter: AssignmentFilter = {}): Promise<number> {
    return (await this.list({ includeInactive: true, ...assignmentFilterParams(filter) })).length;
  }

  async countByKind(kind: AssignmentKind): Promise<number> {
    return this.countAll({ kind });
  }

  async getById(id: string): Promise<HomeworkAssignment | null> {
    if (!Number(id)) return null;                        // an id from before the move names nothing here
    try {
      return toAssignment((await this.api.get<{ assignment: ApiAssignment }>(`/assignments/${id}`)).assignment);
    } catch (error) {
      if (error instanceof ServiceError && error.code === '404') return null;
      throw error;
    }
  }

  async deactivateAssignment(id: string): Promise<void> {
    await this.updateAssignment(id, { active: false });
  }

  async setAssignmentActive(id: string, active: boolean): Promise<void> {
    await this.updateAssignment(id, { active });
  }

  async deleteAssignment(id: string): Promise<void> {
    await this.api.delete(`/assignments/${id}`);
  }

  /**
   * The API replaces an assignment whole, so the patch is merged onto the
   * stored one first. `null` clears a field, `undefined` leaves it as it is.
   */
  async updateAssignment(id: string, updates: AssignmentUpdate): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) throw new Error(`Assignment ${id} not found`);
    const merged: HomeworkAssignment = { ...existing };
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) continue;
      (merged as unknown as Record<string, unknown>)[key] = value === null ? undefined : value;
    }
    await this.api.put(`/assignments/${id}`, { ...body(merged), isActive: merged.active });
  }

  private async list(params: ApiParams): Promise<HomeworkAssignment[]> {
    const { assignments } = await this.api.get<{ assignments: ApiAssignment[] }>('/assignments', params);
    return assignments.map(toAssignment).sort((a, b) => b.createdAt - a.createdAt);
  }
}

function toAssignment(assignment: ApiAssignment): HomeworkAssignment {
  const custom = assignment.source === 'Custom';
  return {
    id: String(assignment.id),
    quizId: assignment.bankQuizId ?? 0,
    title: assignment.title,
    stageId: String(assignment.stageId),
    gradeId: idString(assignment.gradeId),
    classId: String(assignment.classId),
    dueAt: new Date(assignment.dueAt).getTime(),
    createdBy: String(assignment.createdById),
    createdByName: assignment.createdByName ?? undefined,
    createdAt: new Date(assignment.createdOn).getTime(),
    active: assignment.isActive,
    semester: toSemester(assignment.semester),
    kind: assignment.kind === 'Quiz' ? 'quiz' : 'homework',
    subjectId: idString(assignment.subjectId),
    quizSource: custom ? 'custom' : 'bank',
    customQuizId: custom ? idString(assignment.teacherQuizId) : undefined,
    assignedChildIds: assignment.assignedChildIds.map(String),
    questionCount: assignment.questionCount,
    quizDurationSeconds: assignment.durationSeconds,
    oneTimeJoin: assignment.oneTimeJoin,
    submission: assignment.submission && {
      participationId: String(assignment.submission.participationId),
      scorePercent: assignment.submission.scorePercent,
      pendingReviewCount: assignment.submission.pendingReviewCount,
      validationStatus: assignment.submission.validationStatus === 'Approved' ? 'approved'
        : assignment.submission.validationStatus === 'Rejected' ? 'rejected' : null,
      endedAt: new Date(assignment.submission.endedOn).getTime()
    }
  };
}

// Stage and grade are not sent: the server takes them from the class.
function body(assignment: NewAssignment) {
  const custom = assignment.quizSource === 'custom';
  return {
    title: assignment.title,
    kind: assignment.kind === 'quiz' ? 'Quiz' : 'Homework',
    source: custom ? 'Custom' : 'Bank',
    quizId: custom ? Number(assignment.customQuizId) : assignment.quizId,
    classId: Number(assignment.classId),
    subjectId: idNumber(assignment.subjectId),
    semester: toApiSemester(assignment.semester),
    dueAt: new Date(assignment.dueAt).toISOString(),
    assignedChildIds: assignment.assignedChildIds?.length ? idNumbers(assignment.assignedChildIds) : null
  };
}
