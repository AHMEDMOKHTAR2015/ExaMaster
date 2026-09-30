import { Component, signal, inject, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ClickOutsideDirective, LoadingButtonDirective } from '../../../directives';
import { AuthService } from '../../../services/auth';
import {
  UserAdminService,
  StageService,
  GradeService,
  ClassGroupService,
  TeacherService,
  SubjectService,
  ParticipationService
} from '../../../services/admin';
import { ChildAccountService } from '../../../services/auth/child-account.service';
import { NotificationService } from '../../../services/notification.service';
import { AppUserService } from '../../../services/admin/users/app-user.service';
import { ServiceError } from '../../../services/shared/service-error';
import { HomeworkService } from '../../../services/homework.service';
import { ClassGroup, Grade, Stage, User, ParticipationRecord, RegistrationKey, Teacher, Subject, AssignmentKind } from '../../../models';
import { resolveSubjectTeaching, SubjectTeaching } from '../../../shared/teaching';
import { participationScorePercent } from '../../../shared/participation-score';

/** Page size for the selected child's participation history, applied to the Firebase reads too — each `listByUserDesc` call fetches exactly one page. */
const PARTICIPATION_PAGE_SIZE = 5;

@Component({
  selector: 'app-user-admin-dashboard-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe, ClickOutsideDirective, LoadingButtonDirective],
  templateUrl: './user-admin-dashboard-view.component.html',
})
export class UserAdminDashboardViewComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly userAdminService = inject(UserAdminService);
  private readonly childAccountService = inject(ChildAccountService);
  private readonly stageService = inject(StageService);
  private readonly gradeService = inject(GradeService);
  private readonly classService = inject(ClassGroupService);
  private readonly teacherService = inject(TeacherService);
  private readonly subjectService = inject(SubjectService);
  private readonly participationService = inject(ParticipationService);
  private readonly notificationService = inject(NotificationService);
  private readonly homeworkService = inject(HomeworkService);
  private readonly appUserService = inject(AppUserService);
  private readonly translate = inject(TranslateService);

  // A child's new password. There is no reset email (a child has no mailbox): their parent sets it here.
  readonly passwordChild = signal<User | null>(null);
  readonly childNewPassword = signal('');
  readonly isSettingChildPassword = signal(false);

  readonly currentUser = this.authService.user;

  openSetPassword(child: User): void {
    this.childNewPassword.set('');
    this.passwordChild.set(child);
  }

  closeSetPassword(): void {
    if (!this.isSettingChildPassword()) this.passwordChild.set(null);
  }

  async setChildPassword(): Promise<void> {
    const child = this.passwordChild();
    const password = this.childNewPassword();
    if (!child?.id || password.length < 6 || this.isSettingChildPassword()) return;
    this.isSettingChildPassword.set(true);
    try {
      await this.appUserService.setPassword(child.id, password);
      this.notificationService.success(this.translate.instant('dashboard.userAdmin.childPasswordSet', { name: child.displayName }));
      this.passwordChild.set(null);
    } catch (error) {
      this.notificationService.error(error instanceof ServiceError ? error.message : 'Could not set the password.');
    } finally {
      this.isSettingChildPassword.set(false);
    }
  }

  // Children management
  readonly children = signal<User[]>([]);
  readonly childCursor = signal<string | undefined>(undefined);
  readonly selectedChild = signal<User | null>(null);

  // Form fields for adding children
  readonly firstName = signal<string>('');
  readonly lastName = signal<string>('');
  readonly mobileNumber = signal<string>('');
  readonly password = signal<string>('');
  readonly stageId = signal<string>('');
  readonly gradeId = signal<string>('');
  readonly classId = signal<string>('');

  // Add-child popup visibility
  readonly showAddChild = signal<boolean>(false);

  // Reference data
  readonly stages = signal<Stage[]>([]);
  readonly grades = signal<Grade[]>([]);
  readonly classes = signal<ClassGroup[]>([]);
  readonly teachers = signal<Teacher[]>([]);
  readonly subjects = signal<Subject[]>([]);
  readonly stageCursor = signal<string | undefined>(undefined);
  readonly gradeCursor = signal<string | undefined>(undefined);
  readonly classCursor = signal<string | undefined>(undefined);

  /**
   * Grades belonging to the chosen stage, and groups belonging to the chosen
   * grade. Same cascade the Users Admin form uses — a group only makes sense
   * once the stage and grade above it are known.
   */
  readonly gradesForStage = computed(() => {
    const sid = this.stageId();
    return this.grades().filter(g => !sid || g.stageId === sid);
  });
  readonly classesForGrade = computed(() => {
    const sid = this.stageId();
    const gid = this.gradeId();
    return this.classes().filter(c =>
      (!sid || c.stageId === sid) && (!gid || c.gradeId === gid)
    );
  });

  /** Clear the selections below whichever level just changed. */
  onStageChange(stageId: string): void {
    this.stageId.set(stageId);
    this.gradeId.set('');
    this.classId.set('');
  }

  onGradeChange(gradeId: string): void {
    this.gradeId.set(gradeId);
    this.classId.set('');
  }

  /** Subjects the selected child studies, paired with the teacher(s) for each. */
  readonly selectedChildTeaching = computed<SubjectTeaching[]>(() => {
    const child = this.selectedChild();
    if (!child?.classId) return [];
    const cls = this.classes().find(c => c.id === child.classId) ?? null;
    return resolveSubjectTeaching(cls, this.teachers());
  });

  // Selected child's participation history — paginated 5-at-a-time, buffered
  // from Firebase 5 records per call; paging past the buffered records
  // triggers another 5-record fetch. The merged "all children" feed now lives
  // in ParticipationHistoryComponent (/participation-history).
  readonly selectedChildParticipations = signal<ParticipationRecord[]>([]);
  readonly selectedChildParticipationCursor = signal<string | undefined>(undefined);
  readonly selectedChildParticipationsPage = signal<number>(0);
  readonly pagedSelectedChildParticipations = computed(() => {
    const start = this.selectedChildParticipationsPage() * PARTICIPATION_PAGE_SIZE;
    return this.selectedChildParticipations().slice(start, start + PARTICIPATION_PAGE_SIZE);
  });
  readonly hasMoreSelectedChildParticipations = computed(() => {
    const nextStart = (this.selectedChildParticipationsPage() + 1) * PARTICIPATION_PAGE_SIZE;
    return this.selectedChildParticipations().length > nextStart || !!this.selectedChildParticipationCursor();
  });

  /**
   * `ParticipationRecord.type` can't tell a quiz-kind assignment from real
   * homework — `onStartHomework()` (`available-quizzes.component.ts`) always
   * writes `type: 'homework'` for *any* teacher assignment, including ones
   * authored with `kind: 'quiz'` (see `ParticipationSummaryService.fetch()`
   * for the same gotcha handled the same way). Resolved lazily per `homeworkId`
   * and cached here so history rows can show the assignment's true kind.
   */
  private readonly assignmentKindByHomeworkId = signal<Map<string, AssignmentKind>>(new Map());

  // Loading and feedback
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string>('');
  readonly successMessage = signal<string>('');

  // Registration key info
  readonly registrationKey = signal<RegistrationKey | null>(null);

  // Statistics
  readonly childCount = computed(() => this.children().length);
  readonly totalParticipations = computed(() => {
    return this.children().reduce((sum, child) => sum + (child.participationCount ?? 0), 0);
  });
  readonly remainingChildSlots = computed(() => {
    const key = this.registrationKey();
    if (!key) return null;
    const maxUses = key.maxChildUses ?? Infinity;
    const currentUses = key.childUseCount ?? 0;
    return maxUses === Infinity ? null : maxUses - currentUses;
  });

  readonly canAddMoreChildren = computed(() => {
    const key = this.registrationKey();
    if (!key) return true;
    const maxUses = key.maxChildUses;
    if (maxUses === undefined) return true;
    const currentUses = key.childUseCount ?? 0;
    return currentUses < maxUses;
  });

  ngOnInit(): void {
    this.loadInitialData();
  }

  private async loadInitialData(): Promise<void> {
    this.isLoading.set(true);
    try {
      await Promise.all([
        this.loadChildren(),
        this.loadStages(),
        this.loadGrades(),
        this.loadClasses(),
        this.loadTeachers(),
        this.loadSubjects(),
        this.loadRegistrationKey()
      ]);
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadRegistrationKey(): Promise<void> {
    // The family's key, with its allowance and how much is used, comes with the profile (GET /me).
    this.registrationKey.set(this.authService.registrationKey());
  }

  async loadChildren(): Promise<void> {
    if (!this.currentUser()) return;
    this.children.set(await this.userAdminService.listMyChildren());
    this.childCursor.set(undefined);                        // a family is a handful of children: one list, no pages
  }

  async loadStages(): Promise<void> {
    const result = await this.stageService.listStages(50, this.stageCursor());
    this.stages.update(items => [...items, ...result.items]);
    this.stageCursor.set(result.nextCursor);
  }

  async loadGrades(): Promise<void> {
    const result = await this.gradeService.listGrades(50, this.gradeCursor());
    this.grades.update(items => [...items, ...result.items]);
    this.gradeCursor.set(result.nextCursor);
  }

  async loadClasses(): Promise<void> {
    const result = await this.classService.listClasses(50, this.classCursor());
    this.classes.update(items => [...items, ...result.items]);
    this.classCursor.set(result.nextCursor);
  }

  async loadTeachers(): Promise<void> {
    let cursor: string | undefined;
    const items: Teacher[] = [];
    do {
      const result = await this.teacherService.listTeachers(50, cursor);
      items.push(...result.items);
      cursor = result.nextCursor;
    } while (cursor);
    this.teachers.set(items);
  }

  async loadSubjects(): Promise<void> {
    let cursor: string | undefined;
    const items: Subject[] = [];
    do {
      const result = await this.subjectService.listSubjects(50, cursor);
      items.push(...result.items);
      cursor = result.nextCursor;
    } while (cursor);
    this.subjects.set(items);
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

  /** True display kind for a participation row — see {@link assignmentKindByHomeworkId} for why `record.type` alone isn't enough.
   *  Returns a `common.*` i18n key ('quiz' | 'homework'), not a display string — templates translate it. */
  recordKindLabel(record: ParticipationRecord): 'quiz' | 'homework' {
    if (record.homeworkId) {
      return this.assignmentKindByHomeworkId().get(record.homeworkId) ?? 'homework';
    }
    return record.type === 'quiz' ? 'quiz' : 'homework';
  }

  /** The name to show alongside {@link recordKindLabel} — the assignment's own title when it was assigned, else the quiz's name. */
  recordTitle(record: ParticipationRecord): string {
    return record.homeworkTitle || record.quizName || `Quiz #${record.quizId}`;
  }

  async selectChild(child: User): Promise<void> {
    this.selectedChild.set(child);
    this.selectedChildParticipations.set([]);
    this.selectedChildParticipationCursor.set(undefined);
    this.selectedChildParticipationsPage.set(0);
    await this.loadChildParticipations();
  }

  async loadChildParticipations(): Promise<void> {
    const child = this.selectedChild();
    const parentId = this.currentUser()?.uid;
    if (!child || !parentId) return;

    this.isLoading.set(true);
    try {
      const result = await this.participationService.listByUserDesc(child.uid, parentId, PARTICIPATION_PAGE_SIZE, this.selectedChildParticipationCursor());
      this.selectedChildParticipations.update(items => [...items, ...result.items]);
      this.selectedChildParticipationCursor.set(result.nextCursor);
      await this.resolveAssignmentKinds(result.items);
    } finally {
      this.isLoading.set(false);
    }
  }

  /** Advances the selected child's history a page, fetching another page first if the buffer is short. */
  async nextSelectedChildParticipationsPage(): Promise<void> {
    const nextStart = (this.selectedChildParticipationsPage() + 1) * PARTICIPATION_PAGE_SIZE;
    if (this.selectedChildParticipations().length <= nextStart && this.selectedChildParticipationCursor()) {
      await this.loadChildParticipations();
    }
    if (this.selectedChildParticipations().length > nextStart) {
      this.selectedChildParticipationsPage.update(p => p + 1);
    }
  }

  prevSelectedChildParticipationsPage(): void {
    this.selectedChildParticipationsPage.update(p => Math.max(0, p - 1));
  }

  clearSelectedChild(): void {
    this.selectedChild.set(null);
    this.selectedChildParticipations.set([]);
    this.selectedChildParticipationCursor.set(undefined);
    this.selectedChildParticipationsPage.set(0);
  }

  openAddChild(): void {
    this.errorMessage.set('');
    this.successMessage.set('');
    this.firstName.set('');
    this.lastName.set('');
    this.mobileNumber.set('');
    this.password.set('');
    this.stageId.set('');
    this.gradeId.set('');
    this.classId.set('');
    this.showAddChild.set(true);
  }

  closeAddChild(): void {
    this.showAddChild.set(false);
  }

  async refreshChildren(): Promise<void> {
    this.isLoading.set(true);
    try {
      this.children.set(await this.userAdminService.listMyChildren());
      this.notificationService.success('Children data refreshed successfully');
    } catch {
      this.notificationService.error('Failed to refresh children data');
    } finally {
      this.isLoading.set(false);
    }
  }

  async addChild(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');

    // Validate form
    if (!this.firstName().trim()) {
      this.errorMessage.set('First name is required');
      return;
    }
    if (!this.lastName().trim()) {
      this.errorMessage.set('Last name is required');
      return;
    }
    if (!this.mobileNumber().trim()) {
      this.errorMessage.set('Mobile number is required');
      return;
    }
    if (!this.password().trim() || this.password().length < 6) {
      this.errorMessage.set('Password must be at least 6 characters');
      return;
    }
    if (!this.stageId()) {
      this.errorMessage.set('Please select a stage');
      return;
    }
    // Only demanded when the chosen stage actually has grades — a stage with
    // none would otherwise be impossible to submit.
    if (this.gradesForStage().length > 0 && !this.gradeId()) {
      this.errorMessage.set('Please select a grade');
      return;
    }
    if (!this.classId()) {
      this.errorMessage.set('Please select a class');
      return;
    }

    const user = this.currentUser();

    if (!user) {
      this.errorMessage.set('You must be logged in');
      return;
    }

    this.isLoading.set(true);
    try {
      // The API enrols the child on this family's key, and refuses (with the reason) when the key has lapsed or
      // its allowance is spent — the count is checked where it is kept.
      await this.childAccountService.addMyChild({
        firstName: this.firstName(),
        lastName: this.lastName(),
        classId: this.classId(),
        mobileNumber: this.mobileNumber(),
        password: this.password()
      });

      // The key's used count changed: reload the profile, which carries it.
      await this.authService.refreshUserData();
      await this.loadRegistrationKey();

      // Reset form
      this.firstName.set('');
      this.lastName.set('');
      this.mobileNumber.set('');
      this.password.set('');
      this.stageId.set('');
      this.gradeId.set('');
      this.classId.set('');

      // Reload children
      this.children.set([]);
      this.childCursor.set(undefined);
      await this.loadChildren();

      this.successMessage.set('Child account created successfully!');
      this.notificationService.success('Child account created successfully!');
      this.showAddChild.set(false);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to create child account';
      this.errorMessage.set(errorMsg);
      this.notificationService.error(errorMsg);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * `record.score` is a raw correct-answer count, not a percentage. Resolved
   * through the shared helper so a parent sees the same figure the student and
   * the teacher do — including after a teacher marks an Explain answer.
   */
  scorePercent(record: ParticipationRecord): number {
    return participationScorePercent(record);
  }

  /** Lookup helpers — fall back to the raw id (or "—") when not in the loaded lists. */
  getStageName(stageId: string | undefined): string {
    if (!stageId) return '—';
    return this.stages().find(s => s.id === stageId)?.name ?? stageId;
  }

  getClassName(classId: string | undefined): string {
    if (!classId) return '—';
    return this.classes().find(c => c.id === classId)?.name ?? classId;
  }

  getSubjectName(subjectId: string): string {
    return this.subjects().find(s => s.id === subjectId)?.name ?? subjectId;
  }

  getSubjectColor(subjectId: string): string | undefined {
    return this.subjects().find(s => s.id === subjectId)?.color;
  }

  getTeacherName(teacherId: string): string {
    const t = this.teachers().find(t => t.id === teacherId);
    return t ? `${t.firstName} ${t.lastName}`.trim() : teacherId;
  }

  getTeacherInitials(teacherId: string): string {
    const t = this.teachers().find(t => t.id === teacherId);
    if (!t) return '?';
    return ((t.firstName?.[0] ?? '') + (t.lastName?.[0] ?? '')).toUpperCase() || '?';
  }
}

