import { Component, ChangeDetectionStrategy } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { UserAdminDashboardViewComponent } from '../admin-dashboard/views/user-admin-dashboard-view.component';

/**
 * Dedicated landing page for Parent Admins (userAdmin role) — split out of the
 * shared `admin-dashboard` shell so Parent Admins get their own route instead
 * of one branch of that component's role switch. Renders the same
 * {@link UserAdminDashboardViewComponent} the shared shell used to.
 */
@Component({
  selector: 'app-parent-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, UserAdminDashboardViewComponent],
  templateUrl: './parent-dashboard.component.html',
})
export class ParentDashboardComponent {}
