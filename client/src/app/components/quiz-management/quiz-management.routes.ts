import { Routes } from '@angular/router';
import { QuizManagementStateService } from './quiz-management-state.service';

/**
 * The teacher workspace: a shell component holding the filter bar and tab strip,
 * with one child route per tab.
 *
 * {@link QuizManagementStateService} is provided *here* rather than in `root` so
 * the teacher's scope is loaded once for the whole workspace and shared by every
 * tab, then thrown away when the teacher navigates out. Tabs are routes rather
 * than a local signal so the sidebar can deep-link straight into one.
 */
export const QUIZ_MANAGEMENT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./quiz-management.component')
      .then(m => m.QuizManagementComponent),
    providers: [QuizManagementStateService],
    children: [
      { path: '', redirectTo: 'assignments', pathMatch: 'full' },
      {
        path: 'assignments',
        loadComponent: () => import('./tabs/assignments-tab.component')
          .then(m => m.AssignmentsTabComponent),
        title: 'Assignments - QuizMaster'
      },
      {
        path: 'my-quizzes',
        loadComponent: () => import('./tabs/my-quizzes-tab.component')
          .then(m => m.MyQuizzesTabComponent),
        title: 'My Quizzes - QuizMaster'
      },
      {
        path: 'participation',
        loadComponent: () => import('./tabs/participation-tab.component')
          .then(m => m.ParticipationTabComponent),
        title: 'Participation - QuizMaster'
      },
      {
        path: 'results',
        loadComponent: () => import('./tabs/results-tab.component')
          .then(m => m.ResultsTabComponent),
        title: 'Results - QuizMaster'
      },
      {
        path: 'validation',
        loadComponent: () => import('./tabs/validation-tab.component')
          .then(m => m.ValidationTabComponent),
        title: 'Validation - QuizMaster'
      }
    ]
  }
];
