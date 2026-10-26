import { Routes } from '@angular/router';
import { guestGuard, studentGuard, userAdminGuard, applicationAdminGuard,
  platformAdminGuard,
  translationsAdminGuard, adminDashboardGuard, teacherGuard, childParticipationHistoryGuard, myChildrenGuard,
  teachingMaterialsGuard, teachingRoomsGuard } from './guards';

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
    // Course material uploaded as teaching-summary documents: a teacher's own, or every teacher's for an admin.
    path: 'teaching-materials',
    loadComponent: () => import('./components/teaching-materials/teaching-materials.component')
      .then(m => m.TeachingMaterialsComponent),
    canActivate: [teachingMaterialsGuard],
    title: 'Teaching Materials - QuizMaster'
  },
  {
    path: 'teaching-materials/:id',
    loadComponent: () => import('./components/teaching-materials/material-reader.component')
      .then(m => m.MaterialReaderComponent),
    canActivate: [teachingMaterialsGuard],
    title: 'Teaching Material - QuizMaster'
  },
  {
    // A teacher's live rooms, or the rooms open to a student's class.
    path: 'teaching-rooms',
    loadComponent: () => import('./components/teaching-rooms/teaching-rooms.component')
      .then(m => m.TeachingRoomsComponent),
    canActivate: [teachingRoomsGuard],
    title: 'Teaching Rooms - QuizMaster'
  },
  {
    // One room's live board. The path keeps the casing it is shared with (/TeachingRoom/42); the API and its hub
    // decide who may see the board.
    path: 'TeachingRoom/:id',
    loadComponent: () => import('./components/teaching-room/teaching-room.component')
      .then(m => m.TeachingRoomComponent),
    canActivate: [teachingRoomsGuard],
    title: 'Teaching Room - QuizMaster'
  },
  {
    path: 'parent-dashboard',
    loadComponent: () => import('./components/parent-dashboard/parent-dashboard.component')
      .then(m => m.ParentDashboardComponent),
    canActivate: [userAdminGuard],
    title: 'Parent Dashboard - QuizMaster'
  },
  {
    // A parent's children, each card opening that child's profile. The API serves only the caller's own children.
    path: 'my-children',
    loadComponent: () => import('./components/my-children/my-children.component')
      .then(m => m.MyChildrenComponent),
    canActivate: [myChildrenGuard],
    title: 'My Children - QuizMaster'
  },
  {
    path: 'my-children/:id',
    loadComponent: () => import('./components/my-children/child-profile.component')
      .then(m => m.ChildProfileComponent),
    canActivate: [myChildrenGuard],
    title: 'Child Profile - QuizMaster'
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
