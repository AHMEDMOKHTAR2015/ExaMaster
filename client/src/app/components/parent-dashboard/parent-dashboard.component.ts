import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { UserAdminDashboardViewComponent } from '../admin-dashboard/views/user-admin-dashboard-view.component';

/**
 * Dedicated landing page for Parent Admins (userAdmin role) — split out of the
 * shared `admin-dashboard` shell so Parent Admins get their own route instead
 * of one branch of that component's role switch. Renders the same
 * {@link UserAdminDashboardViewComponent} the shared shell used to, and links
 * to My Children, where each child has a full profile.
 */
@Component({
    selector: 'app-parent-dashboard',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterLink, TranslatePipe, UserAdminDashboardViewComponent],
    templateUrl: './parent-dashboard.component.html'
})
export class ParentDashboardComponent {}
