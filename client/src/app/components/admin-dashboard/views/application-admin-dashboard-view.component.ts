import { Component, signal, inject, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ClickOutsideDirective, LoadingButtonDirective } from '../../../directives';
import { Router } from '@angular/router';
import {
  StageService,
  ClassGroupService,
  AppUserService,
  ParticipationService,
  DashboardStatsService,
  DashboardStats,
  QuizCountsService
} from '../../../services/admin';
import { HomeworkService } from '../../../services/homework.service';
import { NotificationService } from '../../../services/notification.service';
import { Stage, ClassGroup, User, ParticipationRecord, RegistrationKey, HomeworkAssignment, AssignmentKind } from '../../../models';
import {
  QuizCountGrade,
  QuizCountStage,
  UNASSIGNED,
  assembleQuizCounts,
  realGroups,
  summarizeQuizCounts
} from '../../../shared/quiz-breakdown';
import { ParticipationAnswersPopupComponent } from './participation-answers-popup.component';
import { KpiSkeletonComponent } from './kpi-skeleton.component';
import { participationScorePercent } from '../../../shared/participation-score';

// `DashboardStats` lives with the service that produces it (`GET /dashboard/stats`).

/** A Grade row plus the structural facts its sub-line describes. */
interface QuizCountGradeRow extends QuizCountGrade {
  groupCount: number;
  groupsWithContent: number;
}

/** A Stage row plus the structural facts its sub-line describes. */
interface QuizCountStageRow extends QuizCountStage {
  gradeCount: number;
  groupCount: number;
  groupsWithContent: number;
  grades: QuizCountGradeRow[];
}

@Component({
    selector: 'app-application-admin-dashboard-view',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, FormsModule, TranslatePipe, ParticipationAnswersPopupComponent, KpiSkeletonComponent, ClickOutsideDirective, LoadingButtonDirective],
    templateUrl: './application-admin-dashboard-view.component.html'
})
export class ApplicationAdminDashboardViewComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly stageService = inject(StageService);
  private readonly classService = inject(ClassGroupService);
  private readonly appUserService = inject(AppUserService);
  private readonly homeworkService = inject(HomeworkService);
  private readonly quizCountsService = inject(QuizCountsService);
  private readonly participationService = inject(ParticipationService);
  private readonly notificationService = inject(NotificationService);
  private readonly dashboardStatsService = inject(DashboardStatsService);


  /** The dashboard's tiles, as the server counted them. */
  readonly stats = signal<DashboardStats>({
    totalUsers: 0,
    totalChildren: 0,
    totalParents: 0,
    totalTeachers: 0,
    totalParticipations: 0,
    activeHomework: 0,
    registrationKeys: 0,
    totalQuizzes: 0
  });

  /**
   * True until the first stats response lands.
   *
   * Starts `true` so the tiles never mount showing their `0` defaults — an
   * admin should not be told, however briefly, that the system has no users.
   */
  readonly isLoadingStats = signal<boolean>(true);

  // Quiz counts popup (Stage → Grade → Group breakdown)
  readonly showQuizCountsPopup = signal<boolean>(false);
  readonly isLoadingQuizBreakdown = signal<boolean>(false);
  readonly quizBreakdown = signal<QuizCountStage[]>([]);

  /** When the triggers last wrote `quizCounts/current`, for the freshness line. */

  /** Totals for the summary strip, so the popup opens on an answer. */
  readonly quizCountsSummary = computed(() => summarizeQuizCounts(this.quizBreakdown()));

  /**
   * The tree with each row's structural facts attached — how many grades and
   * groups sit under it, and how many of those groups actually hold a quiz.
   *
   * Derived once here rather than through template method calls, which would
   * recount on every change-detection pass.
   */
  readonly quizBreakdownRows = computed<QuizCountStageRow[]>(() =>
    this.quizBreakdown().map(stage => {
      const grades: QuizCountGradeRow[] = stage.grades.map(grade => {
        const groups = realGroups(grade.groups);
        return {
          ...grade,
          groupCount: groups.length,
          groupsWithContent: groups.filter(group => group.count > 0).length
        };
      });

      return {
        ...stage,
        grades,
        gradeCount: grades.filter(grade => grade.id !== UNASSIGNED).length,
        groupCount: grades.reduce((total, grade) => total + grade.groupCount, 0),
        groupsWithContent: grades.reduce((total, grade) => total + grade.groupsWithContent, 0)
      };
    })
  );

  // Active tab
  readonly activeTab = signal<'overview' | 'users' | 'content' | 'analytics'>('overview');

  // Users — the "Recent Participations" panel: child accounts with at least
  // one participation, capped at 10. `/participations-history` is where the
  // full, paginated set lives.
  readonly users = signal<User[]>([]);
  readonly selectedUser = signal<User | null>(null);
  readonly userParticipations = signal<ParticipationRecord[]>([]);
  readonly answersRecord = signal<ParticipationRecord | null>(null);
  readonly deletingParticipationId = signal<string | null>(null);
  /** Per-{@link recordKindLabel}: the real kind of each `homeworkId` seen so far, resolved on demand and cached. */
  private readonly assignmentKindByHomeworkId = signal<Map<string, AssignmentKind>>(new Map());

  // Content management
  readonly stages = signal<Stage[]>([]);
  readonly classes = signal<ClassGroup[]>([]);
  readonly homework = signal<HomeworkAssignment[]>([]);
  readonly stageCursor = signal<string | undefined>(undefined);
  readonly classCursor = signal<string | undefined>(undefined);
  readonly homeworkCursor = signal<string | undefined>(undefined);

  // Registration Keys
  readonly registrationKeys = signal<RegistrationKey[]>([]);
  readonly keyCursor = signal<string | undefined>(undefined);

  // Loading state
  readonly isLoading = signal<boolean>(false);

  /** `icon` names the sidebar glyph to reuse — see the matching `@case` in the template. */
  readonly quickActions = [
    { label: 'nav.users', icon: 'users', route: '/users-admin' },
    { label: 'nav.registrationKeys', icon: 'keys', route: '/registration-keys-admin' },
    { label: 'nav.quizzesHomework', icon: 'quizzes', route: '/quizzes-admin' },
    { label: 'nav.stagesGroups', icon: 'stagesGroups', route: '/application-admin' },
    { label: 'nav.teachers', icon: 'teachers', route: '/teachers-admin' },
    { label: 'nav.subjects', icon: 'subjects', route: '/subjects-admin' }
  ];

  ngOnInit(): void {
    this.loadInitialData();
  }

  private async loadInitialData(): Promise<void> {
    this.isLoading.set(true);
    try {
      await Promise.all([
        this.loadStats(),
        this.loadRecentParticipations(),
        this.loadStages(),
        this.loadClasses(),
        this.loadRecentHomework()
      ]);
    } finally {
      this.isLoading.set(false);
    }
  }

  setActiveTab(tab: 'overview' | 'users' | 'content' | 'analytics'): void {
    this.activeTab.set(tab);
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }

  /** Populate the stat tiles from `GET /dashboard/stats`. */
  private async loadStats(): Promise<void> {
    try {
      this.stats.set(await this.dashboardStatsService.load());
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      // Clear in `finally` so a failed load reveals the tiles rather than
      // leaving a skeleton shimmering forever.
      this.isLoadingStats.set(false);
    }
  }

  /**
   * The 10 most-active child accounts (query-side filtered to
   * `accountType === 'child'` with `participationCount > 0` — see
   * {@link AppUserService.listChildParticipants}), not the raw "load
   * another page" fallback `loadRecentUsers` used to be. There is no
   * "Load more" here on purpose: past 10, an admin goes to
   * `/participations-history` instead, which paginates the same query.
   */
  async loadRecentParticipations(): Promise<void> {
    const result = await this.appUserService.listChildParticipants(10);
    this.users.set(result.items);
  }

  async loadStages(): Promise<void> {
    const result = await this.stageService.listStages(20, this.stageCursor());
    this.stages.update(items => [...items, ...result.items]);
    this.stageCursor.set(result.nextCursor);
  }

  async loadClasses(): Promise<void> {
    const result = await this.classService.listClasses(20, this.classCursor());
    this.classes.update(items => [...items, ...result.items]);
    this.classCursor.set(result.nextCursor);
  }

  async loadRecentHomework(): Promise<void> {
    const result = await this.homeworkService.listAll(10, this.homeworkCursor());
    this.homework.update(items => [...items, ...result.items]);
    this.homeworkCursor.set(result.nextCursor);
  }

  async selectUser(user: User): Promise<void> {
    this.selectedUser.set(user);
    this.userParticipations.set([]);

    if (user.accountType === 'child') {
      try {
        const result = await this.participationService.listByUser(user.uid, 20);
        this.userParticipations.set(result.items);
        await this.resolveAssignmentKinds(result.items);
      } catch (error) {
        console.error('Failed to load user participations:', error);
      }
    }
  }

  /** Looks up + caches the true `kind` (quiz vs. homework) of every not-yet-seen `homeworkId` among `records`. */
  private async resolveAssignmentKinds(records: ParticipationRecord[]): Promise<void> {
    const cache = this.assignmentKindByHomeworkId();
    const missingIds = [...new Set(
      records.map(r => r.homeworkId).filter((id): id is string => !!id && !cache.has(id))
    )];
    if (missingIds.length === 0) return;

    const resolved = await Promise.all(missingIds.map(async id =>
      [id, (await this.homeworkService.getById(id))?.kind ?? 'homework'] as const
    ));
    this.assignmentKindByHomeworkId.update(map => {
      const next = new Map(map);
      for (const [id, kind] of resolved) next.set(id, kind);
      return next;
    });
  }

  /**
   * True display kind for a participation row — not `record.type`, which only
   * says whether the attempt went through an assignment at all
   * (`payload.homeworkId ? 'homework' : 'quiz'` in `submit-quiz.ts`), never
   * what kind of content that assignment actually is. A Quiz-kind assignment
   * taken via "Start" still sets `homeworkId`, so `record.type` reads
   * `'homework'` for it regardless.
   */
  recordKindLabel(record: ParticipationRecord): AssignmentKind {
    if (record.homeworkId) {
      return this.assignmentKindByHomeworkId().get(record.homeworkId) ?? 'homework';
    }
    return record.type === 'quiz' ? 'quiz' : 'homework';
  }

  clearSelectedUser(): void {
    this.selectedUser.set(null);
    this.userParticipations.set([]);
  }

  openAnswers(record: ParticipationRecord): void {
    this.answersRecord.set(record);
  }

  closeAnswers(): void {
    this.answersRecord.set(null);
  }

  /**
   * Delete a participation record. Reflects the removal locally on both the
   * selected user's list and the visible participation counts, rather than
   * re-fetching, since the admin service only exposes paginated reads.
   */
  async deleteParticipation(record: ParticipationRecord): Promise<void> {
    if (!confirm('Delete this participation record? This cannot be undone.')) return;

    this.deletingParticipationId.set(record.id);
    try {
      await this.participationService.remove(record);
      this.userParticipations.update(items => items.filter(p => p.id !== record.id));

      const decremented = (count: number | undefined) => Math.max(0, (count ?? 0) - 1);
      const user = this.selectedUser();
      if (user && user.uid === record.childId) {
        this.selectedUser.set({ ...user, participationCount: decremented(user.participationCount) });
      }
      this.users.update(items => items.map(u =>
        u.uid === record.childId ? { ...u, participationCount: decremented(u.participationCount) } : u
      ));

      this.notificationService.success('Participation record deleted.');
    } catch (error) {
      console.error('Failed to delete participation record:', error);
      this.notificationService.error('Failed to delete the participation record.');
    } finally {
      this.deletingParticipationId.set(null);
    }
  }

  async refreshStats(): Promise<void> {
    this.isLoading.set(true);
    try {
      await this.loadStats();
      this.notificationService.success('Dashboard refreshed');
    } catch {
      this.notificationService.error('Failed to refresh dashboard');
    } finally {
      this.isLoading.set(false);
    }
  }



  getUserRoleBadge(user: User): string {
    if (user.roles?.includes('applicationAdmin')) return 'App Admin';
    if (user.roles?.includes('userAdmin')) return 'Parent Admin';
    if (user.accountType === 'child') return 'Child';
    if (user.accountType === 'parent') return 'Parent';
    return 'User';
  }

  getUserRoleClass(user: User): string {
    if (user.roles?.includes('applicationAdmin')) return 'role-app-admin';
    if (user.roles?.includes('userAdmin')) return 'role-user-admin';
    if (user.accountType === 'child') return 'role-child';
    return 'role-parent';
  }

  getUserRoleBadgeClass(user: User): string {
    if (user.roles?.includes('applicationAdmin')) return 'badge--brand';
    if (user.roles?.includes('userAdmin')) return 'badge--info';
    if (user.accountType === 'child') return 'badge--success';
    return 'badge--warning';
  }

  /** Two-letter avatar initials from a display name (first + last), matching AppComponent's sidebar convention. */
  getInitials(name: string | undefined): string {
    const trimmed = name?.trim();
    if (!trimmed) return '?';
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /** Subtitle under the name in the user-detail panel. */
  getProfileSubtitle(user: User): string {
    if (user.accountType === 'child') return 'Student Profile';
    if (user.roles?.includes('applicationAdmin')) return 'Application Admin Profile';
    if (user.roles?.includes('userAdmin')) return 'Parent Admin Profile';
    if (user.accountType === 'parent') return 'Parent Profile';
    return 'User Profile';
  }

  getActiveHomeworkCount(): number {
    return this.homework().filter(h => h.active).length;
  }

  async deactivateHomework(hw: HomeworkAssignment): Promise<void> {
    try {
      await this.homeworkService.deactivateAssignment(hw.id);
      this.homework.update(items =>
        items.map(h => h.id === hw.id ? { ...h, active: false } : h)
      );
      this.notificationService.success('Homework deactivated');
    } catch {
      this.notificationService.error('Failed to deactivate homework');
    }
  }

  /**
   * Get the count of classes for a specific stage
   */
  getClassCountForStage(stageId: string): number {
    return this.classes().filter(c => c.stageId === stageId).length;
  }

  /** Resolve a stage id to its display name (falls back to the raw id if not loaded, undefined if absent). */
  getStageName(stageId: string | undefined): string | undefined {
    if (!stageId) return undefined;
    return this.stages().find(s => s.id === stageId)?.name ?? stageId;
  }

  /**
   * `record.score` is a raw correct-answer count, not a percentage. Resolved
   * through the shared helper so this matches every other surface, including
   * after a teacher marks an Explain answer.
   */
  scorePercent(record: ParticipationRecord): number {
    return participationScorePercent(record);
  }

  /** Resolve a class/group id to its display name (falls back to the raw id if not loaded, undefined if absent). */
  getClassName(classId: string | undefined): string | undefined {
    if (!classId) return undefined;
    return this.classes().find(c => c.id === classId)?.name ?? classId;
  }

  /**
   * Open the quiz-counts popup and build the Stage → Grade → Group breakdown.
   * Re-fetches stages/grades/classes in full (the dashboard's own signals are
   * paginated to 20) but reuses the quiz list already cached by `loadStats`.
   */
  async openQuizCountsPopup(): Promise<void> {
    this.showQuizCountsPopup.set(true);
    this.isLoadingQuizBreakdown.set(true);
    try {
      // Counted on request from the whole lists the API returns (see QuizCountsService).
      this.quizBreakdown.set(assembleQuizCounts(await this.quizCountsService.getBreakdown()));
    } catch (error) {
      console.error('Failed to load quiz counts:', error);
    } finally {
      this.isLoadingQuizBreakdown.set(false);
    }
  }

  closeQuizCountsPopup(): void {
    this.showQuizCountsPopup.set(false);
  }

}

