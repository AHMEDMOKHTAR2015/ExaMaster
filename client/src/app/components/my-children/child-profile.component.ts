import { Component, ChangeDetectionStrategy, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { ParticipationService, UserAdminService } from '../../services/admin';
import { HomeworkService } from '../../services/homework.service';
import { AssignmentKind, HomeworkAssignment, ParticipationRecord, Subject, Teacher, User } from '../../models';
import { BaseComponent } from '../../shared/base/base.component';
import { resolveSubjectTeaching } from '../../shared/teaching';
import { participationScorePercent } from '../../shared/participation-score';
import {
  AssignmentProgressStatus,
  AssignmentStatusGroup,
  assignmentProgressStatus,
  assignmentStatusGroup,
  sortAssignmentsForReview
} from '../../shared/assignment-status';
import { SubjectPerformanceComponent } from '../available-quizzes/subject-performance.component';
import { ChildPlacement, SchoolStructureLookup, avatarVariant, initials } from './child-display';

const ASSIGNMENT_PAGE_SIZE = 6;
/** The latest attempt, plus a few before it for context; the full list is Participation History. */
const RECENT_ACTIVITY_COUNT = 5;

type AssignmentFilter = 'all' | AssignmentStatusGroup;

/** One teacher of the child, with the subjects they teach them. */
interface ChildTeacher {
  teacher: Teacher;
  subjects: Subject[];
}

/**
 * Everything a parent can know about one child (`/my-children/:id`): where
 * they are placed, what they did last, their level per subject, the work set
 * for them and how far they got, and who teaches them what.
 *
 * Every read is the API's to permit: `/me/children` lists only the caller's
 * own children, and the assignments, participations and subject levels of a
 * child who is not theirs are refused. Switching child (the pills in the
 * header) keeps the component and reloads only what belongs to the child.
 */
@Component({
  selector: 'app-child-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, TranslatePipe, SubjectPerformanceComponent],
  providers: [SchoolStructureLookup],
  templateUrl: './child-profile.component.html'
})
export class ChildProfileComponent extends BaseComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly userAdminService = inject(UserAdminService);
  private readonly homeworkService = inject(HomeworkService);
  private readonly participationService = inject(ParticipationService);
  protected readonly structure = inject(SchoolStructureLookup);

  protected readonly avatarVariant = avatarVariant;
  protected readonly initials = initials;

  readonly children = signal<User[]>([]);
  readonly childId = signal<string | null>(null);
  readonly child = computed(() => this.children().find(child => child.uid === this.childId()) ?? null);
  /** Set once the family has loaded and the id in the address is not one of its children. */
  readonly notFound = computed(() => !this.loading() && !this.hasError() && this.childId() !== null && !this.child());

  readonly placement = computed<ChildPlacement>(() => {
    const child = this.child();
    return child ? this.structure.placementOf(child) : {};
  });

  // ---- Per-child data, reloaded when the parent switches child ----
  readonly assignments = signal<HomeworkAssignment[]>([]);
  readonly activity = signal<ParticipationRecord[]>([]);
  readonly childDataLoading = signal(false);
  readonly childDataError = signal<string | null>(null);
  private loadToken = 0;

  readonly lastActivity = computed(() => this.activity()[0] ?? null);
  readonly earlierActivity = computed(() => this.activity().slice(1));

  // ---- Assigned work ----
  private readonly now = Date.now();
  readonly assignmentFilter = signal<AssignmentFilter>('all');
  readonly assignmentPage = signal(0);

  private readonly sortedAssignments = computed(() => sortAssignmentsForReview(this.assignments(), this.now));
  readonly assignmentCounts = computed(() => {
    const counts = { all: 0, open: 0, done: 0, overdue: 0 };
    for (const assignment of this.assignments()) {
      const status = this.statusOf(assignment);
      counts.all++;
      counts[assignmentStatusGroup(status)]++;
      if (status === 'overdue') counts.overdue++;
    }
    return counts;
  });
  private readonly filteredAssignments = computed(() => {
    const filter = this.assignmentFilter();
    return filter === 'all'
      ? this.sortedAssignments()
      : this.sortedAssignments().filter(assignment => assignmentStatusGroup(this.statusOf(assignment)) === filter);
  });
  readonly assignmentPageCount = computed(() => Math.max(1, Math.ceil(this.filteredAssignments().length / ASSIGNMENT_PAGE_SIZE)));
  readonly pagedAssignments = computed(() => {
    const start = this.assignmentPage() * ASSIGNMENT_PAGE_SIZE;
    return this.filteredAssignments().slice(start, start + ASSIGNMENT_PAGE_SIZE);
  });
  /** Page numbers to offer, with `null` where a run of them is skipped: 1 … 4 5 6 … 12. */
  readonly assignmentPageNumbers = computed<(number | null)[]>(() => {
    const count = this.assignmentPageCount();
    const current = this.assignmentPage();
    if (count <= 7) return Array.from({ length: count }, (_, index) => index);
    const pages = new Set([0, count - 1, current - 1, current, current + 1].filter(page => page >= 0 && page < count));
    const sorted = [...pages].sort((a, b) => a - b);
    return sorted.flatMap((page, index) => index > 0 && page - sorted[index - 1] > 1 ? [null, page] : [page]);
  });

  /** Mean score of the work handed in and fully marked; null while there is none. */
  readonly averageScore = computed(() => {
    const scores = this.assignments()
      .map(assignment => assignment.submission)
      .filter(submission => !!submission && submission.pendingReviewCount === 0)
      .map(submission => submission!.scorePercent);
    return scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null;
  });

  // ---- Teachers ----
  private readonly teaching = computed(() => {
    const child = this.child();
    return child ? resolveSubjectTeaching(this.structure.classOf(child), this.structure.teachers()) : [];
  });
  readonly childTeachers = computed<ChildTeacher[]>(() => {
    const byTeacher = new Map<string, ChildTeacher>();
    for (const row of this.teaching()) {
      const subject = this.structure.subject(row.subjectId);
      if (!subject) continue;
      for (const teacherId of row.teacherIds) {
        const teacher = this.structure.teachers().find(candidate => candidate.id === teacherId);
        if (!teacher) continue;
        const entry = byTeacher.get(teacherId) ?? { teacher, subjects: [] };
        entry.subjects.push(subject);
        byTeacher.set(teacherId, entry);
      }
    }
    return [...byTeacher.values()].sort((a, b) => teacherName(a.teacher).localeCompare(teacherName(b.teacher)));
  });
  /** Subjects the child's group studies that no teacher of the group covers yet. */
  readonly untaughtSubjects = computed(() => this.teaching()
    .filter(row => row.teacherIds.length === 0)
    .map(row => this.structure.subject(row.subjectId))
    .filter((subject): subject is Subject => !!subject));

  /** Assignment kind by id, so an attempt at an assigned quiz reads as a quiz (its record says "homework"). */
  private readonly kindByAssignmentId = computed(() =>
    new Map<string, AssignmentKind>(this.assignments().map(assignment => [assignment.id, assignment.kind ?? 'homework'])));

  async ngOnInit(): Promise<void> {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const id = params.get('id');
      this.childId.set(id);
      this.assignmentFilter.set('all');
      this.assignmentPage.set(0);
      if (id) void this.loadChildData(id);
    });

    this.setLoading(true);
    try {
      const [children] = await Promise.all([this.userAdminService.listMyChildren(), this.structure.load(true)]);
      this.children.set(children);
      this.setLoading(false);
    } catch (error) {
      this.setError(error instanceof Error ? error.message : String(error));
    }
  }

  private async loadChildData(childId: string): Promise<void> {
    const token = ++this.loadToken;
    this.assignments.set([]);
    this.activity.set([]);
    this.childDataError.set(null);
    this.childDataLoading.set(true);
    try {
      const [assignments, activity] = await Promise.all([
        this.homeworkService.listForChild(childId),
        this.participationService.listByUserDesc(childId, undefined, RECENT_ACTIVITY_COUNT)
      ]);
      if (token !== this.loadToken) return;
      this.assignments.set(assignments);
      this.activity.set(activity.items);
    } catch (error) {
      if (token === this.loadToken) this.childDataError.set(error instanceof Error ? error.message : String(error));
    } finally {
      if (token === this.loadToken) this.childDataLoading.set(false);
    }
  }

  setAssignmentFilter(filter: AssignmentFilter): void {
    this.assignmentFilter.set(filter);
    this.assignmentPage.set(0);
  }

  goToAssignmentPage(page: number): void {
    this.assignmentPage.set(Math.min(Math.max(0, page), this.assignmentPageCount() - 1));
  }

  statusOf(assignment: HomeworkAssignment): AssignmentProgressStatus {
    return assignmentProgressStatus(assignment, this.now);
  }

  statusBadge(status: AssignmentProgressStatus): string {
    switch (status) {
      case 'overdue':
      case 'rejected': return 'badge--danger';
      case 'awaiting': return 'badge--warning';
      case 'approved':
      case 'submitted': return 'badge--success';
      default: return 'badge--info';
    }
  }

  /** Days until (positive) or since (negative) a due date, for "due in 3 days" / "2 days late". */
  daysUntil(dueAt: number): number {
    const day = 24 * 60 * 60 * 1000;
    return Math.round((dueAt - this.now) / day);
  }

  activityKind(record: ParticipationRecord): AssignmentKind {
    if (record.homeworkId) return this.kindByAssignmentId().get(record.homeworkId) ?? record.type;
    return 'quiz';
  }

  activityTitle(record: ParticipationRecord): string {
    return record.homeworkTitle || record.quizName || `#${record.quizId}`;
  }

  activityScore(record: ParticipationRecord): number {
    return participationScorePercent(record);
  }

  subjectOf(assignment: HomeworkAssignment): Subject | undefined {
    return this.structure.subject(assignment.subjectId);
  }

  protected readonly teacherName = teacherName;
}

function teacherName(teacher: Teacher): string {
  return `${teacher.firstName} ${teacher.lastName}`.trim();
}
