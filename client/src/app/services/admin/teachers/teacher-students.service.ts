import { Injectable, inject } from '@angular/core';
import { MyStudent, User } from '../../../models';
import { ApiClient } from '../../api/api-client.service';
import { ApiMyStudent } from '../../api/api-models';
import { toUser } from '../../auth/current-user.mapper';
import { TenantContextService } from '../../tenant/tenant-context.service';

/**
 * The signed-in teacher's students (`GET /me/students`). The server works out
 * the roster from the teacher's own groups, so a teacher can never list anyone
 * else's students — nothing here filters for safety, only for display. Holds no
 * state: the page owns what it loaded, so nothing outlives a change of account.
 */
@Injectable({ providedIn: 'root' })
export class TeacherStudentsService {
  private readonly api = inject(ApiClient);
  private readonly tenantContext = inject(TenantContextService);

  /** The My Students table: one row per student, with names resolved for display. */
  async listMine(): Promise<MyStudent[]> {
    return (await this.rows()).map(toMyStudent);
  }

  /**
   * The same students as accounts, for the screens that work with the roster
   * (the teacher dashboard, Quiz Management). `participationCount` is the
   * student's work in this teacher's subjects, as My Students counts it.
   */
  async listRoster(): Promise<User[]> {
    const tenantId = this.tenantContext.tenantId() ?? undefined;
    return (await this.rows()).map(row => ({
      ...toUser(row.student, tenantId),
      participationCount: row.quizCount + row.homeworkCount
    }));
  }

  private async rows(): Promise<ApiMyStudent[]> {
    return (await this.api.get<{ students: ApiMyStudent[] }>('/me/students')).students;
  }
}

function toMyStudent(row: ApiMyStudent): MyStudent {
  return {
    id: String(row.student.id),
    displayName: row.student.displayName,
    mobileNumber: row.student.mobileNumber ?? undefined,
    parentName: row.parentName ?? undefined,
    stageName: row.stageName ?? undefined,
    gradeName: row.gradeName ?? undefined,
    classId: String(row.student.classId),
    className: row.className,
    quizCount: row.quizCount,
    homeworkCount: row.homeworkCount,
    lastSubmittedAt: row.lastSubmittedOn ? Date.parse(row.lastSubmittedOn) : undefined
  };
}

/** The students matching a search (name, mobile, parent or group) and, when one is chosen, a group. */
export function filterMyStudents(students: MyStudent[], search: string, classId: string): MyStudent[] {
  const query = search.trim().toLowerCase();
  return students.filter(student =>
    (!classId || student.classId === classId) &&
    (!query || [student.displayName, student.mobileNumber, student.parentName, student.className]
      .some(value => value?.toLowerCase().includes(query))));
}
