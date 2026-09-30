import { Injectable, inject } from '@angular/core';
import { ParticipationRecord, ParticipationValidation, PagedResult } from '../../../models';
import { ApiClient } from '../../api/api-client.service';
import { ParticipationService } from './participation.service';

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

  /** Bank-quiz attempts (no assignment) this teacher reviews. `reviewerId` is their API user id. */
  async listUnassignedForReviewer(reviewerId: string, pageSize = 50, cursor?: string): Promise<PagedResult<ParticipationRecord>> {
    const page = await this.participations.search({ reviewerId: Number(reviewerId) }, pageSize, cursor);
    return { ...page, items: page.items.filter(record => !record.homeworkId) };
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
