import { Directive, EmbeddedViewRef, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { AdminRole } from '../models';
import { AuthService } from '../services/auth';

/**
 * Structural directive gating template content on the current user's roles,
 * read directly from `AuthService.user()`. Accepts a single role or an array
 * (OR semantics — any match renders the content), e.g.:
 *   <ng-container *appHasRole="'teacher'">...</ng-container>
 *   <ng-container *appHasRole="['userAdmin', 'applicationAdmin']">...</ng-container>
 *
 * Intended for new role-gated markup. Existing per-component role computeds
 * (e.g. AppComponent.isTeacher, AdminDashboardComponent.roleType) are left
 * as-is: they're also consumed by non-template TS logic (routing, dashboard
 * view selection), and AdminDashboardComponent's roleType is an exclusive
 * pick via AdminRoleStrategy priority, not an inclusive "has role" check —
 * swapping it for this directive would silently change which dashboard view
 * renders for users holding more than one role.
 */
@Directive({
  selector: '[appHasRole]',
  standalone: true
})
export class HasRoleDirective {
  readonly appHasRole = input.required<AdminRole | AdminRole[]>();

  private readonly authService = inject(AuthService);
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private view: EmbeddedViewRef<unknown> | null = null;

  constructor() {
    effect(() => {
      const required = this.appHasRole();
      const requiredRoles = Array.isArray(required) ? required : [required];
      const userRoles = this.authService.user()?.roles ?? [];
      const hasRole = requiredRoles.some(role => userRoles.includes(role));

      if (hasRole && !this.view) {
        this.view = this.viewContainerRef.createEmbeddedView(this.templateRef);
      } else if (!hasRole && this.view) {
        this.viewContainerRef.clear();
        this.view = null;
      }
    });
  }
}
