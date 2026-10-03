import { AssignmentFilter } from '../../shared/quiz-management';
import { ApiParams } from './api-client.service';
import { toApiSemester } from './question-mapping';

/**
 * Quiz Management's filter bar as the API's query parameters. The assignments
 * list, their results and the review queue all take the same five, so the
 * three can never disagree about what is selected (the API's `AssignmentFilter`).
 */
export function assignmentFilterParams(filter: AssignmentFilter): ApiParams {
  const semester = filter.semester && filter.semester !== 'all' ? toApiSemester(filter.semester) : null;
  const kind = filter.kind && filter.kind !== 'all' ? filter.kind : null;
  return {
    subjectId: filter.subjectId || undefined,
    semester: semester ?? undefined,
    classId: filter.classId || undefined,
    kind: kind === 'quiz' ? 'Quiz' : kind === 'homework' ? 'Homework' : undefined,
    search: filter.search?.trim() || undefined
  };
}
