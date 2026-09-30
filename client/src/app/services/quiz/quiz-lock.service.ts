import { Injectable, inject } from '@angular/core';
import { QuizAttemptLock, QuizExitReason, QuizLockStatus } from '../../models';
import { ApiClient } from '../api/api-client.service';
import { ApiAttemptExitReason, ApiAttemptLock, ApiAttemptLockStatus, idString } from '../api/api-models';
import { SittingTarget } from '../quiz.service';
import { QuizAttemptScope, attemptScopeKey } from '../../shared/quiz-attempt-scope';

/**
 * The "One Time Join" containment record (`/attempt-locks`): who is inside a
 * quiz, who walked out of one, and who a teacher has let back in.
 *
 * Two things about it are load-bearing, and both are the server's now:
 *
 * - **The lock is taken when the attempt opens, not when it ends.** Writing it
 *   on the way out would be a best-effort client write that a killed tab or a
 *   pulled network simply never makes. Because a lock exists from the first
 *   moment, re-entry is denied by the *absence of a completion* rather than by
 *   the presence of an exit event, so force-quitting fails in the safe
 *   direction. `POST /attempt-locks` refuses to open a second one.
 * - **Only a teacher or the submission may release one.** A student can open
 *   theirs and report leaving it, nothing else — so defeating every client-side
 *   guard in {@link QuizLockdownService} still leaves them locked out.
 *
 * A lock is matched to a piece of work by `scopeKey`, which the client builds
 * the same way the server does (`attemptScopeKey`).
 */
@Injectable({ providedIn: 'root' })
export class QuizLockService {
  private readonly api = inject(ApiClient);

  /** The signed-in student's lock on this piece of work, if any. */
  async findMine(scope: QuizAttemptScope): Promise<QuizAttemptLock | null> {
    const key = attemptScopeKey(scope);
    return (await this.listMine()).find(lock => lock.scopeKey === key) ?? null;
  }

  /** Open the attempt. Refused (with the reason) while a previous sitting of the same work is still locked. */
  async begin(target: SittingTarget): Promise<QuizAttemptLock> {
    return toLock(await this.api.post<ApiAttemptLock>('/attempt-locks', {
      homeworkId: 'homeworkId' in target ? Number(target.homeworkId) : null,
      bankQuizId: 'bankQuizId' in target ? target.bankQuizId : null,
      teacherQuizId: 'teacherQuizId' in target ? Number(target.teacherQuizId) : null
    }));
  }

  /** The student was seen leaving. Bookkeeping for the teacher: the lock already blocks re-entry. */
  async recordExit(lock: QuizAttemptLock, reason: QuizExitReason): Promise<void> {
    await this.api.post(`/attempt-locks/${lock.id}:exit`, { reason: EXIT_REASONS[reason] });
  }

  /** A teacher lets the student back in. */
  async release(lock: QuizAttemptLock): Promise<void> {
    await this.api.post(`/attempt-locks/${lock.id}:release`, {});
  }

  /** A teacher clears the record entirely, so the student starts afresh. */
  async reset(lock: QuizAttemptLock): Promise<void> {
    await this.api.delete(`/attempt-locks/${lock.id}`);
  }

  async listMine(): Promise<QuizAttemptLock[]> {
    return (await this.api.get<{ locks: ApiAttemptLock[] }>('/attempt-locks/mine')).locks.map(toLock);
  }

  /** Staff: the locks on one assignment. */
  async listForHomework(homeworkId: string): Promise<QuizAttemptLock[]> {
    if (!Number(homeworkId)) return [];                  // an id from before the move names nothing here
    return (await this.api.get<{ locks: ApiAttemptLock[] }>('/attempt-locks', { homeworkId: Number(homeworkId) })).locks.map(toLock);
  }
}

export function isBlocking(lock: QuizAttemptLock | null | undefined): boolean {
  return !!lock && lock.status !== 'released';
}

const STATUSES: Record<ApiAttemptLockStatus, QuizLockStatus> = { InProgress: 'in-progress', Locked: 'locked', Released: 'released' };
const EXIT_REASONS: Record<QuizExitReason, ApiAttemptExitReason> = {
  closed: 'Closed', hidden: 'Hidden', navigated: 'Navigated', 'fullscreen-exit': 'FullscreenExit'
};

function toLock(lock: ApiAttemptLock): QuizAttemptLock {
  const reason = Object.entries(EXIT_REASONS).find(([, api]) => api === lock.lastExitReason)?.[0] as QuizExitReason | undefined;
  return {
    id: String(lock.id),
    childId: String(lock.childId),
    childName: lock.childName,
    scopeKey: lock.scopeKey,
    quizId: lock.bankQuizId ?? 0,
    quizName: lock.quizName,
    homeworkId: idString(lock.homeworkId) ?? null,
    classId: idString(lock.classId) ?? null,
    status: STATUSES[lock.status],
    startedAt: new Date(lock.startedOn).getTime(),
    lockedAt: lock.lockedOn ? new Date(lock.lockedOn).getTime() : null,
    exitAttempts: lock.exitAttempts,
    lastExitReason: reason ?? null,
    releasedAt: lock.releasedOn ? new Date(lock.releasedOn).getTime() : null,
    releasedBy: idString(lock.releasedById) ?? null
  };
}
