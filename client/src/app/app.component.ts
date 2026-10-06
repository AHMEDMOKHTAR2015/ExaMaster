import { Component, inject, computed, signal, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';
import { AuthService, resolvePostLoginRoute, STUDENT_HOME_ROUTE } from './services/auth';
import { AdminAccessService } from './services/admin';
import { LanguageService } from './services/language.service';
import { NotificationCenterService } from './services/notification-center.service';
import { TeacherReviewQueueService } from './services/teacher-review-queue.service';
import { RealtimeService } from './services/realtime/realtime.service';
import { TenantService } from './services/tenant/tenant.service';
import { QuizLockdownService } from './services/quiz/quiz-lockdown.service';
import { TranslationOverridesService } from './services/i18n/translation-overrides.service';
import { AccessRequestService } from './services/access-requests/access-request.service';
import { AppNotification } from './models';
import { routeAnimation } from './shared/animations';
import { LoadingSpinnerComponent } from './components/loading-spinner/loading-spinner.component';
import { ChangePasswordDialogComponent } from './components/change-password/change-password-dialog.component';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'app-root',
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './app.component.html',
    animations: [routeAnimation],
    imports: [RouterOutlet, RouterLink, RouterLinkActive, LoadingSpinnerComponent, TranslatePipe, DatePipe, ChangePasswordDialogComponent]
})
export class AppComponent {
  private readonly authService = inject(AuthService);
  private readonly adminAccessService = inject(AdminAccessService);
  /** Started with the shell: the live channel that keeps the inbox and the Validation badge current. */
  private readonly realtime = inject(RealtimeService);

  /** The signed-in person's own "Change password" dialog, opened from the sidebar. */
  readonly showChangePassword = signal(false);

  private readonly notificationCenter = inject(NotificationCenterService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  readonly lang = inject(LanguageService);
  readonly notifications = this.notificationCenter.items;
  readonly unreadCount = this.notificationCenter.unreadCount;

  /**
   * Submissions awaiting this teacher's review, badged on the sidebar's
   * Validation link. Published by the Quiz Management workspace rather than
   * fetched here — see {@link TeacherReviewQueueService} for why there is no
   * cheap query for it.
   */
  readonly pendingReviewCount = inject(TeacherReviewQueueService).pendingCount;

  /** Access requests waiting for the platform administrator, badged on their sidebar link. */
  readonly pendingAccessRequestCount = inject(AccessRequestService).pendingCount;

  /**
   * The organization the signed-in user belongs to. Empty for the vendor's
   * `platformAdmin`, who is a member of none, so the sidebar simply omits it.
   */
  readonly tenantName = inject(TenantService).name;

  /**
   * True while a "One Time Join" quiz is being sat, which takes the whole app
   * shell off screen — sidebar, topbar, notifications, language toggle and the
   * mobile drawer toggle — leaving only the quiz.
   *
   * Read from {@link QuizLockdownService} rather than from `QuizRunnerService`
   * on purpose: the shell has no business importing the quiz-taking stack to
   * decide whether to draw navigation, and the lockdown service imports nothing
   * of its own, so this cannot become a cycle.
   */
  readonly isLockedDown = inject(QuizLockdownService).isActive;

  /**
   * Injected here to bootstrap it — nothing else references it, but it has to
   * exist for a school's customised labels to be merged at all.
   */
  private readonly overrides = inject(TranslationOverridesService);

  // Expose auth loading state for the initial full-page app loading screen.
  // Keyed off `authReady` (set once, on first session-restore) rather than
  // the generic `authService.isLoading`, which also toggles for every later
  // sign-in/out/register call — gating on that tore down and recreated the
  // routed page (e.g. login) on every subsequent auth action.
  // Also waits on the label overrides. `authReady` flips in the same tick the
  // tenant is set, before the overrides request returns, so gating on it alone
  // would paint the shipped labels and then visibly swap them a moment later.
  // `settled()` is immediate when signed out, and self-releases on a timeout so
  // an unreachable server can never hold this screen open.
  readonly isAuthLoading = computed(() =>
    !this.authService.authReady() || !this.overrides.settled()
  );
  readonly isAuthenticated = this.authService.isAuthenticated;
  readonly user = this.authService.user;
  
  readonly isUserAdmin = computed(() => {
    const u = this.user();
    const result = u?.roles?.includes('userAdmin') || u?.roles?.includes('applicationAdmin') || false;
    return result;
  });
  
  readonly isApplicationAdmin = computed(() => {
    const u = this.user();
    const result = u?.roles?.includes('applicationAdmin') || false;
    return result;
  });

  readonly isTeacher = computed(() => {
    const u = this.user();
    return u?.roles?.includes('teacher') || false;
  });

  /**
   * Exclusive role (via strategy priority: applicationAdmin > userAdmin >
   * teacher), true only for actual Parent Admins — unlike `isUserAdmin` above,
   * which also includes application admins. Drives routing to the Parent
   * Admin's own dedicated dashboard instead of the shared admin-dashboard.
   */
  readonly isParentAdminOnly = computed(() => {
    return this.adminAccessService.getStrategy(this.user()?.roles).getRoleType() === 'userAdmin';
  });

  /** The vendor: their own sidebar section (organizations, access requests), and none of a school's. */
  readonly isPlatformAdmin = computed(() => this.user()?.roles?.includes('platformAdmin') ?? false);

  /**
   * Check if user has any admin role (for admin dashboard access)
   */
  readonly hasAdminAccess = computed(() => {
    const u = this.user();
    return u?.roles?.includes('userAdmin') || u?.roles?.includes('applicationAdmin') || u?.roles?.includes('teacher') || false;
  });

  /**
   * Where the wordmark takes you — the same answer `AuthService` gives right
   * after sign-in and the same one every guard falls back to, because it is
   * literally the same function. The hand-rolled version this replaces knew
   * about userAdmin, applicationAdmin and teacher, and so dropped the vendor's
   * `platformAdmin` through to `/available-quizzes` — a student route they
   * cannot use and whose data belongs to a tenant they are not in.
   */
  readonly homeRoute = computed(() => {
    const roles = this.user()?.roles;
    return resolvePostLoginRoute(roles ?? [], this.adminAccessService.getStrategy(roles));
  });

  /**
   * Whether to show the student side of the sidebar. Derived from `homeRoute`
   * rather than `!hasAdminAccess()`: that negation was true for `platformAdmin`
   * too, so the vendor saw a "Learn / Available Quizzes" nav item.
   */
  readonly isStudentNav = computed(() => this.homeRoute() === STUDENT_HOME_ROUTE);

  /**
   * Which bottom tab bar this person gets below 900px, or none. Students and
   * parents get their own destinations. Staff navigate deeper trees than four
   * tabs can hold, so their bar carries their three most-used destinations and
   * a Menu tab that opens the drawer for the rest; the platform administrator's
   * carries their two plus Menu. When someone holds several roles the broadest
   * wins (platform, then application admin, then teacher).
   */
  readonly tabbarSet = computed<'student' | 'parent' | 'applicationAdmin' | 'teacher' | 'platform' | null>(() => {
    if (this.isPlatformAdmin()) return 'platform';
    if (this.isApplicationAdmin()) return 'applicationAdmin';
    if (this.isTeacher()) return 'teacher';
    if (this.isStudentNav()) return 'student';
    if (this.isParentAdminOnly()) return 'parent';
    return null;
  });

  readonly showTabbar = computed(() => this.tabbarSet() !== null);

  /** Target for the sidebar "Dashboard" nav item — same split as `homeRoute`. */
  readonly dashboardRoute = computed(() => {
    return this.isParentAdminOnly() ? '/parent-dashboard' : '/admin-dashboard';
  });

  /**
   * Route for the prominent "Create New Quiz" sidebar CTA.
   * Application admins manage quizzes at /quizzes-admin; teachers at the
   * workspace's My Quizzes tab, which owns the custom quiz builder that
   * `?action=create` opens.
   */
  readonly createQuizRoute = computed(() => {
    return this.isApplicationAdmin() ? '/quizzes-admin' : '/quiz-management/my-quizzes';
  });

  readonly userInitials = computed(() => {
    const name = this.user()?.displayName?.trim();
    if (!name) return 'U';
    const parts = name.split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  });

  /** Translation key for the sidebar's "Profile:" line. `platformAdmin` is
   *  checked first: the vendor holds none of the school roles, so falling
   *  through would label them a student. */
  readonly roleLabel = computed(() => {
    if (this.user()?.roles?.includes('platformAdmin')) return 'roles.platformAdmin';
    if (this.isApplicationAdmin()) return 'roles.applicationAdmin';
    if (this.isUserAdmin()) return 'roles.userAdmin';
    if (this.isTeacher()) return 'roles.teacher';
    return 'roles.student';
  });

  async signOut(): Promise<void> {
    await this.authService.signOut();
  }

  /** Topbar opacity as a function of scroll position — fully visible at the top, faded out after `fadeDistance` px. */
  private readonly fadeDistance = 150;
  readonly topbarOpacity = signal(1);

  // Coalesce scroll events to one signal write per animation frame — the
  // `scroll` event can fire dozens of times per frame, and each write would
  // otherwise trigger an OnPush change-detection pass.
  private scrollRafHandle: number | null = null;

  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (this.scrollRafHandle !== null) return;
    this.scrollRafHandle = requestAnimationFrame(() => {
      this.scrollRafHandle = null;
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      this.topbarOpacity.set(Math.max(0, Math.min(1, 1 - y / this.fadeDistance)));
    });
  }

  readonly isNotifOpen = signal(false);

  toggleNotifications(event: Event): void {
    event.stopPropagation();
    // The panel lives inside `.topbar`, which is a stacking context at z-index
    // 20, so it can never paint above the mobile drawer (50) or its backdrop
    // (45). Rather than fight that with z-index, keep the two mutually
    // exclusive — there is no reading of the UI where both should be open.
    this.isSidebarOpen.set(false);
    this.isNotifOpen.update(v => !v);
  }

  /**
   * Whether the sidebar is showing on a narrow viewport.
   *
   * Below 900px the sidebar is taken out of the grid and parked off-screen
   * (`transform: translateX(-100%)`), and `.app.is-sidebar-open` is what slides
   * it back. That CSS has been in place for a while, but nothing ever set the
   * class and no control ever toggled it — so on a phone the navigation was
   * simply unreachable and an admin could not leave whatever page they landed
   * on. This signal is the missing half.
   *
   * Always false on a desktop viewport, where the sidebar is a real grid
   * column and the class means nothing.
   */
  readonly isSidebarOpen = signal(false);

  toggleSidebar(event: Event): void {
    event.stopPropagation();
    if (this.isLockedDown()) return;
    this.isNotifOpen.set(false);
    this.isSidebarOpen.update(v => !v);
  }

  closeSidebar(): void {
    this.isSidebarOpen.set(false);
  }

  constructor() {
    // Close the drawer once navigation completes. Without this it stays open
    // over the page the user just chose, which reads as a tap that did nothing.
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => this.closeSidebar());
  }

  notifTitleKey(n: AppNotification): string {
    switch (n.type) {
      case 'submission-completed': return 'notifications.types.completed';
      case 'submission-needs-review': return 'notifications.types.needsReview';
      case 'submission-received': return 'notifications.types.received';
      case 'homework-approved': return 'notifications.types.approved';
      case 'child-approved': return 'notifications.types.childApproved';
      case 'child-revision': return 'notifications.types.childRevision';
      default: return 'notifications.types.revision';
    }
  }

  /** Drives .notif-item__icon--* . Kept beside notifTitleKey/notifMessageKey so the three type switches cannot drift apart. */
  notifTone(n: AppNotification): string {
    switch (n.type) {
      case 'submission-completed':
      case 'submission-received': return 'completed';
      case 'submission-needs-review': return 'review';
      case 'homework-approved':
      case 'child-approved': return 'approved';
      default: return 'revision';
    }
  }

  notifMessageKey(n: AppNotification): string {
    switch (n.type) {
      // A parent told answers wait for the teacher hears the verdict later (child-approved / child-revision).
      case 'submission-completed': return (n.pendingReviewCount ?? 0) > 0
        ? 'notifications.messages.completedNeedsReview'
        : 'notifications.messages.completed';
      case 'submission-needs-review': return 'notifications.messages.needsReview';
      case 'submission-received': return 'notifications.messages.received';
      case 'homework-approved': return 'notifications.messages.approved';
      case 'child-approved': return 'notifications.messages.childApproved';
      case 'child-revision': return 'notifications.messages.childRevision';
      default: return 'notifications.messages.revision';
    }
  }

  notifMessageParams(n: AppNotification): Record<string, string | number> {
    if (n.type === 'submission-needs-review') {
      return {
        childName: n.childName ?? '',
        title: n.assignmentTitle,
        count: n.pendingReviewCount ?? 0
      };
    }
    if (n.type === 'submission-received') {
      return {
        childName: n.childName ?? '',
        title: n.assignmentTitle,
        correct: n.correctCount ?? 0,
        wrong: n.wrongCount ?? 0,
        time: this.formatDuration(n.timeTakenSeconds)
      };
    }
    if (n.type === 'child-approved' || n.type === 'child-revision') {
      return { childName: n.childName ?? '', title: n.assignmentTitle };
    }
    if (n.type !== 'submission-completed') return { title: n.assignmentTitle };
    return {
      childName: n.childName ?? '',
      title: n.assignmentTitle,
      correct: n.correctCount ?? 0,
      wrong: n.wrongCount ?? 0,
      count: n.pendingReviewCount ?? 0,
      time: this.formatDuration(n.timeTakenSeconds),
      status: this.translate.instant(`notifications.reviewStatus.${n.reviewStatus ?? 'pending'}`)
    };
  }

  private formatDuration(seconds?: number): string {
    if (!seconds && seconds !== 0) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  markRead(n: AppNotification): void {
    if (!n.read) void this.notificationCenter.markRead(n.id);
  }

  markAllRead(): void {
    void this.notificationCenter.markAllRead();
  }

  @HostListener('document:click')
  closeNotifications(): void {
    this.isNotifOpen.set(false);
  }

  /**
   * Escape closes the sidebar drawer. It covers the page while open, so a
   * keyboard user who cannot reach the backdrop needs a way out that is not
   * "pick a nav item".
   */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeSidebar();
    this.isNotifOpen.set(false);
  }
}

