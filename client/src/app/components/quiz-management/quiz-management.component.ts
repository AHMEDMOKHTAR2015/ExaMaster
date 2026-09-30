import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ClickOutsideDirective, LoadingButtonDirective } from '../../directives';
import { QuizManagementStateService } from './quiz-management-state.service';

/**
 * Teacher Quiz Management workspace — a centralized, subject/semester-filtered
 * home for everything a teacher does with quizzes and homework: review what's
 * assigned, assign new work, track participation, analyze results, and validate
 * homework submissions.
 *
 * This component is only the shell: the page header, the KPI tiles, the global
 * filter bar, the tab strip and the assignment form. Each tab is its own routed
 * component under `tabs/`, so a teacher can reach one either by clicking the tab
 * here or straight from the sidebar. Everything the tabs share — the teacher's
 * scope, the filters, the participation cache — lives on
 * {@link QuizManagementStateService}, which the route provides so a single
 * instance spans the shell and whichever tab is showing.
 */
@Component({
  selector: 'app-quiz-management',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, TranslatePipe, RouterOutlet, RouterLink, RouterLinkActive,
    ClickOutsideDirective, LoadingButtonDirective
  ],
  templateUrl: './quiz-management.component.html',
})
export class QuizManagementComponent implements OnInit {
  readonly state = inject(QuizManagementStateService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    void this.state.init();
  }

  /**
   * Save the assignment form, then show the teacher the list it landed in —
   * the pre-split version switched the active tab back to Assignments here, and
   * with tabs as routes that switch is a navigation.
   */
  async submitAssignment(): Promise<void> {
    if (await this.state.submitAssignment()) {
      await this.router.navigate(['/quiz-management/assignments']);
    }
  }
}
