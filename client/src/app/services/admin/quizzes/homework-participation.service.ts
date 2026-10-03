import { Injectable, inject } from '@angular/core';
import { AssignmentKind, ParticipationRecord, ParticipationValidation, PagedResult } from '../../../models';
import { ApiClient } from '../../api/api-client.service';
import { ApiPage, ApiParticipationSummary } from '../../api/api-models';
import { assignmentFilterParams } from '../../api/assignment-filter-params';
import { toParticipationRecord } from '../../api/participation-mapping';
import { PagedSource } from '../../shared/query-spec';
import { AssignmentFilter } from '../../../shared/quiz-management';
import { ParticipationService } from './participation.service';

/** Which of a reviewer's submissions to list: those still waiting for a verdict, those given one, or both. */
export type ReviewVerdictFilter = 'pending' | 'reviewed' | 'all';

/** One submission in a teacher's review queue, with what the list shows about it. */
export interface ReviewQueueItem {
  record: ParticipationRecord;
  studentName: string;
  /** As the student sees it: the assignment's kind, or a quiz when it answers none (a bank quiz). */
  kind: AssignmentKind;
}

const MAX_PAGE = 100;                                    // the API's page-size limit

/** One reviewed answer's mark: a share of the quiz, 0 up to the answer's weight. */
export interface ReviewMarkInput {
  questionId: number;
  awardedPercent: number;
  comment?: string | null;
}

/**
 * Submissions as a reviewer sees them: an assignment's, or the bank-quiz
 * attempts a teacher was named reviewer of. The review itself — marks and
 * verdict — is one request; the server recomputes the score, reopens a
 * rejected assignment and tells the student.
 */
@Injectable({ providedIn: 'root' })
export class HomeworkParticipationService {
  private readonly api = inject(ApiClient);
  private readonly participations = inject(ParticipationService);

  listByHomework(homeworkId: string, pageSize = 10, cursor?: string): Promise<PagedResult<ParticipationRecord>> {
    if (!Number(homeworkId)) return Promise.resolve({ items: [], nextCursor: undefined });
    return this.participations.search({ homeworkId: Number(homeworkId) }, pageSize, cursor);
  }

  /**
   * A teacher's review queue — every submission they review, to their own
   * assignments and to bank quizzes naming them — narrowed by verdict and by
   * Quiz Management's filter bar, all by the API. Reviewed ones come most
   * recently reviewed first, the rest newest first. `reviewerId` is their API user id.
   */
  reviewQueueSource(reviewerId: string, verdict: ReviewVerdictFilter, filter: AssignmentFilter): PagedSource<ReviewQueueItem> {
    const params = {
      reviewerId: Number(reviewerId),
      verdict: verdict === 'pending' ? 'Pending' : verdict === 'reviewed' ? 'Reviewed' : undefined,
      ...assignmentFilterParams(filter)
    };
    return {
      fetchPage: async (pageSize, cursor) => {
        const page = cursor ? Number(cursor) : 1;
        const size = Math.min(pageSize, MAX_PAGE);
        const result = await this.api.get<ApiPage<ApiParticipationSummary>>('/participations', { ...params, page, pageSize: size });
        return {
          items: result.items.map(toReviewQueueItem),
          nextCursor: page * size < result.totalCount ? String(page + 1) : undefined
        };
      },
      fetchCount: async () =>
        (await this.api.get<ApiPage<ApiParticipationSummary>>('/participations', { ...params, page: 1, pageSize: 1 })).totalCount
    };
  }

  /** Save a review; returns the attempt as the server now has it (new score, verdict, marks). */
  async review(
    participationId: string,
    verdict: Pick<ParticipationValidation, 'status' | 'feedback'>,
    marks: ReviewMarkInput[]
  ): Promise<ParticipationRecord | null> {
    await this.api.post(`/participations/${participationId}:review`, {
      status: verdict.status === 'approved' ? 'Approved' : 'Rejected',
      feedback: verdict.feedback || null,
      marks
    });
    return this.participations.getById(participationId);
  }
}

function toReviewQueueItem(summary: ApiParticipationSummary): ReviewQueueItem {
  return {
    record: toParticipationRecord(summary),
    studentName: summary.childName ?? '',
    kind: summary.assignmentKind === 'Homework' ? 'homework' : 'quiz'
  };
}
