import { Routes } from '@angular/router';
import { guestGuard, studentGuard, userAdminGuard, applicationAdminGuard,
  platformAdminGuard,
  translationsAdminGuard, adminDashboardGuard, teacherGuard, childParticipationHistoryGuard } from './guards';

/**
 * Application routes with lazy loading and guards
 * Follows Single Responsibility Principle - routing configuration only
 */
export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./components/login/login.component')
      .then(m => m.LoginComponent),
    canActivate: [guestGuard],
    title: 'Login - QuizMaster'
  },
  {
    path: 'available-quizzes',
    loadComponent: () => import('./components/available-quizzes/available-quizzes.component')
      .then(m => m.AvailableQuizzesComponent),
    canActivate: [studentGuard],
    title: 'Available Quizzes - QuizMaster'
  },
  {
    path: 'quiz/:id',
    loadComponent: () => import('./quiz/quiz.component')
      .then(m => m.QuizComponent),
    canActivate: [studentGuard],
    title: 'Quiz - QuizMaster'
  },
  {
    // The bottom tab bar's Profile destination — same guard and account
    // shape as available-quizzes, since this is the same profile widget on
    // its own page rather than embedded in the quiz list's side panel.
    path: 'profile',
    loadComponent: () => import('./components/profile/profile.component')
      .then(m => m.ProfileComponent),
    canActivate: [studentGuard],
    title: 'Profile - QuizMaster'
  },
  {
    // A student's own submissions, each opening its answers.
    path: 'my-participations',
    loadComponent: () => import('./components/my-participations/my-participations.component')
      .then(m => m.MyParticipationsComponent),
    canActivate: [studentGuard],
    title: 'My Participations - QuizMaster'
  },
  {
    path: 'platform-admin',
    loadComponent: () => import('./components/platform-admin/platform-admin.component')
      .then(m => m.PlatformAdminComponent),
    canActivate: [platformAdminGuard],
    title: 'Organizations - QuizMaster'
  },
  {
    path: 'platform-admin/access-requests',
    loadComponent: () => import('./components/access-requests-admin/access-requests-admin.component')
      .then(m => m.AccessRequestsAdminComponent),
    canActivate: [platformAdminGuard],
    title: 'Access Requests - QuizMaster'
  },
  {
    path: 'application-admin',
    loadComponent: () => import('./components/application-admin/application-admin.component')
      .then(m => m.ApplicationAdminComponent),
    canActivate: [applicationAdminGuard],
    title: 'Application Admin - QuizMaster'
  },
  {
    path: 'registration-keys-admin',
    loadComponent: () => import('./components/registration-keys-admin/registration-keys-admin.component')
      .then(m => m.RegistrationKeysAdminComponent),
    canActivate: [applicationAdminGuard],
    title: 'Registration Keys Admin - QuizMaster'
  },
  {
    path: 'users-admin',
    loadComponent: () => import('./components/users-admin/users-admin.component')
      .then(m => m.UsersAdminComponent),
    canActivate: [applicationAdminGuard],
    title: 'Users Admin - QuizMaster'
  },
  {
    path: 'teachers-admin',
    loadComponent: () => import('./components/teachers-admin/teachers-admin.component')
      .then(m => m.TeachersAdminComponent),
    canActivate: [applicationAdminGuard],
    title: 'Teachers Admin - QuizMaster'
  },
  {
    path: 'translations-admin',
    loadComponent: () => import('./components/translations-admin/translations-admin.component')
      .then(m => m.TranslationsAdminComponent),
    canActivate: [translationsAdminGuard],
    title: 'Labels - QuizMaster'
  },
  {
    path: 'subjects-admin',
    loadComponent: () => import('./components/subjects-admin/subjects-admin.component')
      .then(m => m.SubjectsAdminComponent),
    canActivate: [applicationAdminGuard],
    title: 'Subjects Admin - QuizMaster'
  },
  {
    path: 'quizzes-admin',
    loadComponent: () => import('./components/quizzes-admin/quizzes-admin.component')
      .then(m => m.QuizzesAdminComponent),
    canActivate: [applicationAdminGuard],
    title: 'Quizzes Admin - QuizMaster'
  },
  {
    path: 'participations-history',
    loadComponent: () => import('./components/participations-history/participations-history.component')
      .then(m => m.ParticipationsHistoryComponent),
    canActivate: [applicationAdminGuard],
    title: 'Participations History - QuizMaster'
  },
  {
    path: 'admin-dashboard',
    loadComponent: () => import('./components/admin-dashboard/admin-dashboard.component')
      .then(m => m.AdminDashboardComponent),
    canActivate: [adminDashboardGuard],
    title: 'Admin Dashboard - QuizMaster'
  },
  {
    // A teacher's students: the server lists only the groups this teacher teaches (GET /me/students).
    path: 'my-students',
    loadComponent: () => import('./components/my-students/my-students.component')
      .then(m => m.MyStudentsComponent),
    canActivate: [teacherGuard],
    title: 'My Students - QuizMaster'
  },
  {
    path: 'parent-dashboard',
    loadComponent: () => import('./components/parent-dashboard/parent-dashboard.component')
      .then(m => m.ParentDashboardComponent),
    canActivate: [userAdminGuard],
    title: 'Parent Dashboard - QuizMaster'
  },
  {
    path: 'participation-history',
    loadComponent: () => import('./components/participation-history/participation-history.component')
      .then(m => m.ParticipationHistoryComponent),
    canActivate: [childParticipationHistoryGuard],
    title: 'Participation History - QuizMaster'
  },
  {
    // Shell + one child route per tab (see quiz-management.routes.ts) — the
    // guard on the parent covers every child, since guards run for the whole
    // activation path.
    path: 'quiz-management',
    loadChildren: () => import('./components/quiz-management/quiz-management.routes')
      .then(m => m.QUIZ_MANAGEMENT_ROUTES),
    canActivate: [teacherGuard],
    title: 'Work Management - QuizMaster'
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];
