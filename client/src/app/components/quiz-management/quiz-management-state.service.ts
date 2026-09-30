import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../services/auth';
import { TeacherScopeService, HomeworkParticipationService, TeacherStatsService, TeacherRosterStats, GradeService } from '../../services/admin';
import { HomeworkService } from '../../services/homework.service';
import { QuizService } from '../../services/quiz.service';
import { TeacherQuizService } from '../../services/teacher-quiz.service';
import { NotificationService } from '../../services/notification.service';
import { QuizInfo } from '../../interfaces';
import {
  Teacher, ClassGroup, Subject, Stage, Grade, User,
  ParticipationRecord, HomeworkAssignment, AssignmentKind, HomeworkSemester,
  TeacherQuiz
} from '../../models';
import { classesForTeacher } from '../../shared/teaching';
import { splitAssignmentTargets } from '../../shared/assignment-targets';
import { participationScorePercent } from '../../shared/participation-score';
import {
  indexQuizzesById, effectiveSubjectId, effectiveSemester, assignmentKind,
  filterAssignments, SemesterFilter, KindFilter
} from '../../shared/quiz-management';

/** One reviewable submission (quiz or homework) surfaced in the Validation tab. */
export interface ValidationItem {
  /**
   * The assignment this submission answers, or `null` for an attempt at a bank
   * quiz — those reach a student off their own list, with no assignment behind
   * them, and name their reviewer on the quiz instead (`QuizAdminItem.reviewerId`).
   */
  assignment: HomeworkAssignment | null;
  record: ParticipationRecord;
  studentName: string;
  /** What to call this piece of work: the assignment's title, else the quiz's name. */
  title: string;
  /**
   * Whether it reads as a quiz or as homework. Taken from the assignment when
   * there is one; a bank quiz is always a quiz.
   */
  kind: AssignmentKind;
}

/**
 * Shared state for the Quiz Management workspace.
 *
 * Deliberately **not** `providedIn: 'root'` — it is listed in the `providers` of
 * the `/quiz-management` parent route, so one instance is created when a teacher
 * enters the workspace, shared by the shell and every tab component beneath it,
 * and destroyed on the way out. That scoping is what lets the tabs be separate
 * routed components without each one re-loading the teacher's scope: the
 * expensive {@link loadInitialData} fetch happens once per visit, not once per
 * tab.
 *
 * All teacher↔student scoping is delegated to {@link TeacherScopeService} (the
 * same loader the dashboard uses); this service owns the workspace-wide filter
 * state, the on-demand participation cache, and the assignment form.
 */
@Injectable()
export class QuizManagementStateService {
  private readonly authService = inject(AuthService);
  private readonly teacherScope = inject(TeacherScopeService);
  private readonly teacherStats = inject(TeacherStatsService);
  private readonly homeworkParticipationService = inject(HomeworkParticipationService);
  private readonly homeworkService = inject(HomeworkService);
  private readonly quizService = inject(QuizService);
  private readonly teacherQuizService = inject(TeacherQuizService);
  private readonly notification = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly gradeService = inject(GradeService);

  readonly currentUser = this.authService.user;

  // ---- Reference data (scoped to this teacher) -------------------------------
  readonly teacher = signal<Teacher | null>(null);
  readonly classes = signal<ClassGroup[]>([]);
  readonly subjects = signal<Subject[]>([]);
  readonly stages = signal<Stage[]>([]);
  /** Grade list for the assignment form's Grade select; loaded with the form. */
  readonly grades = signal<Grade[]>([]);
  readonly students = signal<User[]>([]);
  readonly assignments = signal<HomeworkAssignment[]>([]);
  readonly quizList = this.quizService.quizList;
  /** This teacher's own authored quizzes/homework content (`teacherQuizzes`). */
  readonly myCustomQuizzes = signal<TeacherQuiz[]>([]);
  readonly customQuizById = computed(() => new Map(this.myCustomQuizzes().map(q => [q.id, q])));

  readonly isLoading = signal(false);

  // ---- Global filter bar -----------------------------------------------------
  readonly filterSubjectId = signal('');
  readonly filterSemester = signal<SemesterFilter>('all');
  readonly filterClassId = signal('');
  readonly filterKind = signal<KindFilter>('all');
  readonly searchQuery = signal('');

  /** `label` holds an i18n key under the shared `semester.*` dictionary — keeps this wording identical to every other semester picker in the app (e.g. the admin's quiz/question bank). */
  readonly semesterOptions: { value: HomeworkSemester; label: string }[] = [
    { value: 'first',  label: 'semester.first'  },
    { value: 'second', label: 'semester.second' },
    { value: 'full',   label: 'semester.full'   }
  ];

  // ---- Per-assignment participation cache (loaded on demand) ------------------
  readonly recordsByAssignment = signal<Map<string, ParticipationRecord[]>>(new Map());
  readonly isLoadingRecords = signal(false);

  // ---- Participation tab selection -------------------------------------------
  /**
   * Held as an id rather than the assignment object so {@link selectedAssignment}
   * can derive itself from the *filtered* list — narrowing the filter bar until
   * the tracked assignment drops out clears the selection with no extra
   * bookkeeping, which is what the pre-split `onFilterChange` did by hand.
   */
  readonly selectedAssignmentId = signal<string | null>(null);

  readonly selectedAssignment = computed<HomeworkAssignment | null>(() => {
    const id = this.selectedAssignmentId();
    return id ? this.filteredAssignments().find(a => a.id === id) ?? null : null;
  });

  // ---- Assignment creation form ----------------------------------------------
  readonly showAssignmentForm = signal(false);
  readonly editingAssignmentId = signal<string | null>(null);
  readonly editingAssignmentSnapshot = signal<HomeworkAssignment | null>(null);
  readonly assignTitle = signal('');
  readonly assignKind = signal<AssignmentKind>('quiz');
  readonly assignQuizId = signal('');
  readonly assignSubjectId = signal('');

  /**
   * Stage and grade narrow the group list; they are not stored as choices of
   * their own. An assignment's `stageId`/`gradeId` are still written, but they
   * come from the chosen group, which already determines both — asking for
   * them twice is how the two get to disagree.
   */
  readonly assignStageId = signal('');
  readonly assignGradeId = signal('');

  /**
   * The groups receiving this assignment.
   *
   * A `HomeworkAssignment` holds a single `classId`, and that field is read in
   * nine places — including `submit-quiz.ts`, where it decides whether a
   * student is allowed to submit at all. So "assign to 9-A and 9-B" is written
   * as one assignment per group rather than by widening the field: the
   * downstream aggregates, eligibility checks and student queries all keep
   * working unchanged. Editing an existing assignment edits its one record, so
   * this holds exactly one id in that mode.
   */
  readonly assignClassIds = signal<string[]>([]);

  readonly assignDueAt = signal('');
  readonly assignTargetMode = signal<'class' | 'students'>('class');
  readonly assignSelectedUids = signal<string[]>([]);
  /** Filters the student picker by name — a grade's roster is too long to scan. */
  readonly assignStudentSearch = signal('');
  readonly isSaving = signal(false);
  readonly formError = signal('');

  // ---- Derived scoping -------------------------------------------------------
  readonly myClasses = computed<ClassGroup[]>(() => {
    const teacher = this.teacher();
    return teacher ? classesForTeacher(teacher, this.classes()) : [];
  });

  readonly mySubjects = computed<Subject[]>(() => {
    const ids = new Set(this.teacher()?.subjectIds ?? []);
    return this.subjects().filter(s => ids.has(s.id));
  });

  /** Stages this teacher actually teaches, derived from their classes (a teacher may span more than one). */
  readonly myStages = computed<Stage[]>(() => {
    const ids = new Set(this.myClasses().map(c => c.stageId));
    return this.stages().filter(s => ids.has(s.id));
  });

  readonly quizById = computed(() => indexQuizzesById(this.quizList()));

  /** Assignments after the global filter bar is applied. */
  readonly filteredAssignments = computed<HomeworkAssignment[]>(() =>
    filterAssignments(
      this.assignments(),
      {
        subjectId: this.filterSubjectId(),
        semester: this.filterSemester(),
        classId: this.filterClassId(),
        kind: this.filterKind(),
        search: this.searchQuery()
      },
      this.quizById(),
      (assignment) => this.assignmentQuizName(assignment)
    )
  );

  readonly activeAssignmentCount = computed(() =>
    this.filteredAssignments().filter(a => a.active).length
  );

  /**
   * Roster-wide average score, read from the same `classStats` aggregate the
   * teacher dashboard's KPI tile uses (`TeacherStatsService.getRosterStats`).
   *
   * Used to be "denormalized per-student scores, no extra reads" — summing
   * `User.participations`, an array field nothing in the app has ever
   * written, so this was 0% for every teacher regardless of real activity.
   * `classStats` already solves exactly this ("average score across my
   * classes") correctly and cheaply; this reuses it rather than inventing a
   * second, differently-broken way to ask the same question.
   */
  readonly rosterScoreStats = signal<TeacherRosterStats>({ studentCount: 0, averageScore: 0, scoredCount: 0 });
  readonly overallAverageScore = computed(() => this.rosterScoreStats().averageScore);

  /**
   * Completed attempts at bank quizzes that name this teacher as reviewer.
   *
   * Kept in its own signal rather than folded into `recordsByAssignment`, which
   * is keyed by assignment id — these have no assignment to key by. Loaded by
   * {@link loadReviewerRecords}.
   */
  readonly reviewerRecords = signal<ParticipationRecord[]>([]);

  // ---- Validation roll-up (shell needs the count for the tab badge) ----------
  readonly validationItems = computed<ValidationItem[]>(() => {
    const cache = this.recordsByAssignment();
    const items: ValidationItem[] = [];
    for (const assignment of this.filteredAssignments()) {
      // Every kind of assigned work is reviewable: quizzes are auto-scored, but
      // they can still contain Explain questions that need a mark, and the
      // teacher's verdict applies to both kinds. Both write their submissions to
      // `participationsByHomework/{assignmentId}`, so both are already loaded.
      const records = cache.get(assignment.id);
      if (!records) continue;
      for (const record of records) {
        if (record.status !== 'completed') continue;
        items.push({
          assignment,
          record,
          studentName: this.getStudentName(record.childId),
          title: assignment.title,
          kind: assignment.kind ?? 'homework'
        });
      }
    }

    // Bank quizzes. No assignment, so nothing above reaches them — they are here
    // because the quiz named this teacher as its reviewer, which is the only
    // thing that makes such a submission gradable at all.
    for (const record of this.reviewerRecords()) {
      if (record.status !== 'completed') continue;
      items.push({
        assignment: null,
        record,
        studentName: this.getStudentName(record.childId),
        title: record.quizName || record.homeworkTitle || '',
        kind: 'quiz'
      });
    }
    return items;
  });

  readonly pendingValidationCount = computed(() =>
    this.validationItems().filter(i => !i.record.validation).length
  );


  // ---- Assignment form derived state -----------------------------------------

  /** Grades inside the chosen stage, in authored order. */
  readonly assignGradeOptions = computed<Grade[]>(() => {
    const stageId = this.assignStageId();
    const grades = stageId ? this.grades().filter(g => g.stageId === stageId) : this.grades();
    return [...grades].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  });

  /**
   * The teacher's own groups, narrowed by the chosen stage and grade.
   *
   * Still drawn from `myClasses()` rather than every class in the school, so
   * the stage/grade selects can only ever narrow what a teacher was already
   * allowed to assign to — they never widen it.
   */
  readonly assignableClasses = computed<ClassGroup[]>(() => {
    const stageId = this.assignStageId();
    const gradeId = this.assignGradeId();
    return this.myClasses().filter(cls =>
      (!stageId || cls.stageId === stageId) &&
      (!gradeId || cls.gradeId === gradeId)
    );
  });

  /**
   * Students across every selected group, filtered by the search box.
   *
   * Pooled rather than per-group: the teacher is picking people, and which of
   * the chosen groups each one sits in is the save path's problem, not
   * something they should have to navigate here.
   */
  readonly assignableStudents = computed<User[]>(() => {
    const classIds = new Set(this.assignClassIds());
    if (classIds.size === 0) return [];
    const search = this.assignStudentSearch().toLowerCase().trim();
    return this.students()
      .filter(s => s.classId && classIds.has(s.classId))
      .filter(s => !search || (s.displayName ?? '').toLowerCase().includes(search));
  });

  /**
   * Assignable quizzes: scoped to the subjects and stages the teacher teaches.
   *
   * No longer narrowed by semester — a quiz's semester is settled when it is
   * authored, so asking again here only hid quizzes the teacher had already
   * classified. Scoped by the first selected group: `scopeQuizzes` takes one
   * class, and every group in a single assignment shares the subject that
   * scoping actually turns on.
   */
  readonly assignableQuizzes = computed<QuizInfo[]>(() =>
    TeacherScopeService.scopeQuizzes({
      teacher: this.teacher(),
      classes: this.myClasses(),
      quizzes: this.quizList(),
      subjectId: this.assignSubjectId() || undefined,
      classId: this.assignClassIds()[0] || undefined
    })
  );

  /** This teacher's own custom quizzes, narrowed by the form's subject (same rule as {@link assignableQuizzes}). */
  readonly assignableCustomQuizzes = computed<TeacherQuiz[]>(() => {
    const subjectId = this.assignSubjectId();
    return this.myCustomQuizzes().filter(q => !subjectId || q.subjectId === subjectId);
  });

  // ---- Loading ---------------------------------------------------------------

  /**
   * Loads this teacher's whole scope. Idempotent per signed-in teacher, so tab
   * components can call it freely on activation without re-fetching.
   */
  private initPromise: Promise<void> | null = null;

  /**
   * The uid whose data is currently in these signals, so a change of account
   * can be detected rather than assumed impossible.
   *
   * This service is provided on the `/quiz-management` route, so in principle
   * leaving the workspace destroys it and the question never arises. In
   * practice it is not safe to rely on that: signing out flips
   * `isAuthenticated()` *before* the navigation to `/login` completes, which
   * swaps the app shell's `router-outlet` while this route is still the active
   * one. The component tree is rebuilt against the same route injector — the
   * same instance, still holding the previous teacher's classes, students,
   * assignments and participation cache — and `initPromise` is already
   * resolved, so the rebuilt shell's `init()` is a no-op that re-displays it.
   *
   * Guarding on the uid makes this correct whatever the router does with the
   * instance, which is the same approach `TenantService`, `QuizService` and
   * `TeacherReviewQueueService` each take for their own state.
   */
  private loadedForUid: string | null = null;

  constructor() {
    effect(() => {
      const uid = this.authService.user()?.uid ?? null;
      if (uid !== this.loadedForUid) untracked(() => this.resetForAccountChange());
    }, { allowSignalWrites: true });
  }

  init(): Promise<void> {
    const uid = this.currentUser()?.uid ?? null;
    // Never memoize a load that had no one to load for: doing so would leave
    // this instance permanently "initialised" with nothing in it, and the next
    // real sign-in would show an empty workspace.
    if (!uid) return Promise.resolve();
    if (this.initPromise && this.loadedForUid === uid) return this.initPromise;

    // The uid is claimed *before* the load, not after it. Setting it on
    // completion instead leaves a window where the guard effect sees
    // `loadedForUid` still null while this teacher's data is already landing
    // in the signals — and resets, wiping the workspace it just loaded.
    this.loadedForUid = uid;
    this.initPromise = this.loadInitialData();
    return this.initPromise;
  }

  /**
   * Drop everything tied to the previous account.
   *
   * Clearing `initPromise` is the load-bearing half — without it the next
   * `init()` returns the old resolved promise and nothing is re-fetched.
   */
  private resetForAccountChange(): void {
    this.initPromise = null;
    this.loadedForUid = null;

    this.teacher.set(null);
    this.classes.set([]);
    this.subjects.set([]);
    this.stages.set([]);
    this.grades.set([]);
    this.gradesLoaded = false;
    this.students.set([]);
    this.assignments.set([]);
    this.myCustomQuizzes.set([]);
    this.rosterScoreStats.set({ studentCount: 0, averageScore: 0, scoredCount: 0 });

    this.recordsByAssignment.set(new Map());
    this.reviewerRecords.set([]);
    this.selectedAssignmentId.set(null);

    // Filters and the open form are this teacher's working context too — a
    // group filter naming a class the next account cannot see would silently
    // empty every tab.
    this.filterSubjectId.set('');
    this.filterSemester.set('all');
    this.filterClassId.set('');
    this.filterKind.set('all');
    this.searchQuery.set('');
    this.closeAssignmentForm();
  }

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

      // Independent sources: a failure in one must not blank the other.
      const classIds = this.myClasses().map(c => c.id);
      const [customQuizzes, rosterStats] = await Promise.allSettled([
        this.teacherQuizService.listByCreator(),
        this.teacherStats.getRosterStats(classIds)
      ]);
      if (customQuizzes.status === 'fulfilled') this.myCustomQuizzes.set(customQuizzes.value);
      if (rosterStats.status === 'fulfilled') this.rosterScoreStats.set(rosterStats.value);
      const failure = [customQuizzes, rosterStats].find((result): result is PromiseRejectedResult => result.status === 'rejected');
      if (failure) throw failure.reason;
    } catch (error) {
      console.error('Failed to load quiz management:', error);
      this.notification.error('Failed to load quiz management data. Please refresh and try again.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadAssignments(): Promise<void> {
    const user = this.currentUser();
    if (!user) return;
    this.assignments.set(await this.homeworkService.listByCreator());
  }

  async loadCustomQuizzes(): Promise<void> {
    const user = this.currentUser();
    if (!user) return;
    this.myCustomQuizzes.set(await this.teacherQuizService.listByCreator());
  }

  /**
   * Ensure participation records for `assignments` are in the cache, draining the
   * by-homework index per assignment concurrently. `force` re-fetches even cached
   * entries (used by the Refresh action).
   */
  async loadRecordsFor(assignments: HomeworkAssignment[], force = false): Promise<void> {
    const cache = this.recordsByAssignment();
    const targets = force ? assignments : assignments.filter(a => !cache.has(a.id));
    if (targets.length === 0) return;

    this.isLoadingRecords.set(true);
    try {
      const loaded = await Promise.all(targets.map(async assignment => {
        const records: ParticipationRecord[] = [];
        let cursor: string | undefined;
        do {
          const page = await this.homeworkParticipationService.listByHomework(assignment.id, 50, cursor);
          records.push(...page.items);
          cursor = page.nextCursor;
        } while (cursor);
        return [assignment.id, records] as const;
      }));
      this.recordsByAssignment.update(map => {
        const next = new Map(map);
        for (const [id, records] of loaded) next.set(id, records);
        return next;
      });
    } catch {
      this.notification.error('Failed to load participation data.');
    } finally {
      this.isLoadingRecords.set(false);
    }
  }

  /**
   * Shell-level Refresh: re-reads the participation records this workspace has
   * already loaded, rather than every filtered assignment.
   *
   * Scoping to what's cached is what keeps the button cheap on the Participation
   * tab, which only ever loads the one assignment being tracked — refreshing the
   * whole filtered set there would fire a paginated query per assignment. On
   * Results and Validation the tab has already loaded all of it, so the cache
   * intersection is the filtered set anyway.
   */
  refreshRecords(): Promise<void> {
    const cache = this.recordsByAssignment();
    return this.loadRecordsFor(this.filteredAssignments().filter(a => cache.has(a.id)), true);
  }

  /**
   * Replace one submission in the cache — used by the Validation tab so a saved
   * verdict updates every badge without a full reload.
   */
  patchRecord(assignmentId: string | null, recordId: string, patch: Partial<ParticipationRecord>): void {
    // A bank-quiz submission lives in `reviewerRecords`, not in the
    // by-assignment cache, so it is patched by record id alone.
    if (assignmentId === null) {
      this.reviewerRecords.update(records =>
        records.map(r => r.id === recordId ? { ...r, ...patch } : r)
      );
      return;
    }
    this.recordsByAssignment.update(map => {
      const next = new Map(map);
      const records = next.get(assignmentId);
      if (records) {
        next.set(assignmentId, records.map(r => r.id === recordId ? { ...r, ...patch } : r));
      }
      return next;
    });
  }

  /**
   * Load the bank-quiz submissions this teacher is the named reviewer for.
   *
   * Drained in full rather than paged: the Validation tab shows the whole queue
   * and its badge counts it, so a partial read would under-report outstanding
   * work — the same reason `loadRecordsFor` drains each assignment.
   */
  async loadReviewerRecords(force = false): Promise<void> {
    const reviewerId = this.currentUser()?.id;
    if (!reviewerId) return;
    if (!force && this.reviewerRecords().length > 0) return;

    try {
      const records: ParticipationRecord[] = [];
      let cursor: string | undefined;
      do {
        const page = await this.homeworkParticipationService.listUnassignedForReviewer(reviewerId, 50, cursor);
        records.push(...page.items);
        cursor = page.nextCursor;
      } while (cursor);
      this.reviewerRecords.set(records);
    } catch {
      // Assigned work still lists; this half degrades to empty rather than
      // taking the tab down with it.
      this.reviewerRecords.set([]);
    }
  }

  /** The students an assignment targets: the picked uids, or the whole class. */
  targetStudentsOf(assignment: HomeworkAssignment): { uid: string; name: string }[] {
    if (assignment.assignedChildIds?.length) {
      return assignment.assignedChildIds.map(uid => ({ uid, name: this.getStudentName(uid) }));
    }
    return this.students()
      .filter(s => s.classId === assignment.classId)
      .map(s => ({ uid: s.id ?? '', name: s.displayName }));
  }

  // ---- Assignment creation ---------------------------------------------------

  /** Opens the popup. Pass an existing `assignment` to edit it instead of creating a new one. */
  openAssignmentForm(kind: AssignmentKind, assignment?: HomeworkAssignment): void {
    this.editingAssignmentId.set(assignment?.id ?? null);
    this.editingAssignmentSnapshot.set(assignment ?? null);
    this.assignTitle.set(assignment?.title ?? '');
    this.assignKind.set(kind);
    if (assignment) {
      this.assignQuizId.set(
        assignment.quizSource === 'custom' && assignment.customQuizId
          ? `custom:${assignment.customQuizId}`
          : String(assignment.quizId)
      );
      // Editing touches exactly one record, so the group list holds one id and
      // the template locks it — fanning an edit out across groups would create
      // assignments the teacher never asked for.
      this.assignClassIds.set([assignment.classId]);
      const editedClass = this.myClasses().find(c => c.id === assignment.classId);
      this.assignStageId.set(assignment.stageId || editedClass?.stageId || '');
      this.assignGradeId.set(assignment.gradeId || editedClass?.gradeId || '');
      this.assignSubjectId.set(assignment.subjectId ?? '');
      this.assignDueAt.set(this.formatDueDateForInput(assignment.dueAt));
      this.assignTargetMode.set(assignment.assignedChildIds?.length ? 'students' : 'class');
      this.assignSelectedUids.set(assignment.assignedChildIds ?? []);
    } else {
      this.assignQuizId.set('');
      // Seeded from the filter bar where it is set, so opening the form from a
      // filtered view starts where the teacher already is.
      const seedClass = this.myClasses().find(c => c.id === this.filterClassId());
      this.assignStageId.set(seedClass?.stageId ?? this.myStages()[0]?.id ?? '');
      this.assignGradeId.set(seedClass?.gradeId ?? '');
      this.assignClassIds.set(seedClass ? [seedClass.id] : []);
      this.assignSubjectId.set(this.filterSubjectId() || this.mySubjects()[0]?.id || '');
      this.assignDueAt.set('');
      this.assignTargetMode.set('class');
      this.assignSelectedUids.set([]);
    }
    this.assignStudentSearch.set('');
    this.formError.set('');
    this.showAssignmentForm.set(true);
    void this.loadGrades();
  }

  closeAssignmentForm(): void {
    this.showAssignmentForm.set(false);
    this.editingAssignmentId.set(null);
    this.editingAssignmentSnapshot.set(null);
  }

  private formatDueDateForInput(timestamp: number | undefined): string {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /**
   * The grade list, fetched once per workspace visit.
   *
   * Kicked off when the form opens rather than awaited: the Grade select is
   * only a narrowing filter, so the dialog opens immediately and it fills in.
   */
  private gradesLoaded = false;
  private async loadGrades(): Promise<void> {
    if (this.gradesLoaded) return;
    try {
      const items: Grade[] = [];
      let cursor: string | undefined;
      do {
        const page = await this.gradeService.listGrades(50, cursor);
        items.push(...page.items);
        cursor = page.nextCursor;
      } while (cursor);
      this.grades.set(items);
      this.gradesLoaded = true;
    } catch {
      // Losing the grade list costs a filter, not the form — stage and the
      // group list still narrow the choice on their own.
      this.grades.set([]);
    }
  }

  /** Stage changes drop any grade and groups that no longer sit inside it. */
  onAssignStageChange(stageId: string): void {
    this.assignStageId.set(stageId);
    if (!this.assignGradeOptions().some(g => g.id === this.assignGradeId())) {
      this.assignGradeId.set('');
    }
    this.pruneClassSelection();
  }

  /** Grade changes drop any groups outside the new grade. */
  onAssignGradeChange(gradeId: string): void {
    this.assignGradeId.set(gradeId);
    this.pruneClassSelection();
  }

  /** Adds or removes one group from the assignment's targets. */
  toggleAssignClass(classId: string): void {
    this.assignClassIds.update(ids =>
      ids.includes(classId) ? ids.filter(id => id !== classId) : [...ids, classId]
    );
    this.pruneStudentSelection();
    this.pruneQuizSelection();
  }

  isClassAssigned(classId: string): boolean {
    return this.assignClassIds().includes(classId);
  }

  onAssignSubjectChange(subjectId: string): void {
    this.assignSubjectId.set(subjectId);
    this.pruneQuizSelection();
  }

  /** Drop groups that the current stage/grade no longer offers. */
  private pruneClassSelection(): void {
    const allowed = new Set(this.assignableClasses().map(c => c.id));
    this.assignClassIds.update(ids => ids.filter(id => allowed.has(id)));
    this.pruneStudentSelection();
    this.pruneQuizSelection();
  }

  /**
   * Drop picked students who are no longer in any selected group — otherwise
   * deselecting a group would leave its students silently attached to the
   * assignment, targeting people the teacher can no longer see in the picker.
   */
  private pruneStudentSelection(): void {
    const classIds = new Set(this.assignClassIds());
    const stillVisible = new Set(
      this.students().filter(s => s.classId && classIds.has(s.classId)).map(s => s.id ?? '')
    );
    this.assignSelectedUids.update(uids => uids.filter(uid => stillVisible.has(uid)));
  }

  /** Clear the chosen quiz if it is no longer in the assignable list. */
  private pruneQuizSelection(): void {
    const current = this.assignQuizId();
    if (!current) return;
    if (current.startsWith('custom:')) {
      const id = current.slice('custom:'.length);
      if (!this.assignableCustomQuizzes().some(q => q.id === id)) this.assignQuizId.set('');
    } else if (!this.assignableQuizzes().some(q => String(q.id) === current)) {
      this.assignQuizId.set('');
    }
  }

  toggleAssignedStudent(uid: string): void {
    this.assignSelectedUids.update(uids =>
      uids.includes(uid) ? uids.filter(u => u !== uid) : [...uids, uid]
    );
  }

  isStudentAssigned(uid: string): boolean {
    return this.assignSelectedUids().includes(uid);
  }

  /** Saves the assignment form. Resolves `true` when the write succeeded. */
  async submitAssignment(): Promise<boolean> {
    this.formError.set('');
    const user = this.currentUser();
    const teacher = this.teacher();
    if (!user || !teacher) {
      this.formError.set('Your teacher profile could not be resolved. Please re-login.');
      return false;
    }

    const title = this.assignTitle().trim();
    const rawQuizSelection = this.assignQuizId();
    const classIds = this.assignClassIds();
    const dueAt = this.parseDueDateEndOfDay(this.assignDueAt());

    const isCustom = rawQuizSelection.startsWith('custom:');
    const quizId = isCustom ? 0 : Number(rawQuizSelection);
    const customQuizId = isCustom ? rawQuizSelection.slice('custom:'.length) : undefined;

    if (!title) { this.formError.set('Title is required.'); return false; }
    if (!rawQuizSelection || (!isCustom && !quizId)) { this.formError.set('Please select a quiz.'); return false; }
    if (classIds.length === 0) { this.formError.set('Please select at least one group.'); return false; }
    if (!dueAt || Number.isNaN(dueAt)) { this.formError.set('Please pick a due date.'); return false; }
    if (dueAt < Date.now()) { this.formError.set('The due date must be in the future.'); return false; }

    // Re-checked per group rather than once: the scope guard is the thing
    // standing between a teacher and another teacher's class, and a multi-
    // select gives more ways to end up holding an id that is not theirs.
    if (classIds.some(id => !TeacherScopeService.canAssignToClass(id, this.myClasses()))) {
      this.formError.set('You can only assign to your own classes.');
      return false;
    }
    const targetClasses = classIds
      .map(id => this.myClasses().find(c => c.id === id))
      .filter((c): c is ClassGroup => !!c);

    const assignedChildIds = this.assignTargetMode() === 'students' ? this.assignSelectedUids() : [];
    if (this.assignTargetMode() === 'students' && assignedChildIds.length === 0) {
      this.formError.set('Pick at least one student, or target the whole class.');
      return false;
    }

    const editingId = this.editingAssignmentId();
    const previous = this.editingAssignmentSnapshot();

    this.isSaving.set(true);
    try {
      const kindLabel = this.assignKind() === 'quiz' ? 'Quiz' : 'Homework';

      if (editingId && previous) {
        // One record, one group — the group multi-select is locked while
        // editing, so this is always exactly one class.
        const cls = targetClasses[0];
        await this.homeworkService.updateAssignment(
          editingId,
          {
            title,
            quizId,
            quizSource: isCustom ? 'custom' : 'bank',
            customQuizId: customQuizId ?? null,
            stageId: cls.stageId,
            gradeId: cls.gradeId || null,
            classId: cls.id,
            dueAt,
            subjectId: this.assignSubjectId() || null,
            assignedChildIds: assignedChildIds.length > 0 ? assignedChildIds : null
          }
        );
        this.notification.success(`${kindLabel} "${title}" updated.`);
      } else {
        // One assignment per group; see `splitAssignmentTargets` for the two
        // rules that governs (each group gets only its own students, and a
        // group nobody was picked from is dropped).
        const studentsByClass = new Map(this.students().map(s => [s.id ?? '', s.classId]));
        const writes = splitAssignmentTargets(
          targetClasses,
          assignedChildIds,
          uid => studentsByClass.get(uid)
        );

        if (writes.length === 0) {
          this.formError.set('None of the selected students belong to the selected groups.');
          return false;
        }

        for (const { cls, childIds } of writes) {
          await this.homeworkService.createAssignment({
            quizId,
            quizSource: isCustom ? 'custom' : 'bank',
            customQuizId,
            title,
            stageId: cls.stageId,
            gradeId: cls.gradeId || undefined,
            classId: cls.id,
            dueAt,
            createdBy: user.id ?? '',                  // the API records the author itself
            createdByName: `${teacher.firstName ?? ''} ${teacher.lastName ?? ''}`.trim() || user.displayName,
            active: true,
            kind: this.assignKind(),
            subjectId: this.assignSubjectId() || undefined,
            assignedChildIds: childIds.length > 0 ? childIds : undefined
          });
        }

        const targetLabel = assignedChildIds.length > 0
          ? `${assignedChildIds.length} student(s) across ${writes.length} group(s)`
          : writes.length === 1
            ? `group ${writes[0].cls.name}`
            : `${writes.length} groups`;
        this.notification.success(`${kindLabel} "${title}" assigned to ${targetLabel}.`);
      }

      this.closeAssignmentForm();
      await this.loadAssignments();
      return true;
    } catch (error) {
      console.error(`Failed to ${editingId ? 'update' : 'create'} assignment:`, error);
      this.formError.set(editingId ? 'Failed to update the assignment. Please try again.' : 'Failed to create the assignment. Please try again.');
      return false;
    } finally {
      this.isSaving.set(false);
    }
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
    // Same wording as the teacher dashboard's copy of this action: both lists
    // show the same assignments, so the two must not describe deleting one
    // differently.
    const confirmed = confirm(
      `Delete "${assignment.title}"? It disappears from your students' lists and cannot be undone. ` +
      `Submissions already made are kept. To close it without deleting, use Deactivate instead.`
    );
    if (!confirmed) return;

    try {
      await this.homeworkService.deleteAssignment(assignment.id);
      // The Participation tab filters by this id; left set, it would filter by
      // an assignment that no longer exists and simply show nothing.
      if (this.selectedAssignmentId() === assignment.id) this.selectedAssignmentId.set(null);
      this.notification.success('Assignment deleted.');
      await this.loadAssignments();
    } catch {
      this.notification.error('Failed to delete the assignment.');
    }
  }

  // ---- Display helpers -------------------------------------------------------

  /**
   * A submission's score as a real 0–100 percentage.
   *
   * Templates must not fall back to `record.score` when `scorePercent` is
   * absent: `score` is a raw correct-answer count, so that fallback rendered
   * 7-of-10 as "7%". The shared helper derives the ratio instead, and is the
   * same one the class-stats trigger uses, so the dashboard and the aggregates
   * cannot disagree.
   */
  scorePercentOf(record: ParticipationRecord): number {
    return participationScorePercent(record);
  }

  /** A student's name by their API user id (what records, assignments and locks name them by). */
  getStudentName(studentId: string): string {
    return this.students().find(s => s.id === studentId)?.displayName ?? 'Unknown student';
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

  /** Resolves the linked quiz's name regardless of whether it's a bank or custom quiz. */
  assignmentQuizName(assignment: HomeworkAssignment): string {
    if (assignment.quizSource === 'custom' && assignment.customQuizId) {
      return this.customQuizById().get(assignment.customQuizId)?.name ?? 'Custom quiz';
    }
    return this.getQuizName(assignment.quizId);
  }

  getSemesterLabel(semester: HomeworkSemester | undefined): string {
    if (!semester) return '—';
    const key = this.semesterOptions.find(o => o.value === semester)?.label;
    return key ? this.translate.instant(key) : semester;
  }

  /** Effective subject/semester for an assignment row (own value, else its quiz's). */
  assignmentSubjectName(assignment: HomeworkAssignment): string {
    return this.getSubjectName(effectiveSubjectId(assignment, this.quizById()));
  }

  assignmentSemesterLabel(assignment: HomeworkAssignment): string {
    return this.getSemesterLabel(effectiveSemester(assignment, this.quizById()));
  }

  /** Raw semester value (own value, else its quiz's) — drives the `semester-tag--*` color variant. */
  assignmentSemesterValue(assignment: HomeworkAssignment): HomeworkSemester | undefined {
    return effectiveSemester(assignment, this.quizById());
  }

  assignmentKindLabel(assignment: HomeworkAssignment): string {
    return assignmentKind(assignment) === 'quiz' ? 'Quiz' : 'Homework';
  }

  /** Raw `AssignmentKind` for an assignment (template helper — `assignmentKind()` is a plain imported function, not callable from templates). */
  getAssignmentKind(assignment: HomeworkAssignment): AssignmentKind {
    return assignmentKind(assignment);
  }

  studentInitial(name: string): string {
    return name?.charAt(0)?.toUpperCase() || '?';
  }

  isOverdue(dueAt: number): boolean {
    return dueAt < Date.now();
  }

  private parseDueDateEndOfDay(value: string): number {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return NaN;
    const [, y, m, d] = match;
    return new Date(Number(y), Number(m) - 1, Number(d), 23, 59, 59, 999).getTime();
  }
}
