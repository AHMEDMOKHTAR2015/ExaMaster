import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { LoadingButtonDirective } from '../../directives';
import {
  StageService,
  GradeService,
  ClassGroupService,
  AppUserService,
  ParticipationService
} from '../../services/admin';
import { HomeworkService } from '../../services/homework.service';
import { NotificationService } from '../../services/notification.service';
import { Stage, Grade, ClassGroup, User, ParticipationRecord, AssignmentKind } from '../../models';
import { ParticipationAnswersPopupComponent } from '../admin-dashboard/views/participation-answers-popup.component';
import { participationScorePercent } from '../../shared/participation-score';
import { BaseComponent } from '../../shared/base/base.component';

/** One row of the table: a child participant plus everything the columns need already resolved. */
interface ParticipantRow {
  user: User;
  parentName: string | null;
  stageName: string | null;
  gradeName: string | null;
  groupName: string | null;
  teachingStaffCount: number;
}

@Component({
    selector: 'app-participations-history',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, TranslatePipe, ParticipationAnswersPopupComponent, LoadingButtonDirective],
    templateUrl: './participations-history.component.html'
})
export class ParticipationsHistoryComponent extends BaseComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly stageService = inject(StageService);
  private readonly gradeService = inject(GradeService);
  private readonly classService = inject(ClassGroupService);
  private readonly appUserService = inject(AppUserService);
  private readonly participationService = inject(ParticipationService);
  private readonly homeworkService = inject(HomeworkService);
  private readonly notificationService = inject(NotificationService);

  // Lookup maps built once from the full (small) academic hierarchy — same
  // "page until cursor is undefined" pattern application-admin.component.ts
  // uses to load stages/grades/classes in full.
  private readonly stagesById = signal<Map<string, Stage>>(new Map());
  private readonly gradesById = signal<Map<string, Grade>>(new Map());
  private readonly classesById = signal<Map<string, ClassGroup>>(new Map());

  /** Parent display names, resolved a page at a time via `fetchUsersByIds` and cached across pages. */
  private readonly parentNameById = signal<Map<string, string>>(new Map());

  readonly participants = signal<User[]>([]);
  private readonly participantsCursor = signal<string | undefined>(undefined);
  readonly isLoadingMore = signal<boolean>(false);

  readonly rows = computed<ParticipantRow[]>(() => {
    const stages = this.stagesById();
    const grades = this.gradesById();
    const classes = this.classesById();
    const parents = this.parentNameById();
    return this.participants().map(user => {
      const group = user.classId ? classes.get(user.classId) : undefined;
      return {
        user,
        parentName: (user.parentId && parents.get(user.parentId)) || null,
        stageName: (user.stageId && stages.get(user.stageId)?.name) || null,
        gradeName: (user.gradeId && grades.get(user.gradeId)?.name) || null,
        groupName: group?.name ?? null,
        teachingStaffCount: group?.teacherIds?.length ?? 0
      };
    });
  });

  // Expand/collapse + per-user participation records, loaded on first expand.
  readonly expandedUserIds = signal<Set<string>>(new Set());
  private readonly recordsByUser = signal<Map<string, ParticipationRecord[]>>(new Map());
  private readonly loadingRecordsFor = signal<Set<string>>(new Set());

  /** Per-{@link recordKindLabel}: the real kind of each `homeworkId` seen so far, resolved on demand and cached. */
  private readonly assignmentKindByHomeworkId = signal<Map<string, AssignmentKind>>(new Map());

  // Details popup — the record plus the student name it belongs to, since
  // rows for several students can be expanded at once.
  private readonly detailsSelection = signal<{ record: ParticipationRecord; studentName: string } | null>(null);
  readonly detailsRecord = computed(() => this.detailsSelection()?.record ?? null);
  readonly detailsStudentName = computed(() => this.detailsSelection()?.studentName ?? null);

  ngOnInit(): void {
    this.loadInitialData();
  }

  private async loadInitialData(): Promise<void> {
    this.setLoading(true);
    try {
      await Promise.all([
        this.loadAllStages(),
        this.loadAllGrades(),
        this.loadAllClasses(),
        this.loadMoreParticipants()
      ]);
    } catch (error) {
      console.error('Failed to load participations history:', error);
      this.setError('Failed to load participations history.');
    } finally {
      this.setLoading(false);
    }
  }

  private async loadAllStages(): Promise<void> {
    const map = new Map<string, Stage>();
    let cursor: string | undefined;
    do {
      const result = await this.stageService.listStages(50, cursor);
      for (const stage of result.items) map.set(stage.id, stage);
      cursor = result.nextCursor;
    } while (cursor);
    this.stagesById.set(map);
  }

  private async loadAllGrades(): Promise<void> {
    const map = new Map<string, Grade>();
    let cursor: string | undefined;
    do {
      const result = await this.gradeService.listGrades(50, cursor);
      for (const grade of result.items) map.set(grade.id, grade);
      cursor = result.nextCursor;
    } while (cursor);
    this.gradesById.set(map);
  }

  private async loadAllClasses(): Promise<void> {
    const map = new Map<string, ClassGroup>();
    let cursor: string | undefined;
    do {
      const result = await this.classService.listClasses(50, cursor);
      for (const group of result.items) map.set(group.id, group);
      cursor = result.nextCursor;
    } while (cursor);
    this.classesById.set(map);
  }

  async loadMoreParticipants(): Promise<void> {
    this.isLoadingMore.set(true);
    try {
      const result = await this.appUserService.listChildParticipants(20, this.participantsCursor());
      this.participants.update(items => [...items, ...result.items]);
      this.participantsCursor.set(result.nextCursor);
      await this.resolveParentNames(result.items);
    } finally {
      this.isLoadingMore.set(false);
    }
  }

  /** Looks up + caches the display name of every not-yet-seen `parentId` among `users`. */
  private async resolveParentNames(users: User[]): Promise<void> {
    const cache = this.parentNameById();
    const missingIds = [...new Set(
      users.map(u => u.parentId).filter((id): id is string => !!id && !cache.has(id))
    )];
    if (missingIds.length === 0) return;

    const parents = await this.appUserService.fetchUsersByIds(missingIds);
    this.parentNameById.update(map => {
      const next = new Map(map);
      for (const parent of parents) next.set(parent.uid, parent.displayName);
      return next;
    });
  }

  hasMore(): boolean {
    return !!this.participantsCursor();
  }

  isExpanded(uid: string): boolean {
    return this.expandedUserIds().has(uid);
  }

  isLoadingRecordsFor(uid: string): boolean {
    return this.loadingRecordsFor().has(uid);
  }

  recordsFor(uid: string): ParticipationRecord[] {
    return this.recordsByUser().get(uid) ?? [];
  }

  async toggleExpand(uid: string): Promise<void> {
    if (this.isExpanded(uid)) {
      this.expandedUserIds.update(set => {
        const next = new Set(set);
        next.delete(uid);
        return next;
      });
      return;
    }

    this.expandedUserIds.update(set => new Set(set).add(uid));
    if (this.recordsByUser().has(uid)) return;

    this.loadingRecordsFor.update(set => new Set(set).add(uid));
    try {
      const result = await this.participationService.listByUser(uid, 20);
      this.recordsByUser.update(map => {
        const next = new Map(map);
        next.set(uid, result.items);
        return next;
      });
      await this.resolveAssignmentKinds(result.items);
    } catch (error) {
      console.error('Failed to load participation records:', error);
      this.notificationService.error('Failed to load participation records.');
    } finally {
      this.loadingRecordsFor.update(set => {
        const next = new Set(set);
        next.delete(uid);
        return next;
      });
    }
  }

  /** Looks up + caches the true `kind` (quiz vs. homework) of every not-yet-seen `homeworkId` among `records` — see `recordKindLabel`. */
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
   * says whether the attempt went through an assignment at all, never what
   * kind of content that assignment actually is. See the identical helper on
   * `ApplicationAdminDashboardViewComponent` for the full explanation.
   */
  recordKindLabel(record: ParticipationRecord): AssignmentKind {
    if (record.homeworkId) {
      return this.assignmentKindByHomeworkId().get(record.homeworkId) ?? 'homework';
    }
    return record.type === 'quiz' ? 'quiz' : 'homework';
  }

  scorePercent(record: ParticipationRecord): number {
    return participationScorePercent(record);
  }

  openDetails(record: ParticipationRecord, studentName: string): void {
    this.detailsSelection.set({ record, studentName });
  }

  async remove(record: ParticipationRecord): Promise<void> {
    if (!confirm('Delete this participation record? This cannot be undone.')) return;

    try {
      await this.participationService.remove(record);
      this.recordsByUser.update(map => {
        const next = new Map(map);
        next.set(record.childId, (next.get(record.childId) ?? []).filter(r => r.id !== record.id));
        return next;
      });
      this.participants.update(users => users.map(u =>
        u.uid === record.childId ? { ...u, participationCount: Math.max(0, (u.participationCount ?? 0) - 1) } : u
      ));
      this.notificationService.success('Participation record deleted.');
    } catch (error) {
      console.error('Failed to delete participation record:', error);
      this.notificationService.error('Failed to delete participation record.');
    }
  }

  closeDetails(): void {
    this.detailsSelection.set(null);
  }

  /** Two-letter avatar initials from a display name, matching the dashboard's convention. */
  getInitials(name: string | undefined): string {
    const trimmed = name?.trim();
    if (!trimmed) return '?';
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  navigateBack(): void {
    this.router.navigate(['/admin-dashboard']);
  }
}
