import { Component, signal, inject, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ClickOutsideDirective } from '../../../directives';
import { AuthService } from '../../../services/auth';
import {
  ParticipationService,
  HomeworkParticipationService,
  TeacherScopeService,
  TeacherStatsService,
  TeacherRosterStats
} from '../../../services/admin';
import { ScopedClass } from '../../../interfaces';
import { HomeworkService } from '../../../services/homework.service';
import { QuizService } from '../../../services/quiz.service';
import { NotificationService } from '../../../services/notification.service';
import {
  Teacher, ClassGroup, Subject, Stage, User,
  ParticipationRecord, HomeworkAssignment, AssignmentKind
} from '../../../models';
import { classesForTeacher } from '../../../shared/teaching';
import { participationScorePercent } from '../../../shared/participation-score';
import { ParticipationAnswersPopupComponent } from './participation-answers-popup.component';
import { KpiSkeletonComponent } from './kpi-skeleton.component';

/** Per-subject rollup of a student's activity on this teacher's assignments. */
interface SubjectStat {
  subjectId: string;
  total: number;
  completed: number;
  averageScore: number;
}

/** One student's row in the assignment-tracking popup. */
interface TrackingRow {
  uid: string;
  name: string;
  status: 'completed' | 'in-progress' | 'overdue' | 'not-started';
  /**
   * Questions answered correctly / incorrectly, `null` until the attempt is
   * completed.
   *
   * Deliberately not the record's `score`: despite the name that field is a raw
   * correct-answer count, not a percentage (the percentage is `scorePercent`, or
   * `participationScorePercent()` for records predating it). The row used to
   * render `score` with a `%` sign appended, so 7 correct out of 10 displayed as
   * "7%".
   */
  correctCount: number | null;
  wrongCount: number | null;
  endedAt: number | null;
}

@Component({
  selector: 'app-teacher-dashboard-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, TranslatePipe, ParticipationAnswersPopupComponent, KpiSkeletonComponent, ClickOutsideDirective],
  templateUrl: './teacher-dashboard-view.component.html',
})
export class TeacherDashboardViewComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly teacherScope = inject(TeacherScopeService);
  private readonly teacherStats = inject(TeacherStatsService);
  private readonly participationService = inject(ParticipationService);
  private readonly homeworkParticipationService = inject(HomeworkParticipationService);
  private readonly homeworkService = inject(HomeworkService);
  private readonly quizService = inject(QuizService);
  private readonly notification = inject(NotificationService);

  readonly currentUser = this.authService.user;

  // Reference data
  readonly teacher = signal<Teacher | null>(null);
  readonly classes = signal<ClassGroup[]>([]);
  readonly subjects = signal<Subject[]>([]);
  readonly stages = signal<Stage[]>([]);
  readonly students = signal<User[]>([]);
  readonly assignments = signal<HomeworkAssignment[]>([]);
  readonly quizList = this.quizService.quizList;

  // UI state
  readonly activeTab = signal<'students' | 'assignments'>('students');
  readonly isLoading = signal(false);
  readonly searchQuery = signal('');
  readonly classFilter = signal('');

  // Selected student details
  readonly selectedStudent = signal<User | null>(null);
  readonly selectedStudentParticipations = signal<ParticipationRecord[]>([]);
  readonly selectedStudentParticipationCursor = signal<string | undefined>(undefined);

  // Assignment tracking popup
  readonly trackingAssignment = signal<HomeworkAssignment | null>(null);
  readonly trackingRows = signal<TrackingRow[]>([]);
  readonly isLoadingTracking = signal(false);

  // Answer-review popup (per participation attempt). The record is handed to the
  // standalone <app-participation-answers-popup> which renders the breakdown.
  readonly answersRecord = signal<ParticipationRecord | null>(null);

  /** Classes this teacher actually educates in (assigned + shared subject). */
  readonly myClasses = computed<ClassGroup[]>(() => {
    const teacher = this.teacher();
    return teacher ? classesForTeacher(teacher, this.classes()) : [];
  });

  readonly mySubjects = computed<Subject[]>(() => {
    const ids = new Set(this.teacher()?.subjectIds ?? []);
    return this.subjects().filter(s => ids.has(s.id));
  });

  readonly filteredStudents = computed<User[]>(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const classId = this.classFilter();
    return this.students().filter(s => {
      if (classId && s.classId !== classId) return false;
      if (!q) return true;
      return (s.displayName ?? '').toLowerCase().includes(q)
        || (s.mobileNumber ?? '').includes(q)
        || this.getClassName(s.classId).toLowerCase().includes(q);
    });
  });

  /** Roster grouped by class for display (scoping owned by TeacherScopeService). */
  readonly studentsByClass = computed<ScopedClass[]>(() => {
    const groups = TeacherScopeService.groupByClass(
      this.teacher(), this.myClasses(), this.mySubjects(), this.filteredStudents()
    );
    // While searching/filtering, hide classes with no matches.
    const isFiltering = !!this.searchQuery().trim() || !!this.classFilter();
    return isFiltering ? groups.filter(g => g.students.length > 0) : groups;
  });

  readonly activeAssignmentCount = computed(() =>
    this.assignments().filter(a => a.active).length
  );

  /**
   * Roster size and mean score, rolled up from the per-class aggregates that
   * database triggers maintain.
   *
   * Both figures used to be derived client-side and both were wrong in their
   * own way: the roster size required loading every user in the database, and
   * the average read `user.participations` — a field nothing writes, since
   * submissions live under `participationsByUser` — so it always showed 0%.
   */
  readonly rosterStats = signal<TeacherRosterStats>({
    studentCount: 0,
    averageScore: 0,
    scoredCount: 0
  });

  /**
   * True until the class aggregates land.
   *
   * Starts `true` so the tiles never briefly render zeros — the aggregates
   * resolve after the teacher profile does, so without this a teacher would see
   * "0 students" flash before their real roster size appears.
   */
  readonly isLoadingStats = signal<boolean>(true);

  readonly myStudentCount = computed(() => this.rosterStats().studentCount);
  readonly overallAverageScore = computed(() => this.rosterStats().averageScore);
  /** False when no submission has been scored yet, so the tile can say so rather than claim 0%. */
  readonly hasScoredSubmissions = computed(() => this.rosterStats().scoredCount > 0);

  /**
   * Per-student average score for the roster rows, keyed by uid.
   *
   * `User.participations` (an embedded array) is what `averageScoreOf` used to
   * read — nothing in the app has ever written that field, so the badge always
   * fell through to "No scores yet" regardless of a student's real history.
   * This fetches each *visible* roster student's actual records in parallel —
   * see {@link visibleStudentsOf} / {@link showMoreStudents} — rather than the
   * whole roster at once, so a teacher with a large number of students never
   * fires off one query per student in a single burst; each "Show more" click
   * only pays for the page it reveals.
   */
  readonly studentParticipationSummaries = signal<Map<string, { averageScore: number | null }>>(new Map());

  /** How many students of a class are shown before "Show more" is needed. */
  private readonly studentsPageSize = 10;
  /** How many of each class's students are currently visible, keyed by class id. Absent = the first page. */
  readonly visibleStudentCounts = signal<Map<string, number>>(new Map());

  /**
   * Per-subject stats for the selected student, joined through this teacher's
   * assignments (participation.homeworkId → assignment.subjectId).
   */
  readonly selectedStudentSubjectStats = computed<SubjectStat[]>(() => {
    const participations = this.selectedStudentParticipations();
    const subjectByHomework = new Map(
      this.assignments().filter(a => a.subjectId).map(a => [a.id, a.subjectId!])
    );
    const bySubject = new Map<string, { total: number; completed: number; scoreSum: number; scored: number }>();
    for (const p of participations) {
      const subjectId = p.homeworkId ? subjectByHomework.get(p.homeworkId) : undefined;
      if (!subjectId) continue;
      const stat = bySubject.get(subjectId) ?? { total: 0, completed: 0, scoreSum: 0, scored: 0 };
      stat.total++;
      if (p.status === 'completed') {
        stat.completed++;
        // `score` is a raw correct count; the display is a percentage.
        stat.scoreSum += participationScorePercent(p);
        stat.scored++;
      }
      bySubject.set(subjectId, stat);
    }
    return [...bySubject.entries()].map(([subjectId, s]) => ({
      subjectId,
      total: s.total,
      completed: s.completed,
      averageScore: s.scored > 0 ? Math.round(s.scoreSum / s.scored) : 0
    }));
  });

  ngOnInit(): void {
    this.loadInitialData();
  }

  /**
   * Resolve the teacher, then delegate all scoping to TeacherScopeService and
   * mirror the structured result into local signals. The view never re-derives
   * the teacher↔student relationship itself.
   */
  private async loadInitialData(): Promise<void> {
    this.isLoading.set(true);
    try {
      const user = this.currentUser();
      if (!user) return;

      const teacher = await this.teacherScope.resolveTeacher(user);
      this.teacher.set(teacher);
      if (!teacher) return;

      const scope = await this.teacherScope.loadScope(teacher);
      this.stages.set(scope.stages);
      this.classes.set(scope.allClasses);
      this.subjects.set(scope.allSubjects);
      this.students.set(scope.students);
      this.assignments.set(scope.assignments);

      // Only the first page of each class — the rest load as "Show more" is
      // clicked (see loadStudentParticipationSummaries's own doc for why).
      const firstPageOfEachClass = this.studentsByClass()
        .flatMap(group => group.students.slice(0, this.studentsPageSize));

      await Promise.all([
        this.loadRosterStats(),
        this.loadStudentParticipationSummaries(firstPageOfEachClass)
      ]);
    } catch (error) {
      console.error('Failed to load teacher dashboard:', error);
      this.notification.error('Failed to load dashboard data. Please refresh and try again.');
    } finally {
      this.isLoading.set(false);
      // Backstop: `loadRosterStats` clears this itself, but it never runs if we
      // bailed earlier, and a stuck flag would shimmer the tiles indefinitely.
      this.isLoadingStats.set(false);
    }
  }

  /**
   * Roll the aggregates for this teacher's classes into the KPI tiles.
   *
   * Falls back to counting the already-loaded roster if the aggregates are
   * missing — they are only absent before `recomputeClassStats` has seeded
   * them, and a plausible number beats a zero while that is outstanding.
   */
  private async loadRosterStats(): Promise<void> {
    const classIds = this.myClasses().map(c => c.id);
    try {
      const stats = await this.teacherStats.getRosterStats(classIds);
      this.rosterStats.set(
        stats.studentCount === 0 && this.students().length > 0
          ? { ...stats, studentCount: this.students().length }
          : stats
      );
    } catch (error) {
      console.warn('Class aggregates unavailable, falling back to the loaded roster:', error);
      this.rosterStats.set({
        studentCount: this.students().length,
        averageScore: 0,
        scoredCount: 0
      });
    } finally {
      // Cleared in `finally` so a failed load reveals the tiles rather than
      // leaving a skeleton shimmering forever.
      this.isLoadingStats.set(false);
    }
  }

  /**
   * Fetch the given students' own completed-submission average, in parallel,
   * and merge the result into {@link studentParticipationSummaries}.
   *
   * Called with one class's worth of students at a time — the first page on
   * load, then whatever "Show more" just revealed — never the whole roster
   * in one burst, so a teacher with a lot of students never fires off one
   * query per student at once. Merges rather than replaces so an earlier
   * page's summaries survive a later page's fetch.
   *
   * `pageSize: 200` rather than a full pagination loop: a school-year's worth
   * of one student's participations is nowhere near that, so in practice this
   * is exhaustive without the extra round trips a cursor loop would cost for
   * no real gain. A student whose history genuinely exceeds that would show a
   * (slightly) partial average rather than none — still strictly better than
   * the permanent "No scores yet" this replaces.
   */
  private async loadStudentParticipationSummaries(students: User[]): Promise<void> {
    if (students.length === 0) return;
    try {
      const entries = await Promise.all(students.map(async student => {
        const { items } = await this.participationService.listByUser(student.uid, 200);
        const completed = items.filter(p => p.status === 'completed');
        const averageScore = completed.length > 0
          ? Math.round(completed.reduce((sum, p) => sum + participationScorePercent(p), 0) / completed.length)
          : null;
        return [student.uid, { averageScore }] as const;
      }));
      this.studentParticipationSummaries.update(map => {
        const next = new Map(map);
        for (const [uid, summary] of entries) next.set(uid, summary);
        return next;
      });
    } catch (error) {
      // Non-fatal: the roster and KPI tiles still render, just without
      // per-row averages — better than failing the whole dashboard load.
      console.warn('Failed to load per-student participation summaries:', error);
    }
  }

  /** The page of a class's roster currently shown — see {@link showMoreStudents}. */
  visibleStudentsOf(group: ScopedClass): User[] {
    const count = this.visibleStudentCounts().get(group.cls.id) ?? this.studentsPageSize;
    return group.students.slice(0, count);
  }

  /** Whether this class has students beyond the currently visible page. */
  hasMoreStudents(group: ScopedClass): boolean {
    const count = this.visibleStudentCounts().get(group.cls.id) ?? this.studentsPageSize;
    return group.students.length > count;
  }

  /** Reveal this class's next page of students and fetch scores for just that page. */
  async showMoreStudents(group: ScopedClass): Promise<void> {
    const classId = group.cls.id;
    const currentCount = this.visibleStudentCounts().get(classId) ?? this.studentsPageSize;
    const nextCount = currentCount + this.studentsPageSize;
    const newlyVisible = group.students.slice(currentCount, nextCount);

    this.visibleStudentCounts.update(map => {
      const next = new Map(map);
      next.set(classId, nextCount);
      return next;
    });

    await this.loadStudentParticipationSummaries(newlyVisible);
  }

  /** Reload just this teacher's assignments (after create/activate/deactivate). */
  private async loadAssignments(): Promise<void> {
    const user = this.currentUser();
    if (!user) return;
    this.assignments.set(await this.homeworkService.listByCreator());
  }

  // ---- Student details -----------------------------------------------------

  async selectStudent(student: User): Promise<void> {
    this.selectedStudent.set(student);
    this.selectedStudentParticipations.set([]);
    this.selectedStudentParticipationCursor.set(undefined);
    await this.loadStudentParticipations();
  }

  async loadStudentParticipations(): Promise<void> {
    const student = this.selectedStudent();
    if (!student) return;
    // Defense in depth: only read participations for students in this teacher's roster.
    if (!TeacherScopeService.canAccessStudent(student, this.myClasses())) {
      this.notification.error('You can only view students in your own classes.');
      return;
    }
    this.isLoading.set(true);
    try {
      const result = await this.participationService.listByUser(student.uid, 20, this.selectedStudentParticipationCursor());
      this.selectedStudentParticipations.update(items => [...items, ...result.items]);
      this.selectedStudentParticipationCursor.set(result.nextCursor);
    } catch {
      this.notification.error('Failed to load participation history.');
    } finally {
      this.isLoading.set(false);
    }
  }

  clearSelectedStudent(): void {
    this.selectedStudent.set(null);
    this.selectedStudentParticipations.set([]);
    this.selectedStudentParticipationCursor.set(undefined);
  }

  // ---- Answer review -------------------------------------------------------

  openAnswers(record: ParticipationRecord): void {
    this.answersRecord.set(record);
  }

  closeAnswers(): void {
    this.answersRecord.set(null);
  }

  async toggleAssignmentActive(assignment: HomeworkAssignment): Promise<void> {
    try {
      await this.homeworkService.setAssignmentActive(assignment.id, !assignment.active);
      this.notification.success(assignment.active ? 'Assignment deactivated.' : 'Assignment reactivated.');
      await this.loadAssignments();
    } catch {
      this.notification.error('Failed to update the assignment.');
    }
  }

  async deleteAssignment(assignment: HomeworkAssignment): Promise<void> {
    // Names what survives as well as what goes, and points at Deactivate —
    // "cannot be undone" alone does not tell a teacher which one they wanted.
    const confirmed = confirm(
      `Delete "${assignment.title}"? It disappears from your students' lists and cannot be undone. ` +
      `Submissions already made are kept. To close it without deleting, use Deactivate instead.`
    );
    if (!confirmed) return;

    try {
      await this.homeworkService.deleteAssignment(assignment.id);
      // The tracking popup reads this assignment; leaving it open would show a
      // progress view for something that no longer exists.
      if (this.trackingAssignment()?.id === assignment.id) this.closeTracking();
      this.notification.success('Assignment deleted.');
      await this.loadAssignments();
    } catch {
      this.notification.error('Failed to delete the assignment.');
    }
  }

  // ---- Assignment tracking ---------------------------------------------------

  async openTracking(assignment: HomeworkAssignment): Promise<void> {
    this.trackingAssignment.set(assignment);
    this.trackingRows.set([]);
    this.isLoadingTracking.set(true);
    try {
      const records: ParticipationRecord[] = [];
      let cursor: string | undefined;
      do {
        const result = await this.homeworkParticipationService.listByHomework(assignment.id, 50, cursor);
        records.push(...result.items);
        cursor = result.nextCursor;
      } while (cursor);

      const byChild = new Map(records.map(r => [r.childId, r]));
      const overdue = assignment.dueAt < Date.now();
      const rows = this.targetStudentsOf(assignment).map<TrackingRow>(target => {
        const record = byChild.get(target.uid);
        let status: TrackingRow['status'];
        if (record?.status === 'completed') status = 'completed';
        else if (record?.status === 'in-progress') status = 'in-progress';
        else status = overdue ? 'overdue' : 'not-started';
        return {
          uid: target.uid,
          name: target.name,
          status,
          correctCount: record?.status === 'completed' ? record.correctCount : null,
          wrongCount: record?.status === 'completed' ? record.wrongCount : null,
          endedAt: record?.status === 'completed' ? record.endedAt : null
        };
      });
      this.trackingRows.set(rows);
    } catch {
      this.notification.error('Failed to load assignment progress.');
    } finally {
      this.isLoadingTracking.set(false);
    }
  }

  closeTracking(): void {
    this.trackingAssignment.set(null);
    this.trackingRows.set([]);
  }

  /** The students an assignment targets: the picked uids, or the whole class. */
  private targetStudentsOf(assignment: HomeworkAssignment): { uid: string; name: string }[] {
    if (assignment.assignedChildIds?.length) {
      return assignment.assignedChildIds.map(uid => ({
        uid,
        name: this.getStudentName(uid)
      }));
    }
    return this.students()
      .filter(s => s.classId === assignment.classId)
      .map(s => ({ uid: s.uid, name: s.displayName }));
  }

  trackingCompletedCount(): number {
    return this.trackingRows().filter(r => r.status === 'completed').length;
  }

  // ---- Display helpers -------------------------------------------------------

  getStudentName(uid: string): string {
    return this.students().find(s => s.uid === uid)?.displayName ?? 'Unknown student';
  }

  /**
   * "Quiz" or "Homework" for a participation card's title — from the
   * *assignment's* own `kind`, never `record.type`.
   *
   * The two look interchangeable but answer different questions: `type` is
   * `payload.homeworkId ? 'homework' : 'quiz'` (see `submit-quiz.ts`) — it
   * only records whether the attempt was reached through an assignment at
   * all, not what kind of content that assignment is. A Quiz-kind assignment
   * taken via "Start" still has `homeworkId` set, so `record.type` reads
   * `'homework'` for it — which is why every participation card here used to
   * say "Homework: ..." even for assignments the Assignments tab itself
   * labels "Quiz". A record with no linked assignment (`homeworkId` unset) is
   * unambiguous: it can only be a self-serve bank quiz.
   */
  assignmentKindOf(record: ParticipationRecord): AssignmentKind {
    if (!record.homeworkId) return 'quiz';
    const assignment = this.assignments().find(a => a.id === record.homeworkId);
    return assignment?.kind ?? 'homework';
  }

  getClassName(classId: string | undefined): string {
    if (!classId) return '—';
    return this.classes().find(c => c.id === classId)?.name ?? classId;
  }

  getStageName(stageId: string | undefined): string {
    if (!stageId) return '—';
    return this.stages().find(s => s.id === stageId)?.name ?? stageId;
  }

  getSubjectName(subjectId: string | undefined): string {
    if (!subjectId) return 'General';
    return this.subjects().find(s => s.id === subjectId)?.name ?? subjectId;
  }

  getSubjectColor(subjectId: string | undefined): string | undefined {
    if (!subjectId) return undefined;
    return this.subjects().find(s => s.id === subjectId)?.color;
  }

  getQuizName(quizId: number): string {
    return this.quizList().find(q => q.id === quizId)?.name ?? `Quiz #${quizId}`;
  }

  studentInitial(student: User): string {
    return student.displayName?.charAt(0)?.toUpperCase() || '?';
  }

  participationCountOf(student: User): number {
    return student.participationCount ?? (student.participations?.length ?? 0);
  }

  /**
   * Mean of the student's completed submissions, as the percentage the badge
   * renders — from {@link studentParticipationSummaries}, populated once by
   * {@link loadStudentParticipationSummaries}. `null` both before that fetch
   * resolves and when the student genuinely has no scored submission yet; the
   * template's "No scores yet" fallback reads the same either way, which is
   * the right call for a summary that only takes a moment to arrive.
   */
  averageScoreOf(student: User): number | null {
    return this.studentParticipationSummaries().get(student.uid)?.averageScore ?? null;
  }

  /** Subjects this teacher educates in a given class (delegated to TeacherScopeService). */
  subjectsTaughtIn(cls: ClassGroup): Subject[] {
    return TeacherScopeService.subjectsTaughtIn(this.teacher(), cls, this.mySubjects());
  }

  isOverdue(dueAt: number): boolean {
    return dueAt < Date.now();
  }
}
