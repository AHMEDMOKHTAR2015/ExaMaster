import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { HomeworkAssignment } from '../../../models';
import { QuizManagementStateService } from '../quiz-management-state.service';

/**
 * "Quizzes & Assignments" tab — the list of everything this teacher has
 * assigned, after the workspace filter bar.
 *
 * Owns no state of its own: the list, the filters and the assignment form all
 * live on {@link QuizManagementStateService}, which the `/quiz-management`
 * route provides.
 */
@Component({
  selector: 'app-assignments-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './assignments-tab.component.html',
})
export class AssignmentsTabComponent {
  readonly state = inject(QuizManagementStateService);
  private readonly router = inject(Router);

  /** Select the assignment and jump to the Participation tab to watch it. */
  trackAssignment(assignment: HomeworkAssignment): void {
    this.state.selectedAssignmentId.set(assignment.id);
    this.router.navigate(['/quiz-management/participation']);
  }
}
