import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { HomeworkSemester } from '../../../models';
import { sumAssignmentResults, AssignmentResult, AssignmentResultRow } from '../../../shared/quiz-management';
import { HomeworkService } from '../../../services/homework.service';
import { NotificationService } from '../../../services/notification.service';
import { QuizManagementStateService } from '../quiz-management-state.service';

/** A subject/semester roll-up of assignment results for the Results tab. */
interface GroupedResult {
  key: string;
  label: string;
  color?: string;
  result: AssignmentResult;
}

/**
 * "Results" tab — completion and score roll-ups across the filtered
 * assignments, overall and broken down by subject and semester.
 *
 * The API works out each assignment's progress for the filter bar's selection
 * (`GET /assignments/results`); this tab only adds the rows up into groups, so
 * it never reads a submission itself.
 */
@Component({
    selector: 'app-results-tab',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, TranslatePipe],
    templateUrl: './results-tab.component.html'
})
export class ResultsTabComponent {
  readonly state = inject(QuizManagementStateService);
  private readonly homeworkService = inject(HomeworkService);
  private readonly notification = inject(NotificationService);

  private readonly rows = signal<AssignmentResultRow[]>([]);
  readonly isLoading = signal(false);
  private generation = 0;

  constructor() {
    // Re-ask the API whenever the filter bar or the shell's Refresh changes what is in view.
    effect(() => {
      this.state.appliedFilter(); this.state.refreshTick();
      untracked(() => void this.load());
    });
  }

  /** A later load wins over a slower earlier one (the filter changed meanwhile). */
  private async load(): Promise<void> {
    const run = ++this.generation;
    this.isLoading.set(true);
    try {
      const rows = await this.homeworkService.listResults(this.state.appliedFilter());
      if (run === this.generation) this.rows.set(rows);
    } catch {
      if (run === this.generation) this.notification.error('Failed to load the results.');
    } finally {
      if (run === this.generation) this.isLoading.set(false);
    }
  }

  /** Per-assignment results, each with the subject and semester the API counted it under. */
  readonly loadedResults = this.rows.asReadonly();

  readonly overallResult = computed<AssignmentResult>(() =>
    sumAssignmentResults(this.loadedResults().map(r => r.result))
  );

  readonly resultsBySubject = computed<GroupedResult[]>(() => {
    const groups = new Map<string, AssignmentResult[]>();
    for (const { subjectId, result } of this.loadedResults()) {
      const key = subjectId ?? '';
      const arr = groups.get(key) ?? [];
      arr.push(result);
      groups.set(key, arr);
    }
    return [...groups.entries()].map(([subjectId, results]) => ({
      key: subjectId || 'general',
      label: subjectId ? this.state.getSubjectName(subjectId) : 'General',
      color: subjectId ? this.state.getSubjectColor(subjectId) : undefined,
      result: sumAssignmentResults(results)
    }));
  });

  readonly resultsBySemester = computed<GroupedResult[]>(() => {
    const groups = new Map<string, AssignmentResult[]>();
    for (const { semester, result } of this.loadedResults()) {
      const key = semester ?? 'unspecified';
      const arr = groups.get(key) ?? [];
      arr.push(result);
      groups.set(key, arr);
    }
    return [...groups.entries()].map(([key, results]) => ({
      key,
      label: key === 'unspecified' ? 'Unspecified' : this.state.getSemesterLabel(key as HomeworkSemester),
      result: sumAssignmentResults(results)
    }));
  });
}
