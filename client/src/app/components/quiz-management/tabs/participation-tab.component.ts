import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { QuizManagementStateService } from '../quiz-management-state.service';
import { AuthService } from '../../../services/auth';
import { NotificationService } from '../../../services/notification.service';
import { QuizLockService, isBlocking } from '../../../services/quiz/quiz-lock.service';
import { QuizAttemptLock } from '../../../models';

/** One student's row in the participation-tracking table. */
interface TrackingRow {
  uid: string;
  name: string;
  status: 'completed' | 'in-progress' | 'overdue' | 'not-started';
  /**
   * Questions answered correctly / incorrectly, `null` until the attempt is
   * completed.
   *
   * Deliberately not the record's `score`: despite the name that field is a raw
   * correct-answer count, not a percentage (the percentage is `scorePercent`, or
   * `participationScorePercent()` for records predating it). The row used to
   * render `score` with a `%` sign appended, so 7 correct out of 10 displayed as
   * "7%".
   */
  correctCount: number | null;
  wrongCount: number | null;
  endedAt: number | null;
  /**
   * This student's "One Time Join" containment record for the assignment, when
   * there is one. Present and unreleased means they are locked out and only a
   * teacher can change that — which is what the row's Unlock button does.
   */
  lock: QuizAttemptLock | null;
  /** Convenience for the template; `lock` alone would need the predicate inline. */
  isLocked: boolean;
}

/**
 * "Participation" tab — live per-student progress for one chosen assignment.
 *
 * The assignment is picked either from this tab's own dropdown or by the
 * Assignments tab's "Track" button, which sets
 * {@link QuizManagementStateService.selectedAssignmentId} before navigating
 * here; either way the selection outlives tab switches because the state
 * service is scoped to the whole `/quiz-management` route subtree.
 */
@Component({
  selector: 'app-participation-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './participation-tab.component.html',
})
export class ParticipationTabComponent {
  readonly state = inject(QuizManagementStateService);
  private readonly quizLockService = inject(QuizLockService);
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);

  /**
   * Containment locks for the selected assignment, keyed by student uid.
   *
   * Loaded here rather than in the shared state service because this is the
   * only view that acts on them, and the query is one small read per assignment
   * a teacher actually opens.
   */
  private readonly locksByChild = signal<Map<string, QuizAttemptLock>>(new Map());

  /** uid currently being unlocked/reset, so only that row's buttons spin. */
  readonly pendingLockAction = signal<string | null>(null);

  constructor() {
    // Records are fetched per assignment on demand. `untracked` keeps the write
    // inside `loadRecordsFor` from re-triggering this effect through the cache
    // signal it reads — only the selection should drive a fetch.
    effect(() => {
      const assignment = this.state.selectedAssignment();
      if (assignment) untracked(() => {
        void this.state.loadRecordsFor([assignment]);
        void this.loadLocks(assignment.id);
      });
    });
  }

  readonly participationRows = computed<TrackingRow[]>(() => {
    const assignment = this.state.selectedAssignment();
    if (!assignment) return [];
    const records = this.state.recordsByAssignment().get(assignment.id);
    if (!records) return [];
    const byChild = new Map(records.map(r => [r.childId, r]));
    const overdue = assignment.dueAt < Date.now();
    return this.state.targetStudentsOf(assignment).map<TrackingRow>(target => {
      const record = byChild.get(target.uid);
      const lock = this.locksByChild().get(target.uid) ?? null;
      let status: TrackingRow['status'];
      if (record?.status === 'completed') status = 'completed';
      else if (record?.status === 'in-progress') status = 'in-progress';
      else status = overdue ? 'overdue' : 'not-started';
      return {
        uid: target.uid,
        name: target.name,
        status,
        correctCount: record?.status === 'completed' ? record.correctCount : null,
        wrongCount: record?.status === 'completed' ? record.wrongCount : null,
        endedAt: record?.status === 'completed' ? record.endedAt : null,
        lock,
        isLocked: isBlocking(lock)
      };
    });
  });

  readonly participationCompletedCount = computed(() =>
    this.participationRows().filter(r => r.status === 'completed').length
  );

  /** Students this assignment has locked out, for the header count. */
  readonly lockedCount = computed(() => this.participationRows().filter(r => r.isLocked).length);

  onSelectAssignment(assignmentId: string): void {
    this.state.selectedAssignmentId.set(assignmentId || null);
  }

  /**
   * Let one student back into the attempt they walked out of.
   *
   * Keeps the attempt: their answers so far, their elapsed time and their exit
   * count all survive, and the record shows who lifted it. Use
   * {@link resetLock} instead to make it a fresh sitting.
   */
  async unlock(row: TrackingRow): Promise<void> {
    const lock = row.lock;
    const teacher = this.authService.user();
    if (!lock || !teacher) return;
    this.pendingLockAction.set(row.uid);
    try {
      await this.quizLockService.release(lock);
      this.notificationService.success('Student unlocked.');
      await this.reloadLocks();
    } catch {
      this.notificationService.error('Could not unlock this student. Please try again.');
    } finally {
      this.pendingLockAction.set(null);
    }
  }

  /**
   * Forget the attempt entirely, so the student starts over from the
   * confirmation dialog. Distinct from {@link unlock}, which resumes.
   */
  async resetLock(row: TrackingRow): Promise<void> {
    const lock = row.lock;
    if (!lock) return;
    this.pendingLockAction.set(row.uid);
    try {
      await this.quizLockService.reset(lock);
      this.notificationService.success('Access reset. The student can start again.');
      await this.reloadLocks();
    } catch {
      this.notificationService.error('Could not reset this student. Please try again.');
    } finally {
      this.pendingLockAction.set(null);
    }
  }

  private reloadLocks(): Promise<void> {
    const assignment = this.state.selectedAssignment();
    return assignment ? this.loadLocks(assignment.id) : Promise.resolve();
  }

  /**
   * Locks are advisory information on this screen — a failed read must not
   * blank out the participation table around it, so it degrades to "no locks
   * known" rather than an error state.
   */
  private async loadLocks(assignmentId: string): Promise<void> {
    try {
      const locks = await this.quizLockService.listForHomework(assignmentId);
      this.locksByChild.set(new Map(locks.map(lock => [lock.childId, lock])));
    } catch {
      this.locksByChild.set(new Map());
    }
  }
}
