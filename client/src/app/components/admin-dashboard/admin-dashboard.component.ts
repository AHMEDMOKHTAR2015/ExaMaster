import { Component, inject, computed, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../services/auth';
import { AdminAccessService } from '../../services/admin';
import { AdminRoleStrategy } from '../../interfaces';

// Import the view components
import { ApplicationAdminDashboardViewComponent } from './views/application-admin-dashboard-view.component';
import { TeacherDashboardViewComponent } from './views/teacher-dashboard-view.component';
import { NoAccessViewComponent } from './views/no-access-view.component';

/**
 * Shared shell for applicationAdmin/teacher/none. Parent Admins (userAdmin)
 * have their own dedicated route/component — `/parent-dashboard` — instead of
 * a branch here; `adminDashboardGuard` redirects them there before this
 * component ever renders, so `roleType()` is never `'userAdmin'` in practice.
 */
@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslatePipe,
    ApplicationAdminDashboardViewComponent,
    TeacherDashboardViewComponent,
    NoAccessViewComponent
  ],
  templateUrl: './admin-dashboard.component.html',
})
export class AdminDashboardComponent {
  private readonly authService = inject(AuthService);
  private readonly adminAccessService = inject(AdminAccessService);

  readonly user = this.authService.user;
  readonly isLoading = signal<boolean>(false);

  readonly strategy = computed<AdminRoleStrategy>(() => {
    const roles = this.authService.getUserRoles();
    return this.adminAccessService.getStrategy(roles);
  });

  readonly roleType = computed(() => this.strategy().getRoleType());
  readonly isTeacher = computed(() => this.roleType() === 'teacher');
  readonly hasNoAdminAccess = computed(() => this.roleType() === 'none');

  readonly dashboardTitleKey = computed(() => {
    const r = this.roleType();
    return r === 'applicationAdmin' || r === 'teacher'
      ? `dashboard.title.${r}`
      : 'dashboard.title.default';
  });

  readonly dashboardSubtitleKey = computed(() => {
    const r = this.roleType();
    return r === 'applicationAdmin' || r === 'teacher'
      ? `dashboard.subtitle.${r}`
      : 'dashboard.subtitle.default';
  });
}

