import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { HomeworkAssignment, HomeworkSemester } from '../../../models';
import {
  effectiveSubjectId, effectiveSemester,
  computeAssignmentResult, sumAssignmentResults, AssignmentResult
} from '../../../shared/quiz-management';
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
 * Every roll-up is derived from the participation cache, so the tab fetches
 * records for whatever the filter bar currently selects and recomputes as they
 * land.
 */
@Component({
    selector: 'app-results-tab',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, TranslatePipe],
    templateUrl: './results-tab.component.html'
})
export class ResultsTabComponent {
  readonly state = inject(QuizManagementStateService);

  constructor() {
    // Re-fetch whenever the filter bar changes the set in view. `untracked`
    // keeps the cache write inside `loadRecordsFor` from re-triggering this.
    effect(() => {
      const assignments = this.state.filteredAssignments();
      untracked(() => void this.state.loadRecordsFor(assignments));
    });
  }

  /** Per-assignment results for the filtered set whose records are loaded. */
  readonly loadedResults = computed(() => {
    const cache = this.state.recordsByAssignment();
    return this.state.filteredAssignments()
      .map(a => {
        const records = cache.get(a.id);
        if (!records) return null;
        const byChild = new Map(records.map(r => [r.childId, r]));
        const targets = this.state.targetStudentsOf(a).map(t => t.uid);
        return { assignment: a, result: computeAssignmentResult(targets, byChild, a.dueAt) };
      })
      .filter((x): x is { assignment: HomeworkAssignment; result: AssignmentResult } => x !== null);
  });

  readonly overallResult = computed<AssignmentResult>(() =>
    sumAssignmentResults(this.loadedResults().map(r => r.result))
  );

  readonly resultsBySubject = computed<GroupedResult[]>(() => {
    const quizById = this.state.quizById();
    const groups = new Map<string, AssignmentResult[]>();
    for (const { assignment, result } of this.loadedResults()) {
      const subjectId = effectiveSubjectId(assignment, quizById) ?? '';
      const arr = groups.get(subjectId) ?? [];
      arr.push(result);
      groups.set(subjectId, arr);
    }
    return [...groups.entries()].map(([subjectId, results]) => ({
      key: subjectId || 'general',
      label: subjectId ? this.state.getSubjectName(subjectId) : 'General',
      color: subjectId ? this.state.getSubjectColor(subjectId) : undefined,
      result: sumAssignmentResults(results)
    }));
  });

  readonly resultsBySemester = computed<GroupedResult[]>(() => {
    const quizById = this.state.quizById();
    const groups = new Map<string, AssignmentResult[]>();
    for (const { assignment, result } of this.loadedResults()) {
      const semester = effectiveSemester(assignment, quizById);
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
