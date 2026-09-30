import { Injectable, inject } from '@angular/core';
import { QuestionAnswerKey, QuestionResponse } from '../shared/grade-quiz';
import { MixinBase, ServiceStateMixin } from './shared/service-mixins';
import { ApiClient } from './api/api-client.service';
import { ApiSubmissionResult } from './api/api-models';
import { SittingTarget } from './quiz.service';

class QuizSubmissionServiceBase implements MixinBase {}
const QuizSubmissionServiceWithState = ServiceStateMixin(QuizSubmissionServiceBase);

export interface SubmitQuizRequest {
  /** What was sat. For an assignment, the server grades against the assignment's quiz, not ids sent alongside. */
  target: SittingTarget;
  startedAt?: number;
  /** What the student did — never a score, never an answer. */
  responses: QuestionResponse[];
}

export interface SubmitQuizResponse {
  participationId: string;
  score: number;
  scorePercent: number;
  correctCount: number;
  wrongCount: number;
  pendingReviewCount: number;
  /** The answer key. Empty when `!resultsAvailable`. */
  key: QuestionAnswerKey[];
  /**
   * `false` for an assignment submitted before its due date — the correct
   * answers are withheld until the assignment is genuinely over. Always `true`
   * for a standalone practice quiz.
   */
  resultsAvailable: boolean;
  /** When `!resultsAvailable`, the assignment's due date (epoch ms) — otherwise `null`. */
  resultsAvailableAt: number | null;
}

/**
 * The one call that grades and records a quiz attempt (`POST /submissions`).
 *
 * The server grades, records the participation, releases a One Time Join lock
 * and notifies the parent and reviewer, all in one go. Kept apart from
 * `QuizRunnerService`, which is busy orchestrating a running quiz, and as a
 * seam for its tests. API requests skip `LoadingInterceptor`, so
 * `executeWithState` drives the spinner.
 */
@Injectable({ providedIn: 'root' })
export class QuizSubmissionService extends QuizSubmissionServiceWithState {
  private readonly api = inject(ApiClient);

  async submit(request: SubmitQuizRequest): Promise<SubmitQuizResponse> {
    return this.executeWithState(async () => {
      const target = request.target;
      const result = await this.api.post<ApiSubmissionResult>('/submissions', {
        homeworkId: 'homeworkId' in target ? Number(target.homeworkId) : null,
        bankQuizId: 'bankQuizId' in target ? target.bankQuizId : null,
        teacherQuizId: 'teacherQuizId' in target ? Number(target.teacherQuizId) : null,
        startedAt: request.startedAt ? new Date(request.startedAt).toISOString() : null,
        responses: request.responses
      });
      return {
        ...result,
        participationId: String(result.participationId),
        resultsAvailableAt: result.resultsAvailableAt ? new Date(result.resultsAvailableAt).getTime() : null
      };
    });
  }
}
