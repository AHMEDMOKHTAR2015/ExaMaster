import { Component, signal, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  QuizAdminService,
  QuestionBankFilters,
  QuestionSemester,
  StageService,
  ClassGroupService,
  SubjectService,
  GradeService,
  AppUserService,
  HomeworkParticipationService
} from '../../services/admin';
import { QuizAdminItem, QuizAdminPayload, QuestionAdminItem, QuestionAnswerInput, QuestionOption } from '../../interfaces';
import { ServiceError } from '../../services/shared/service-error';
import { HomeworkSemester, TeacherQuiz, QUESTION_TYPE } from '../../models';
import { parseCompleteAuthoredText, isCompleteParseError, renderPreviewText, reconstructAuthoredText } from '../../shared/complete-question';
import { buildRightWrongOptions, rightWrongCorrectOptionId, readRightWrongIsRight } from '../../shared/right-wrong-question';
import {
  DEFAULT_EXPLAIN_WEIGHT_PERCENT, MAX_EXPLAIN_WEIGHT_PERCENT, MIN_EXPLAIN_WEIGHT_PERCENT,
  plainTextFromHtml, validateExplainAuthoring
} from '../../shared/explain-question';
import { RichTextEditorComponent } from '../../shared/rich-text-editor/rich-text-editor.component';
import { HomeworkService } from '../../services/homework.service';
import { TeacherQuizService } from '../../services/teacher-quiz.service';
import { NotificationService } from '../../services/notification.service';
import { Stage, ClassGroup, Subject, Grade, QuizConfig, HomeworkAssignment, AssignmentKind, ParticipationRecord, DEFAULT_QUESTION_DURATION_SECONDS } from '../../models';
import { QuizIllustrationComponent } from './quiz-illustration.component';
import { parseBulkQuestionsJson, BulkUploadQuestionInput, BULK_UPLOAD_SAMPLE } from '../../shared/bulk-question-upload';
import { PagedList } from '../../shared/paged-list';

/**
 * A bank row: the stored question plus the names its Subject / Stage / Grade
 * columns show. Resolved once per page rather than per cell, so the table does
 * not run three lookups per row on every change-detection pass.
 */
interface QuestionRow {
  question: QuestionAdminItem;
  subjectName: string;
  subjectColor?: string;
  stageName: string;
  gradeName: string;
  semesterLabel: string;
}

@Component({
  selector: 'app-quizzes-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, TranslatePipe, QuizIllustrationComponent, RichTextEditorComponent],
  templateUrl: './quizzes-admin.component.html',
})
export class QuizzesAdminComponent {
  private readonly quizAdminService = inject(QuizAdminService);
  private readonly stageService = inject(StageService);
  private readonly classGroupService = inject(ClassGroupService);
  private readonly subjectService = inject(SubjectService);
  private readonly gradeService = inject(GradeService);
  private readonly homeworkService = inject(HomeworkService);
  private readonly teacherQuizService = inject(TeacherQuizService);
  private readonly appUserService = inject(AppUserService);
  private readonly homeworkParticipationService = inject(HomeworkParticipationService);
  private readonly notification = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  // Pagination settings
  readonly pageSize = 10;

  // Loading states
  readonly isLoadingQuizzes = signal<boolean>(false);
  readonly isLoadingQuestions = signal<boolean>(false);
  readonly isLoadingHomework = signal<boolean>(false);
  readonly isLoadingTeacherQuizzes = signal<boolean>(false);

  // Quiz state
  /**
   * Every bank quiz — the source for the homework wizard's quiz `<select>` and
   * for {@link getQuizName}'s id → name lookup.
   *
   * NOT the Quizzes tab's table any more; that is {@link quizList}, which pages.
   * This one is kept whole because a dropdown has to offer every option, and it
   * is loaded lazily (see {@link ensureQuizPickerLoaded}) so merely opening the
   * Quizzes tab no longer reads the collection. Bank quizzes are authored by an
   * application admin and number in the dozens, so holding them while the wizard
   * is open is bounded in a way `users` and `participations` are not.
   */
  readonly allQuizzes = signal<QuizAdminItem[]>([]);

  /** Whether {@link allQuizzes} has been fetched this session. */
  private quizPickerLoaded = false;
  readonly quizSearchQuery = signal<string>('');
  readonly currentQuizPage = signal<number>(1);

  /**
   * The Quizzes tab's table, paged on the server.
   *
   * Separate from {@link allQuizzes} on purpose. That list still exists because
   * the homework wizard's quiz dropdown genuinely needs every option — you
   * cannot pick from page one of a `<select>` — but it is no longer what the
   * table reads. The table is the thing rendered on every visit to this tab; the
   * dropdown is only built when someone opens the wizard.
   */
  readonly quizList = new PagedList<QuizAdminItem>(
    (pageSize, cursor) => this.quizAdminService.listQuizzes(pageSize, cursor),
    () => this.quizAdminService.countQuizzes(),
    20,
    () => this.notification.error('Failed to load quizzes.')
  );

  /**
   * The rows on screen, narrowed by the search box — page-scoped, because
   * Firestore has no substring search.
   */
  readonly visibleQuizRows = computed(() => {
    const query = this.quizSearchQuery().toLowerCase().trim();
    const rows = this.quizList.items();
    if (!query) return rows;
    return rows.filter(quiz =>
      quiz.name.toLowerCase().includes(query) ||
      String(quiz.id).includes(query) ||
      (quiz.description ?? '').toLowerCase().includes(query)
    );
  });



  // Teacher-authored quizzes (`teacherQuizzes` node) — read-only overview so the
  // application admin can see quizzes teachers built themselves, separate from
  // the shared admin bank above.
  readonly teacherQuizCreatorNames = signal<Record<string, string>>({});
  readonly teacherQuizSearchQuery = signal<string>('');

  /**
   * The Teacher-Created Quizzes tab, paged on the server.
   *
   * Safe to page only since the assignments table stopped resolving its QUIZ
   * column out of this list — see {@link assignmentQuizNames}. Until then, paging
   * here would have blanked the name of every quiz not on the visible page.
   */
  readonly teacherQuizList = new PagedList<TeacherQuiz>(
    (pageSize, cursor) => this.teacherQuizService.listAll(pageSize, cursor),
    () => this.teacherQuizService.countAll(),
    20,
    () => this.notification.error('Failed to load teacher-created quizzes.')
  );

  /**
   * The rows on screen, narrowed by the search box — page-scoped, because
   * Firestore has no substring search and the collection is no longer in memory.
   */
  readonly filteredTeacherQuizzes = computed(() => {
    const query = this.teacherQuizSearchQuery().toLowerCase().trim();
    const rows = this.teacherQuizList.items();
    if (!query) return rows;
    return rows.filter(quiz =>
      quiz.name.toLowerCase().includes(query) ||
      quiz.description.toLowerCase().includes(query) ||
      (quiz.subjectId ?? '').toLowerCase().includes(query) ||
      (quiz.semester ?? '').toLowerCase().includes(query) ||
      (this.teacherQuizCreatorNames()[quiz.createdBy] ?? '').toLowerCase().includes(query)
    );
  });


  readonly quizFormId = signal<number | null>(null);
  readonly quizFormName = signal<string>('');
  readonly quizFormDescription = signal<string>('');
  readonly quizFormQuestions = signal<string>('');
  readonly quizFormStageId = signal<string>('');
  readonly quizFormClassId = signal<string>('');
  readonly quizFormSubjectId = signal<string>('');
  readonly quizFormSemester = signal<QuestionSemester | ''>('');
  readonly editingQuiz = signal<boolean>(false);

  // Individual config properties
  readonly configImagePath = signal<string>('');
  readonly configAllowBack = signal<boolean>(true);
  readonly configAllowReview = signal<boolean>(true);
  readonly configAutoMove = signal<boolean>(false);
  /** "One Time Join" — see `QuizConfig.oneTimeJoin`. Off unless deliberately chosen. */
  readonly configOneTimeJoin = signal<boolean>(false);

  /**
   * Teacher who reviews attempts at this quiz (their auth uid).
   *
   * Required on save. A bank quiz reaches students without anyone assigning it,
   * so nothing else can say whose Validation queue a submission belongs in —
   * without a reviewer, every Explain or Complete answer in it would sit pending
   * with no one able to mark it.
   */
  readonly quizFormReviewerId = signal<string>('');

  /** Teacher accounts that can be picked as a reviewer, sorted by name. */
  readonly reviewerOptions = signal<{ id: string; name: string }[]>([]);
  /**
   * Total quiz duration is no longer authored directly — it's the sum of every
   * assigned question's own `duration` (each defaulting to
   * `DEFAULT_QUESTION_DURATION_SECONDS` when unset), since the quiz runner now
   * clocks each question independently rather than the quiz as a whole.
   */
  readonly configDuration = computed<number>(() => {
    const byId = new Map(this.allQuestions().map(q => [q.id, q]));
    return this.assignedQuestionIds().reduce(
      (total, id) => total + (byId.get(id)?.duration ?? DEFAULT_QUESTION_DURATION_SECONDS),
      0
    );
  });
  readonly configPageSize = signal<number>(1);
  readonly configRequiredAll = signal<boolean>(false);
  readonly configRichText = signal<boolean>(false);
  readonly configShowClock = signal<boolean>(false);
  readonly configShowPager = signal<boolean>(true);
  readonly configShuffleOptions = signal<boolean>(false);
  readonly configShuffleQuestions = signal<boolean>(false);

  // Image state. Covers are picked from project assets (src/assets/quiz-images),
  // listed via the generated manifest.json — no upload / external host needed.
  readonly imagePreview = signal<string | null>(null);
  readonly assetImages = signal<string[]>([]);
  readonly showImageGallery = signal<boolean>(false);

  // Stage, Class and Subject data for dropdowns
  readonly stages = signal<Stage[]>([]);
  readonly classes = signal<ClassGroup[]>([]);
  readonly subjects = signal<Subject[]>([]);
  readonly grades = signal<Grade[]>([]);
  readonly filteredClasses = computed(() => {
    const stageId = this.quizFormStageId();
    return this.classes().filter(c => c.stageId === stageId);
  });

  /**
   * The whole bank, held in memory for the quiz builder's Available Questions
   * panel and the homework wizard — both filter it by Stage + Subject + Semester
   * as the admin types, which no single Firestore query can serve.
   *
   * Loaded lazily by {@link ensureAllQuestionsLoaded} when one of those two
   * views opens, never on component init: the bank tab pages from the server and
   * an admin who only edits quizzes never pays for the full read.
   */
  readonly allQuestions = signal<QuestionAdminItem[]>([]);
  private allQuestionsLoaded = false;

  readonly selectedQuestionIds = signal<number[]>([]);

  // ---- Questions bank tab: one server-paged, server-filtered page at a time.
  readonly questionPageSize = 20;
  readonly questionPageItems = signal<QuestionAdminItem[]>([]);
  readonly currentQuestionPage = signal<number>(1);
  readonly totalQuestionsCount = signal<number>(0);

  /** Server-side equality filters. Changing any one resets to page 1. */
  readonly questionFilterSubjectId = signal<string>('');
  readonly questionFilterStageId = signal<string>('');
  readonly questionFilterGradeId = signal<string>('');

  /** Free text, matched against the loaded page only — see `visibleQuestionRows`. */
  readonly questionSearchQuery = signal<string>('');

  /**
   * True while the table is showing a single question found by id rather than a
   * page of the bank. Tracked so the "clear" control stays available: the lookup
   * clears the search box, and without this the admin would be left on a
   * one-row table with nothing to reset.
   */
  readonly isQuestionIdLookup = signal<boolean>(false);

  /**
   * Page cursors, indexed by the page they open. Firestore cursors only walk
   * forward, so every page visited is remembered and paging back replays the
   * stored cursor instead of re-walking from the start. `[0]` is `undefined`:
   * page 1 has no cursor.
   */
  private questionCursors: (string | undefined)[] = [undefined];

  readonly totalQuestionPages = computed(() =>
    Math.max(1, Math.ceil(this.totalQuestionsCount() / this.questionPageSize))
  );

  readonly questionPageNumbers = computed(() =>
    this.buildPageNumbers(this.totalQuestionPages(), this.currentQuestionPage())
  );

  readonly hasQuestionFilters = computed(() =>
    !!this.questionFilterSubjectId() || !!this.questionFilterStageId() || !!this.questionFilterGradeId()
  );

  /** Grades belonging to the selected stage, so the two filters can't contradict. */
  readonly questionFilterGrades = computed(() => {
    const stageId = this.questionFilterStageId();
    return stageId ? this.grades().filter(g => g.stageId === stageId) : this.grades();
  });

  /**
   * The loaded page as table rows, with the classification names resolved and
   * the search box applied.
   *
   * The search is deliberately page-local: Firestore has no substring operator,
   * so searching the whole bank would mean reading the whole bank — the thing
   * this tab stopped doing. The Subject / Stage / Grade filters are the
   * server-side way to narrow, and an all-digits query is treated as an id and
   * fetched directly by {@link jumpToQuestionId}.
   */
  readonly visibleQuestionRows = computed<QuestionRow[]>(() => {
    const rows = this.questionPageItems().map(question => ({
      question,
      subjectName: this.getSubjectName(question.subjectId),
      subjectColor: this.getSubjectColor(question.subjectId),
      stageName: this.getStageName(question.stageId ?? ''),
      gradeName: this.getGradeName(question.gradeId),
      semesterLabel: this.getSemesterLabel(question.semester)
    }));

    const query = this.questionSearchQuery().toLowerCase().trim();
    if (!query) return rows;
    return rows.filter(row =>
      row.question.name.toLowerCase().includes(query) ||
      row.question.id.toString().includes(query) ||
      row.subjectName.toLowerCase().includes(query) ||
      row.stageName.toLowerCase().includes(query) ||
      row.gradeName.toLowerCase().includes(query) ||
      row.semesterLabel.toLowerCase().includes(query)
    );
  });

  /** True when every row on the page is selected — drives the header checkbox. */
  readonly isPageFullySelected = computed(() => {
    const rows = this.visibleQuestionRows();
    if (rows.length === 0) return false;
    const selected = new Set(this.selectedQuestionIds());
    return rows.every(row => selected.has(row.question.id));
  });

  readonly isPagePartiallySelected = computed(() => {
    const selected = new Set(this.selectedQuestionIds());
    const rows = this.visibleQuestionRows();
    return rows.some(row => selected.has(row.question.id)) && !this.isPageFullySelected();
  });

  readonly effectiveAssignedCount = computed(() => {
    // Count only assigned questions that fall within the quiz's current
    // Stage + Subject + Semester scope — i.e. the ones actually shown in the
    // Available Questions list — so the badge can never disagree with the list.
    const assigned = new Set(this.assignedQuestionIds());
    return this.availableQuestions().filter(q => assigned.has(q.id)).length;
  });

  /**
   * The Available Questions panel only makes sense once the quiz has been scoped
   * to a Stage + Subject + Semester. Until all three are chosen the panel stays
   * hidden; clearing any one of them hides it again immediately.
   */
  readonly hasQuestionScope = computed<boolean>(() =>
    !!this.quizFormStageId() && !!this.quizFormSubjectId() && !!this.quizFormSemester()
  );

  /**
   * Bank questions matching the quiz's Stage + Subject + Semester. Recomputes
   * automatically whenever any of the three selections change, and resolves to
   * an empty list while the scope is incomplete.
   */
  readonly availableQuestions = computed<QuestionAdminItem[]>(() => {
    if (!this.hasQuestionScope()) return [];
    const stageId = this.quizFormStageId();
    const subjectId = this.quizFormSubjectId();
    const semester = this.quizFormSemester();
    return this.allQuestions().filter(question =>
      question.stageId === stageId &&
      question.subjectId === subjectId &&
      question.semester === semester
    );
  });

  /** Exposed for the template to branch the authoring form on question type. */
  readonly QUESTION_TYPE = QUESTION_TYPE;
  /** Exposed so the weight input's min/max match the validator's bounds. */
  readonly MIN_EXPLAIN_WEIGHT_PERCENT = MIN_EXPLAIN_WEIGHT_PERCENT;
  readonly MAX_EXPLAIN_WEIGHT_PERCENT = MAX_EXPLAIN_WEIGHT_PERCENT;

  readonly questionFormId = signal<number | null>(null);
  /** A question being written for the first time: it has no id until the server assigns one. */
  readonly questionFormIsNew = signal(false);
  readonly questionFormName = signal<string>('');
  readonly questionFormTypeId = signal<number>(QUESTION_TYPE.CHOOSE);
  readonly questionFormOptions = signal<QuestionOption[]>([]);
  readonly questionFormCorrectOptionId = signal<number | null>(null);
  /** Seconds this question gets on the clock during quiz-taking. */
  readonly questionFormDuration = signal<number>(DEFAULT_QUESTION_DURATION_SECONDS);
  /** Raw authored passage for a Complete question (with `(Complete)` markers). */
  readonly questionFormCompleteText = signal<string>('');
  /** Inline parse/validation error for the Complete authoring textarea. */
  readonly questionFormCompleteError = signal<string>('');
  /**
   * Right-or-Wrong verdict. `null` means the author hasn't chosen yet, which
   * save-time validation rejects — defaulting to one of them would silently
   * record an answer nobody picked.
   */
  readonly questionFormIsRight = signal<boolean | null>(null);
  /** Explain prompt, as rich HTML. */
  readonly questionFormExplainSubject = signal<string>('');
  /** Explain model answer, as rich HTML. Written to `/Answers`, never `/Questions`. */
  readonly questionFormExplainAnswer = signal<string>('');
  /** Explain share of the whole quiz score, 1–100. */
  readonly questionFormExplainWeight = signal<number>(DEFAULT_EXPLAIN_WEIGHT_PERCENT);
  /** Inline validation error for the Right-or-Wrong / Explain authoring fields. */
  readonly questionFormTypeError = signal<string>('');
  readonly questionFormSubjectId = signal<string>('');
  readonly questionFormStageId = signal<string>('');
  readonly questionFormGradeId = signal<string>('');
  readonly questionFormSemester = signal<QuestionSemester | ''>('');
  readonly showQuestionForm = signal<boolean>(false);

  /** Grades belonging to the question form's currently-selected stage. */
  readonly gradesForQuestionFormStage = computed(() => {
    const stageId = this.questionFormStageId();
    if (!stageId) return [];
    return this.grades()
      .filter(g => g.stageId === stageId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  });

  // ---- Bulk edit (Stage / Subject / Semester across the current selection) --
  // Each field is "keep current" ('') unless armed with a concrete value.
  readonly showBulkEditForm = signal<boolean>(false);
  readonly bulkEditStageId = signal<string>('');
  readonly bulkEditSubjectId = signal<string>('');
  readonly bulkEditSemester = signal<QuestionSemester | ''>('');
  readonly isBulkUpdating = signal<boolean>(false);

  /** At least one field must be armed before the edit can be applied. */
  readonly bulkEditHasChanges = computed<boolean>(() =>
    !!this.bulkEditStageId() || !!this.bulkEditSubjectId() || !!this.bulkEditSemester()
  );

  /** Human-readable preview of exactly what "Apply" will change. */
  readonly bulkEditSummary = computed<string>(() => {
    const parts: string[] = [];
    if (this.bulkEditStageId()) parts.push(`Stage → ${this.getStageName(this.bulkEditStageId())}`);
    if (this.bulkEditSubjectId()) parts.push(`Subject → ${this.getSubjectName(this.bulkEditSubjectId())}`);
    if (this.bulkEditSemester()) parts.push(`Semester → ${this.getSemesterLabel(this.bulkEditSemester())}`);
    return parts.join('  ·  ');
  });

  /** `label` holds an i18n key under the shared `semester.*` dictionary — keeps this wording identical to every other semester picker in the app (e.g. the teacher's quiz builder). */
  readonly semesterOptions: { value: QuestionSemester; label: string }[] = [
    { value: 'first',  label: 'semester.first'  },
    { value: 'second', label: 'semester.second' },
    { value: 'full',   label: 'semester.full'   },
  ];

  // ---- Bulk upload (JSON file → many new questions) ---------------------
  readonly showBulkUploadForm = signal<boolean>(false);
  readonly bulkUploadFileName = signal<string>('');
  readonly bulkUploadParsedQuestions = signal<BulkUploadQuestionInput[]>([]);
  readonly bulkUploadErrors = signal<string[]>([]);
  readonly bulkUploadSubjectId = signal<string>('');
  readonly bulkUploadStageId = signal<string>('');
  readonly bulkUploadGradeId = signal<string>('');
  readonly bulkUploadSemester = signal<QuestionSemester | ''>('');
  readonly isBulkUploading = signal<boolean>(false);

  /** Grades belonging to the upload popup's currently-selected stage, in display order. */
  readonly gradesForUploadStage = computed(() => {
    const stageId = this.bulkUploadStageId();
    if (!stageId) return [];
    return this.grades()
      .filter(g => g.stageId === stageId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  });

  readonly bulkUploadCanConfirm = computed<boolean>(() =>
    this.bulkUploadParsedQuestions().length > 0 &&
    this.bulkUploadErrors().length === 0 &&
    !!this.bulkUploadSubjectId() &&
    !!this.bulkUploadStageId() &&
    !!this.bulkUploadGradeId() &&
    !!this.bulkUploadSemester()
  );

  // Split-screen quiz creation mode
  readonly showSplitScreen = signal<boolean>(false);
  readonly assignedQuestionIds = signal<number[]>([]);

  // Homework state with pagination and search
  readonly homeworkSearchQuery = signal<string>('');
  readonly currentHomeworkPage = signal<number>(1);

  /**
   * Which kind of assignment the list is showing.
   *
   * `homeworkAssignments` holds both: a `kind` of `'quiz'` surfaces on the
   * student's Quizzes tab, anything else on their Homework tab. The admin list
   * ignored the field entirely, so a tab labelled "Homework Assignments" listed
   * every quiz assignment too. One list with a filter rather than two tables —
   * they are the same record, written by the same wizard.
   */
  readonly homeworkKindFilter = signal<'all' | 'quiz' | 'homework'>('all');

  /** Legacy records carry no `kind`; the model treats those as homework. */
  private assignmentKindOf(assignment: HomeworkAssignment): AssignmentKind {
    return assignment.kind ?? 'homework';
  }

  /**
   * Counts for the All / Quiz / Homework toggle.
   *
   * Server aggregation counts, refreshed alongside the list, rather than
   * `array.filter().length` over a collection the browser no longer holds.
   */
  readonly homeworkTotalCount = signal<number>(0);
  readonly homeworkQuizCount = signal<number>(0);
  readonly homeworkOnlyCount = signal<number>(0);

  /** Refresh the three toggle counts. Three aggregation queries, no document reads. */
  private async refreshHomeworkCounts(): Promise<void> {
    try {
      const [all, quiz, homework] = await Promise.all([
        this.homeworkService.countAll(),
        this.homeworkService.countByKind('quiz'),
        this.homeworkService.countByKind('homework')
      ]);
      this.homeworkTotalCount.set(all);
      this.homeworkQuizCount.set(quiz);
      this.homeworkOnlyCount.set(homework);
    } catch {
      // Badges fall back to zero; the list itself still renders.
      this.homeworkTotalCount.set(0);
      this.homeworkQuizCount.set(0);
      this.homeworkOnlyCount.set(0);
    }
  }

  /**
   * The All Assignments table, paged on the server.
   *
   * Replaces a drain of every assignment followed by an in-memory slice. The
   * kind filter is part of the query rather than a client-side `.filter`, so
   * switching it re-queries instead of re-slicing something already downloaded.
   */
  readonly homeworkList = new PagedList<HomeworkAssignment>(
    async (pageSize, cursor) => {
      const kind = this.homeworkKindFilter();
      const page = kind === 'all'
        ? await this.homeworkService.listAll(pageSize, cursor)
        : await this.homeworkService.listByKind(kind, pageSize, cursor);
      // Resolve the quiz names this page needs, here rather than from a full
      // teacherQuizzes list — so the QUIZ column is right without the screen
      // holding every quiz in the school.
      await this.cacheQuizNamesFor(page.items);
      return page;
    },
    () => {
      const kind = this.homeworkKindFilter();
      return kind === 'all'
        ? this.homeworkService.countAll()
        : this.homeworkService.countByKind(kind);
    },
    20,
    () => this.notification.error('Failed to load assignments.')
  );

  /**
   * The rows on screen, narrowed by the search box.
   *
   * Page-scoped, and it has to be: Firestore has no substring search, so with
   * the collection no longer in memory there is nothing to search but the page
   * in front of you. The same trade the Questions Bank tab made — hence its
   * `noMatchesOnPage` wording, which this reuses.
   */
  readonly visibleHomeworkRows = computed(() => {
    const query = this.homeworkSearchQuery().toLowerCase().trim();
    const rows = this.homeworkList.items();
    if (!query) return rows;
    return rows.filter(hw =>
      hw.title.toLowerCase().includes(query) ||
      // Search the name the row actually shows, not the sentinel behind it.
      this.assignmentQuizName(hw).toLowerCase().includes(query) ||
      hw.stageId.toLowerCase().includes(query) ||
      hw.classId.toLowerCase().includes(query) ||
      (hw.semester ?? '').toLowerCase().includes(query)
    );
  });

  setHomeworkKindFilter(kind: 'all' | 'quiz' | 'homework'): void {
    this.homeworkKindFilter.set(kind);
    // A cursor is a position in one ordered result set, so a changed filter
    // invalidates every cached one — `reload` is what drops them.
    void this.homeworkList.reload();
    // The panel describes one row of the table above it. Narrowing the filter
    // can remove that row, leaving a detail panel for something no longer on
    // screen — and its Load-more button still paging a hidden assignment.
    this.closeHomeworkCompletion();
  }

  readonly homeworkTitle = signal<string>('');
  readonly homeworkQuizId = signal<number | null>(null);
  readonly homeworkStageId = signal<string>('');
  readonly homeworkClassId = signal<string>('');
  readonly homeworkDueAt = signal<string>('');
  readonly homeworkFormSemester = signal<HomeworkSemester | ''>('');
  readonly editingHomeworkId = signal<string | null>(null);
  readonly editingHomeworkSnapshot = signal<HomeworkAssignment | null>(null);
  readonly selectedHomeworkId = signal<string | null>(null);
  readonly selectedHomeworkTitle = signal<string | null>(null);
  /**
   * Kind of the assignment whose completion panel is open.
   *
   * The heading used to say "Homework Completion — …" for everything, including
   * the quiz assignments that make up most of this list. Held as its own signal
   * rather than re-derived from `selectedHomeworkId`: the row may be filtered
   * out of the table while the panel is still open, and the panel should keep
   * describing what it is showing.
   */
  readonly selectedHomeworkKind = signal<AssignmentKind>('homework');

  /** Translation key for the completion panel heading, per the open row's kind. */
  readonly completionTitleKey = computed(() =>
    this.selectedHomeworkKind() === 'quiz'
      ? 'homeworkCompletion.titleQuiz'
      : 'homeworkCompletion.titleHomework'
  );
  readonly homeworkParticipations = signal<ParticipationRecord[]>([]);
  readonly homeworkParticipationCursor = signal<string | undefined>(undefined);
  readonly homeworkChildNames = signal<Record<string, string>>({});

  // Filtered classes for homework
  readonly filteredHomeworkClasses = computed(() => {
    const stageId = this.homeworkStageId();
    return this.classes().filter(c => c.stageId === stageId);
  });

  // ---- Homework creation wizard ------------------------------------------
  // The homework form is a 4-step wizard:
  //   1 Details → 2 Sources → 3 Select questions → 4 Review & confirm
  readonly homeworkWizardSteps: { n: number; label: string }[] = [
    { n: 1, label: 'Details' },
    { n: 2, label: 'Sources' },
    { n: 3, label: 'Questions' },
    { n: 4, label: 'Review' }
  ];
  readonly homeworkWizardStep = signal<number>(1);

  // Question sources to compose from (at least one required to proceed)
  readonly homeworkSourceQuiz = signal<boolean>(true);   // the base quiz's questions
  readonly homeworkSourceBank = signal<boolean>(false);  // hand-picked from the bank

  // Composed selection (single source of truth, deduped) + base quiz question ids
  readonly homeworkSelectedQuestionIds = signal<number[]>([]);
  readonly homeworkBaseQuizQuestionIds = signal<number[]>([]);

  // Bank browser filters (step 3)
  readonly homeworkBankSemesterFilter = signal<QuestionSemester | ''>('');
  readonly homeworkBankSubjectFilter = signal<string>('');
  readonly homeworkBankStageFilter = signal<string>('');
  readonly homeworkBankSearch = signal<string>('');

  readonly homeworkSelectedCount = computed(() => this.homeworkSelectedQuestionIds().length);

  /** Questions belonging to the selected base quiz, resolved against the bank. */
  readonly quizSourceQuestions = computed<QuestionAdminItem[]>(() => {
    const byId = new Map(this.allQuestions().map(q => [q.id, q]));
    return this.homeworkBaseQuizQuestionIds()
      .map(id => byId.get(id))
      .filter((q): q is QuestionAdminItem => !!q);
  });

  /** Bank questions filtered by the wizard's subject + stage + semester + search controls. */
  readonly bankFilteredQuestions = computed<QuestionAdminItem[]>(() => {
    const sem = this.homeworkBankSemesterFilter();
    const subjectId = this.homeworkBankSubjectFilter();
    const stageId = this.homeworkBankStageFilter();
    const term = this.homeworkBankSearch().toLowerCase().trim();
    // When the "From quiz" section is shown, hide its questions here so the bank
    // list only offers questions not already listed above (no duplicates).
    const fromQuiz = this.homeworkSourceQuiz()
      ? new Set(this.homeworkBaseQuizQuestionIds())
      : new Set<number>();
    return this.allQuestions().filter(q => {
      if (fromQuiz.has(q.id)) return false;
      const matchesSubject = !subjectId || q.subjectId === subjectId;
      const matchesStage = !stageId || q.stageId === stageId;
      const matchesSemester = !sem || q.semester === sem;
      const matchesText = !term || q.name.toLowerCase().includes(term) || q.id.toString().includes(term);
      return matchesSubject && matchesStage && matchesSemester && matchesText;
    });
  });

  /** The composed selection expanded to full question objects (for review). */
  readonly selectedQuestionsDetailed = computed<QuestionAdminItem[]>(() => {
    const selected = new Set(this.homeworkSelectedQuestionIds());
    return this.allQuestions().filter(q => selected.has(q.id));
  });

  /** Whether every base-quiz question is currently selected. */
  readonly quizSourceAllSelected = computed<boolean>(() => {
    const ids = this.quizSourceQuestions().map(q => q.id);
    if (ids.length === 0) return false;
    const selected = new Set(this.homeworkSelectedQuestionIds());
    return ids.every(id => selected.has(id));
  });

  // Active tab
  /**
   * `allAssignments` is the register of everything assigned; `homework` is now
   * only the wizard that creates one. They were a single screen, which is how a
   * tab headed "Homework Assignments" came to list quiz assignments below it.
   */
  readonly activeTab = signal<'quizzes' | 'questions' | 'homework' | 'teacherQuizzes' | 'allAssignments'>('quizzes');

  /**
   * Switch tabs, closing anything that only makes sense on the tab being left.
   *
   * The completion panel is the case that matters: it renders inside the All
   * Assignments tab but its state lived on the component, so leaving and
   * returning brought back a panel for whichever row was last inspected — with
   * records already loaded — as though it had just been opened.
   */
  setActiveTab(tab: 'quizzes' | 'questions' | 'homework' | 'teacherQuizzes' | 'allAssignments'): void {
    if (this.activeTab() === tab) return;
    this.activeTab.set(tab);
    this.closeHomeworkCompletion();
    // The wizard's quiz dropdown needs every bank quiz; nothing else does.
    if (tab === 'homework') void this.ensureQuizPickerLoaded();
  }

  constructor() {
    this.loadAllQuizzes();
    this.loadAllTeacherQuizzes();
    this.loadStagesAndClasses();
    this.loadSubjects();
    this.loadGrades();
    this.loadReviewerOptions();
    this.reloadQuestionsBank();
    this.initNewQuiz();
    this.loadAllHomework();
    this.loadAssetImages();

    // The sidebar "Create New Quiz" CTA links here with ?action=create so the
    // split-screen builder opens immediately instead of landing on the list.
    // Consumed via an observable (not just the initial snapshot) so clicking
    // the CTA again while already on this page — a query-param-only
    // navigation — still re-opens the builder; the param is then cleared so a
    // later click always produces a fresh navigation.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      if (params.get('action') === 'create') {
        this.activeTab.set('quizzes');
        void this.startCreateQuiz();
        this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
      }
    });
  }

  // Helper method for page numbers
  private buildPageNumbers(total: number, current: number): (number | string)[] {
    const pages: (number | string)[] = [];
    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push('...');
      for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
        pages.push(i);
      }
      if (current < total - 2) pages.push('...');
      pages.push(total);
    }
    return pages;
  }

  // Pagination methods for Quizzes
  onQuizSearchChange(query: string): void {
    this.quizSearchQuery.set(query);
    this.currentQuizPage.set(1);
  }




  onTeacherQuizSearchChange(query: string): void {
    this.teacherQuizSearchQuery.set(query);
  }

  /**
   * Search for Questions — filters the loaded page only, so no refetch. Use the
   * Subject / Stage / Grade filters to narrow the bank itself.
   */
  onQuestionSearchChange(query: string): void {
    this.questionSearchQuery.set(query);
  }

  /**
   * The search box narrows the page on screen (see {@link visibleHomeworkRows}),
   * so it changes nothing on the server and must not disturb the pager.
   */
  onHomeworkSearchChange(query: string): void {
    this.homeworkSearchQuery.set(query);
  }

  /**
   * Refresh the Quizzes tab's table.
   *
   * Was a drain of every bank quiz on component init. The table now pages, and
   * the full list is fetched only when something actually needs all of it.
   */
  async loadAllQuizzes(): Promise<void> {
    await this.quizList.reload();
    // Keep the picker in step when it has already been built — a quiz just
    // created or deleted should appear in, or disappear from, the dropdown.
    if (this.quizPickerLoaded) await this.loadQuizPicker();
  }

  /**
   * Fetch every bank quiz for the wizard's dropdown and the name lookup, once.
   *
   * Called when the homework tab is opened rather than on init, so the cost is
   * paid by the one screen that needs it instead of by every visit here.
   */
  async ensureQuizPickerLoaded(): Promise<void> {
    if (this.quizPickerLoaded) return;
    await this.loadQuizPicker();
  }

  private async loadQuizPicker(): Promise<void> {
    try {
      let cursor: string | undefined;
      const items: QuizAdminItem[] = [];
      do {
        const result = await this.quizAdminService.listQuizzes(100, cursor);
        items.push(...result.items);
        cursor = result.nextCursor;
      } while (cursor);
      this.allQuizzes.set(items);
      this.quizPickerLoaded = true;
    } catch {
      this.notification.error('Failed to load the quiz list.');
    }
  }

  /**
   * Load the first page of teacher-created quizzes.
   *
   * Was a drain of every one of them into `teacherQuizzes`; nothing holds the
   * whole collection now.
   */
  async loadAllTeacherQuizzes(): Promise<void> {
    await this.teacherQuizList.reload();
  }

  getTeacherQuizCreatorName(createdBy: string): string {
    return this.teacherQuizCreatorNames()[createdBy] ?? createdBy;
  }

  async removeTeacherQuiz(quiz: TeacherQuiz): Promise<void> {
    if (!confirm(`Are you sure you want to delete "${quiz.name}"? This quiz was authored by ${this.getTeacherQuizCreatorName(quiz.createdBy)}.`)) return;
    try {
      await this.teacherQuizService.remove(quiz.id);
      this.notification.success('Quiz deleted.');
      await this.loadAllTeacherQuizzes();
    } catch (error) {
      this.notification.error('Failed to delete the quiz. Please try again.');
      console.error(error);
    }
  }

  async loadStagesAndClasses(): Promise<void> {
    const stagesResult = await this.stageService.listStages(100);
    this.stages.set(stagesResult.items);
    const classesResult = await this.classGroupService.listClasses(100);
    this.classes.set(classesResult.items);
  }

  async loadSubjects(): Promise<void> {
    const result = await this.subjectService.listSubjects(100);
    this.subjects.set(result.items);
  }

  async loadGrades(): Promise<void> {
    const result = await this.gradeService.listGrades(100);
    this.grades.set(result.items);
  }

  /**
   * Teacher accounts eligible to review this quiz.
   *
   * Sorted by display name because the underlying query returns them in
   * document-id (auth uid) order, which is meaningless to a human picking from
   * a dropdown.
   */
  /**
   * Translation key naming the question type currently selected in the form.
   *
   * Heads the type-specific section so that changing the selector reads as the
   * content being replaced rather than the dialog rearranging itself. Reuses the
   * selector's own option labels, so the heading and the dropdown can never
   * disagree.
   */
  readonly questionFormTypeLabel = computed(() => {
    switch (this.questionFormTypeId()) {
      case QUESTION_TYPE.COMPLETE: return 'questionsBank.form.typeComplete';
      case QUESTION_TYPE.RIGHT_WRONG: return 'questionsBank.form.typeRightWrong';
      case QUESTION_TYPE.EXPLAIN: return 'questionsBank.form.typeExplain';
      default: return 'questionsBank.form.typeChoose';
    }
  });

  async loadReviewerOptions(): Promise<void> {
    try {
      const result = await this.appUserService.listTeacherAccounts(100);
      this.reviewerOptions.set(
        result.items
          .filter(u => u.active !== false)
          // the reviewer is a person, so their API id (not the Firebase uid) is what a quiz stores
          .map(u => ({ id: u.id ?? '', name: u.displayName || u.email || u.uid }))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      // Teacher quizzes name their author by API id; every teacher (active or not) resolves it to a name.
      this.teacherQuizCreatorNames.set(Object.fromEntries(
        result.items.filter(u => u.id).map(u => [u.id!, u.displayName || u.email || u.uid])
      ));
    } catch {
      // The dropdown is empty rather than the page broken. Save is blocked
      // until a reviewer is chosen, so this surfaces as "no teachers to pick",
      // which is also the honest state when a school has none yet.
      this.reviewerOptions.set([]);
    }
  }

  getSubjectName(subjectId: string | undefined): string {
    if (!subjectId) return '';
    return this.subjects().find(s => s.id === subjectId)?.name ?? subjectId;
  }

  getSubjectColor(subjectId: string | undefined): string | undefined {
    if (!subjectId) return undefined;
    return this.subjects().find(s => s.id === subjectId)?.color;
  }

  /**
   * Load the full bank for the quiz builder / homework wizard, once.
   *
   * Both panels filter the bank as the admin picks a Stage + Subject + Semester,
   * which is a client-side filter over data they need in full. Kept out of the
   * constructor so landing on this page — or paging the bank tab — never pulls
   * the whole collection.
   */
  private async ensureAllQuestionsLoaded(): Promise<void> {
    if (this.allQuestionsLoaded) return;
    this.allQuestionsLoaded = true;
    try {
      this.allQuestions.set(await this.quizAdminService.listQuestions());
    } catch (error) {
      // Let the next open retry rather than leaving the panel permanently empty.
      this.allQuestionsLoaded = false;
      throw error;
    }
  }

  /** Drop the cached bank so the next builder/wizard open re-reads it. */
  private invalidateAllQuestions(): void {
    this.allQuestionsLoaded = false;
    this.allQuestions.set([]);
  }

  /** Current server-side filter set for the bank tab. */
  private questionFilters(): QuestionBankFilters {
    return {
      subjectId: this.questionFilterSubjectId() || undefined,
      stageId: this.questionFilterStageId() || undefined,
      gradeId: this.questionFilterGradeId() || undefined
    };
  }

  /**
   * Fetch one page of the bank.
   *
   * Pages are walked with stored cursors, so a jump to a page that has never
   * been visited (clicking "12" from page 1) walks forward through the pages
   * between — one query each. That is the cost of Firestore cursors having no
   * offset; the numbered pager stays consistent with the other tabs in exchange.
   */
  async loadQuestionsPage(page = 1): Promise<void> {
    this.isLoadingQuestions.set(true);
    try {
      const filters = this.questionFilters();

      // Walk forward until the requested page's cursor is known.
      while (this.questionCursors.length <= page - 1) {
        const known = this.questionCursors.length;
        const step = await this.quizAdminService.listQuestionsPage(
          this.questionPageSize, this.questionCursors[known - 1], filters
        );
        if (!step.nextCursor) break;
        this.questionCursors[known] = step.nextCursor;
      }

      const target = Math.min(page, this.questionCursors.length);
      const result = await this.quizAdminService.listQuestionsPage(
        this.questionPageSize, this.questionCursors[target - 1], filters
      );
      this.questionCursors[target] = result.nextCursor;
      this.questionPageItems.set(result.items);
      this.currentQuestionPage.set(target);
    } finally {
      this.isLoadingQuestions.set(false);
    }
  }

  /** Re-read the total and reset to page 1 — after a filter change or a write. */
  async reloadQuestionsBank(): Promise<void> {
    this.isQuestionIdLookup.set(false);
    this.questionCursors = [undefined];
    this.totalQuestionsCount.set(await this.quizAdminService.countQuestions(this.questionFilters()));
    await this.loadQuestionsPage(1);
  }

  onQuestionFilterChange(field: 'subject' | 'stage' | 'grade', value: string): void {
    if (field === 'subject') this.questionFilterSubjectId.set(value);
    if (field === 'stage') {
      this.questionFilterStageId.set(value);
      // A grade belongs to exactly one stage, so a stale grade would filter to
      // nothing at all.
      const stillValid = this.grades().some(
        g => g.id === this.questionFilterGradeId() && (!value || g.stageId === value)
      );
      if (!stillValid) this.questionFilterGradeId.set('');
    }
    if (field === 'grade') this.questionFilterGradeId.set(value);
    void this.reloadQuestionsBank();
  }

  clearQuestionFilters(): void {
    this.questionFilterSubjectId.set('');
    this.questionFilterStageId.set('');
    this.questionFilterGradeId.set('');
    this.questionSearchQuery.set('');
    void this.reloadQuestionsBank();
  }

  /** Any state that makes the table show less than the unfiltered first page. */
  readonly isQuestionViewNarrowed = computed(() =>
    this.hasQuestionFilters() || !!this.questionSearchQuery() || this.isQuestionIdLookup()
  );

  goToQuestionPage(page: number | string): void {
    if (typeof page === 'number' && page >= 1 && page <= this.totalQuestionPages()) {
      void this.loadQuestionsPage(page);
    }
  }

  previousQuestionPage(): void {
    if (this.currentQuestionPage() > 1) void this.loadQuestionsPage(this.currentQuestionPage() - 1);
  }

  nextQuestionPage(): void {
    if (this.currentQuestionPage() < this.totalQuestionPages()) {
      void this.loadQuestionsPage(this.currentQuestionPage() + 1);
    }
  }

  /**
   * Look up an exact question id and show it as a single-row page.
   *
   * The one search that survives paging: ids are document ids, so this is one
   * read regardless of bank size. Offered whenever the search box holds digits.
   */
  async jumpToQuestionId(): Promise<void> {
    const id = Number(this.questionSearchQuery().trim());
    if (!Number.isInteger(id) || id <= 0) return;
    this.isLoadingQuestions.set(true);
    try {
      const question = await this.quizAdminService.getQuestion(id);
      if (!question) {
        this.notification.warning(
          this.translate.instant('questionsBank.table.idNotFound', { id })
        );
        return;
      }
      this.questionSearchQuery.set('');
      this.questionPageItems.set([question]);
      this.totalQuestionsCount.set(1);
      this.currentQuestionPage.set(1);
      this.questionCursors = [undefined];
      this.isQuestionIdLookup.set(true);
    } finally {
      this.isLoadingQuestions.set(false);
    }
  }

  /** True while the search box holds something that could be a question id. */
  readonly searchLooksLikeId = computed(() => /^\d+$/.test(this.questionSearchQuery().trim()));

  /**
   * Refresh everything a question write can affect: the visible page, its total,
   * and the cached full bank the builder and wizard read from.
   */
  private async refreshQuestions(): Promise<void> {
    this.invalidateAllQuestions();
    await this.reloadQuestionsBank();
  }

  async initNewQuiz(): Promise<void> {
    // No id until it is saved: the server assigns it.
    this.quizFormId.set(null);
    this.editingQuiz.set(false);
  }

  async setQuizForm(quiz: QuizAdminItem): Promise<void> {
    // Needed before the assigned-questions panel can resolve saved ids to names.
    await this.ensureAllQuestionsLoaded();
    // Fetch full quiz data including config
    const fullQuiz = await this.quizAdminService.getQuizWithConfig(quiz.id);
    if (!fullQuiz) return;

    this.quizFormId.set(quiz.id);
    this.quizFormName.set(quiz.name);
    this.quizFormDescription.set(quiz.description);
    this.quizFormStageId.set(quiz.stageId || '');
    this.quizFormClassId.set(quiz.classId || '');
    this.quizFormSubjectId.set(quiz.subjectId || '');
    this.quizFormReviewerId.set(quiz.reviewerId || '');
    this.quizFormSemester.set(quiz.semester ?? '');

    // Hydrate the assigned-questions panel from the saved quiz. This is the
    // single source of truth — `quizFormQuestions` is only the joined display
    // string and stays in sync via `updateQuizFormQuestions`.
    const savedQuestionIds = (fullQuiz.Question ?? []).filter(id => Number.isFinite(id));
    this.assignedQuestionIds.set(savedQuestionIds);
    this.updateQuizFormQuestions();

    this.editingQuiz.set(true);
    this.showSplitScreen.set(true);

    // Set config values from the quiz
    const config = fullQuiz.config as Partial<QuizConfig> || {};
    this.configImagePath.set(config.ImagePath || '');
    this.configAllowBack.set(config.allowBack ?? true);
    this.configAllowReview.set(config.allowReview ?? true);
    this.configAutoMove.set(config.autoMove ?? false);
    this.configOneTimeJoin.set(config.oneTimeJoin ?? false);
    this.configPageSize.set(config.pageSize ?? 1);
    this.configRequiredAll.set(config.requiredAll ?? false);
    this.configRichText.set(config.richText ?? false);
    this.configShowClock.set(config.showClock ?? false);
    this.configShowPager.set(config.showPager ?? true);
    this.configShuffleOptions.set(config.shuffleOptions ?? false);
    this.configShuffleQuestions.set(config.shuffleQuestions ?? false);

    // Set image preview if there's an existing image
    this.imagePreview.set(config.ImagePath || null);
    this.showImageGallery.set(false);
  }

  async clearQuizForm(): Promise<void> {
    this.quizFormName.set('');
    this.quizFormDescription.set('');
    this.quizFormQuestions.set('');
    this.quizFormStageId.set('');
    this.quizFormClassId.set('');
    this.quizFormSubjectId.set('');
    this.quizFormReviewerId.set('');
    this.quizFormSemester.set('');
    this.editingQuiz.set(false);

    // Reset split-screen state
    this.showSplitScreen.set(false);
    this.assignedQuestionIds.set([]);

    // Reset config to defaults
    this.configImagePath.set('');
    this.configAllowBack.set(true);
    this.configAllowReview.set(true);
    this.configAutoMove.set(false);
    this.configOneTimeJoin.set(false);
    this.configPageSize.set(1);
    this.configRequiredAll.set(false);
    this.configRichText.set(false);
    this.configShowClock.set(false);
    this.configShowPager.set(true);
    this.configShuffleOptions.set(false);
    this.configShuffleQuestions.set(false);

    // Reset image state
    this.imagePreview.set(null);
    this.showImageGallery.set(false);

    // Get next available ID
    await this.initNewQuiz();
  }

  // Image (cover) methods — pick from project assets, no upload.
  async loadAssetImages(): Promise<void> {
    try {
      const res = await fetch('assets/quiz-images/manifest.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error(`manifest ${res.status}`);
      const images = await res.json();
      this.assetImages.set(Array.isArray(images) ? images : []);
    } catch (error) {
      // Folder may be empty or manifest not yet generated — show the empty state.
      console.warn('Could not load quiz-image manifest:', error);
      this.assetImages.set([]);
    }
  }

  toggleImageGallery(): void {
    this.showImageGallery.update(open => !open);
  }

  selectAssetImage(path: string): void {
    this.configImagePath.set(path);
    this.imagePreview.set(path);
    this.showImageGallery.set(false);
  }

  isImageSelected(path: string): boolean {
    return this.configImagePath() === path;
  }

  onImageUrlChange(url: string): void {
    this.configImagePath.set(url);
    this.imagePreview.set(url || null);
  }

  removeImage(): void {
    this.imagePreview.set(null);
    this.configImagePath.set('');
  }

  private buildConfig(): QuizConfig {
    const imagePath = this.configImagePath();
    return {
      ...(imagePath ? { ImagePath: imagePath } : {}),
      allowBack: this.configAllowBack(),
      allowReview: this.configAllowReview(),
      autoMove: this.configAutoMove(),
      oneTimeJoin: this.configOneTimeJoin(),
      duration: this.configDuration(),
      pageSize: this.configPageSize(),
      requiredAll: this.configRequiredAll(),
      richText: this.configRichText(),
      showClock: this.configShowClock(),
      showPager: this.configShowPager(),
      shuffleOptions: this.configShuffleOptions(),
      shuffleQuestions: this.configShuffleQuestions()
    } as QuizConfig;
  }

  /** Everything that must be filled in before a quiz can be saved. */
  readonly canSaveQuiz = computed(() =>
    (!this.editingQuiz() || !!Number(this.quizFormId())) && !!this.quizFormName().trim() && !!this.quizFormReviewerId()
  );

  async saveQuiz(): Promise<void> {
    if (!this.canSaveQuiz()) return;
    const id = Number(this.quizFormId()) || 0;              // 0 for a new quiz: the server assigns its id

    // Build config from individual signals
    const config = this.buildConfig();

    // Use assignedQuestionIds as the source of truth; the comma-joined
    // quizFormQuestions string is only a display mirror.
    const questions = [...this.assignedQuestionIds()];

    const semester = this.quizFormSemester();
    const reviewerId = this.quizFormReviewerId();
    const subjectId = this.quizFormSubjectId();
    const stageId = this.quizFormStageId();
    const classId = this.quizFormClassId();
    const payload: QuizAdminPayload = {
      id,
      name: this.quizFormName().trim(),
      description: this.quizFormDescription().trim(),
      config: config as unknown as Record<string, unknown>,
      Question: questions,
      ...(stageId ? { stageId } : {}),
      ...(classId ? { classId } : {}),
      ...(subjectId ? { subjectId } : {}),
      ...(semester ? { semester: semester as QuestionSemester } : {}),
      // Guarded by `canSaveQuiz`, so this is always set on a new save. Older
      // quizzes saved before the field existed keep whatever they had until an
      // admin edits them, at which point the form makes them choose.
      reviewerId,
      reviewerName: this.reviewerOptions().find(r => r.id === reviewerId)?.name ?? ''
    };

    if (this.editingQuiz()) await this.quizAdminService.updateQuiz(payload);
    else await this.quizAdminService.createQuiz(payload);
    await this.clearQuizForm();
    await this.loadAllQuizzes();
  }

  async removeQuiz(id: number): Promise<void> {
    if (!confirm('Are you sure you want to delete this quiz?')) return;
    await this.quizAdminService.deleteQuiz(id);
    await this.loadAllQuizzes();
  }

  // Question Management
  async newQuestion(): Promise<void> {
    // No id until it is saved: the server assigns it.
    this.questionFormId.set(null);
    this.questionFormIsNew.set(true);
    this.questionFormName.set('');
    this.questionFormTypeId.set(QUESTION_TYPE.CHOOSE);
    this.questionFormOptions.set([
      { id: 1, name: '' },
      { id: 2, name: '' },
      { id: 3, name: '' },
      { id: 4, name: '' }
    ]);
    this.questionFormCorrectOptionId.set(null);
    this.questionFormDuration.set(DEFAULT_QUESTION_DURATION_SECONDS);
    this.questionFormCompleteText.set('');
    this.questionFormCompleteError.set('');
    this.resetTypeSpecificFields();
    this.questionFormSubjectId.set('');
    this.questionFormStageId.set('');
    this.questionFormGradeId.set('');
    this.questionFormSemester.set('');
    this.showQuestionForm.set(true);
  }

  /** Clear the Right-or-Wrong / Explain fields so a type switch can't carry stale input into a save. */
  private resetTypeSpecificFields(): void {
    this.questionFormIsRight.set(null);
    this.questionFormExplainSubject.set('');
    this.questionFormExplainAnswer.set('');
    this.questionFormExplainWeight.set(DEFAULT_EXPLAIN_WEIGHT_PERCENT);
    this.questionFormTypeError.set('');
  }

  /** Switch the authoring form's question type, resetting the type-specific fields. */
  setQuestionFormType(typeId: number): void {
    this.questionFormTypeId.set(typeId);
    this.questionFormCompleteError.set('');
    this.resetTypeSpecificFields();
  }

  isCompleteQuestion(question: QuestionAdminItem): boolean {
    return question.questionTypeId === QUESTION_TYPE.COMPLETE;
  }

  isRightWrongQuestion(question: QuestionAdminItem): boolean {
    return question.questionTypeId === QUESTION_TYPE.RIGHT_WRONG;
  }

  isExplainQuestion(question: QuestionAdminItem): boolean {
    return question.questionTypeId === QUESTION_TYPE.EXPLAIN;
  }

  /** Number of blanks in a Complete question (derived from its segments). */
  blankCount(question: QuestionAdminItem): number {
    return question.segments?.filter(s => s.kind === 'blank').length ?? 0;
  }

  /** Option count, guarded — a Complete question may legitimately have no options. */
  optionCount(question: QuestionAdminItem): number {
    return question.options?.length ?? 0;
  }

  /**
   * i18n key + params for the one-line "shape" badge next to a question in the
   * bank's lists ("4 options", "2 blanks", …). Resolved here rather than as a
   * chain of `@if`s so the two lists that render it stay in step.
   */
  questionSummary(question: QuestionAdminItem): { key: string; params: Record<string, number> } {
    switch (question.questionTypeId) {
      case QUESTION_TYPE.COMPLETE:
        return { key: 'questionsBank.blanks', params: { count: this.blankCount(question) } };
      case QUESTION_TYPE.RIGHT_WRONG:
        return { key: 'questionsBank.rightWrongBadge', params: {} };
      case QUESTION_TYPE.EXPLAIN:
        return {
          key: 'questionsBank.explainBadge',
          params: { percent: question.weightPercent ?? DEFAULT_EXPLAIN_WEIGHT_PERCENT }
        };
      default:
        return { key: 'questionsBank.options', params: { count: this.optionCount(question) } };
    }
  }

  async editQuestion(question: QuestionAdminItem): Promise<void> {
    this.questionFormId.set(question.id);
    this.questionFormIsNew.set(false);
    this.questionFormName.set(question.name);
    this.questionFormTypeId.set(question.questionTypeId);
    this.questionFormOptions.set([...(question.options ?? [])]);
    this.questionFormDuration.set(question.duration ?? DEFAULT_QUESTION_DURATION_SECONDS);
    this.questionFormSubjectId.set(question.subjectId ?? '');
    this.questionFormStageId.set(question.stageId ?? '');
    this.questionFormGradeId.set(question.gradeId ?? '');
    this.questionFormSemester.set(question.semester ?? '');
    this.questionFormCompleteText.set('');
    this.questionFormCompleteError.set('');
    this.resetTypeSpecificFields();
    const answer = await this.quizAdminService.getAnswer(question.id);
    this.questionFormCorrectOptionId.set(answer?.correctOptionId || null);
    // Reconstruct the authorable passage from the masked segments + fetched keywords.
    if (question.questionTypeId === QUESTION_TYPE.COMPLETE && question.segments) {
      this.questionFormCompleteText.set(reconstructAuthoredText(question.segments, answer?.correctBlanks ?? []));
    }
    if (question.questionTypeId === QUESTION_TYPE.RIGHT_WRONG) {
      this.questionFormIsRight.set(readRightWrongIsRight(answer?.correctOptionId));
    }
    if (question.questionTypeId === QUESTION_TYPE.EXPLAIN) {
      this.questionFormExplainSubject.set(question.subjectHtml ?? question.name);
      this.questionFormExplainAnswer.set(answer?.referenceAnswer ?? '');
      this.questionFormExplainWeight.set(question.weightPercent ?? DEFAULT_EXPLAIN_WEIGHT_PERCENT);
    }
    this.showQuestionForm.set(true);
  }

  /** Stage select in the question form; clears Grade if it no longer belongs to the new stage. */
  onQuestionFormStageChange(stageId: string): void {
    this.questionFormStageId.set(stageId);
    const grade = this.grades().find(g => g.id === this.questionFormGradeId());
    if (!grade || grade.stageId !== stageId) {
      this.questionFormGradeId.set('');
    }
  }

  cancelQuestionForm(): void {
    this.showQuestionForm.set(false);
    this.questionFormId.set(null);
    this.questionFormIsNew.set(false);
    this.questionFormName.set('');
    this.questionFormOptions.set([]);
    this.questionFormCorrectOptionId.set(null);
    this.questionFormDuration.set(DEFAULT_QUESTION_DURATION_SECONDS);
    this.questionFormCompleteText.set('');
    this.questionFormCompleteError.set('');
    this.resetTypeSpecificFields();
    this.questionFormSubjectId.set('');
    this.questionFormStageId.set('');
    this.questionFormGradeId.set('');
    this.questionFormSemester.set('');
  }

  addOption(): void {
    const options = this.questionFormOptions();
    const maxId = Math.max(0, ...options.map(o => o.id));
    this.questionFormOptions.set([...options, { id: maxId + 1, name: '' }]);
  }

  removeOption(optionId: number): void {
    this.questionFormOptions.update(opts => opts.filter(o => o.id !== optionId));
    if (this.questionFormCorrectOptionId() === optionId) {
      this.questionFormCorrectOptionId.set(null);
    }
  }

  updateOptionName(optionId: number, name: string): void {
    this.questionFormOptions.update(opts =>
      opts.map(o => o.id === optionId ? { ...o, name } : o)
    );
  }

  /**
   * Create or update, by whether the form is for a new question. The server
   * validates the question (and parses a Complete passage); a refusal is shown
   * with its reason and the form stays open. Returns whether it was saved.
   */
  private async persistQuestion(question: QuestionAdminItem, answer: QuestionAnswerInput): Promise<boolean> {
    try {
      if (this.questionFormIsNew()) await this.quizAdminService.createQuestion(question, answer);
      else await this.quizAdminService.updateQuestion(question, answer);
      return true;
    } catch (error) {
      this.notification.error(error instanceof ServiceError ? error.message : 'Failed to save the question.');
      return false;
    }
  }

  async saveQuestion(): Promise<void> {
    const id = this.questionFormId() ?? 0;                  // 0 for a new question: the server assigns its id
    if (!id && !this.questionFormIsNew()) return;

    const typeId = this.questionFormTypeId();
    const semester = this.questionFormSemester();
    const subjectId = this.questionFormSubjectId();
    const stageId = this.questionFormStageId();
    const gradeId = this.questionFormGradeId();
    const classification = {
      ...(subjectId ? { subjectId } : {}),
      ...(stageId ? { stageId } : {}),
      ...(gradeId ? { gradeId } : {}),
      ...(semester ? { semester: semester as QuestionSemester } : {})
    };

    if (typeId === QUESTION_TYPE.COMPLETE) {
      const parsed = parseCompleteAuthoredText(this.questionFormCompleteText().trim());
      if (isCompleteParseError(parsed)) {
        this.questionFormCompleteError.set(
          parsed.error === 'no-markers'
            ? this.translate.instant('questionsBank.form.completeNoMarkers')
            : this.translate.instant('questionsBank.form.completeEmptyKeyword')
        );
        return;
      }
      const question: QuestionAdminItem = {
        id,
        // Stored name is the masked preview — never the raw text with answers.
        name: renderPreviewText(parsed.segments),
        questionTypeId: QUESTION_TYPE.COMPLETE,
        options: [],
        segments: parsed.segments,
        duration: this.questionFormDuration(),
        ...classification
      };
      if (!(await this.persistQuestion(question, { correctBlanks: parsed.keywords }))) return;
      this.cancelQuestionForm();
      await this.refreshQuestions();
      return;
    }

    if (typeId === QUESTION_TYPE.RIGHT_WRONG) {
      const statement = this.questionFormName().trim();
      const isRight = this.questionFormIsRight();
      if (!statement) {
        this.questionFormTypeError.set(this.translate.instant('questionsBank.form.statementRequired'));
        return;
      }
      if (isRight === null) {
        this.questionFormTypeError.set(this.translate.instant('questionsBank.form.verdictRequired'));
        return;
      }
      // Stored as an ordinary two-option Choose question: the fixed Right/Wrong
      // pair on `/Questions`, the verdict as a plain `correctOptionId` on
      // `/Answers`. Every grading and review path then works unchanged.
      const question: QuestionAdminItem = {
        id,
        name: statement,
        questionTypeId: QUESTION_TYPE.RIGHT_WRONG,
        options: buildRightWrongOptions(),
        duration: this.questionFormDuration(),
        ...classification
      };
      if (!(await this.persistQuestion(question, { correctOptionId: rightWrongCorrectOptionId(isRight) }))) return;
      this.cancelQuestionForm();
      await this.refreshQuestions();
      return;
    }

    if (typeId === QUESTION_TYPE.EXPLAIN) {
      const subjectHtml = this.questionFormExplainSubject();
      const referenceAnswer = this.questionFormExplainAnswer();
      const weightPercent = Number(this.questionFormExplainWeight());
      const error = validateExplainAuthoring({ subjectHtml, referenceAnswer, weightPercent });
      if (error) {
        this.questionFormTypeError.set(this.translate.instant(`questionsBank.form.explain.${error}`));
        return;
      }
      const question: QuestionAdminItem = {
        id,
        // Plain flattening — `name` is printed raw by the bank's lists and search.
        name: plainTextFromHtml(subjectHtml),
        questionTypeId: QUESTION_TYPE.EXPLAIN,
        options: [],
        subjectHtml,
        weightPercent,
        duration: this.questionFormDuration(),
        ...classification
      };
      // The model answer is the answer key — it goes to `/Answers` only.
      if (!(await this.persistQuestion(question, { referenceAnswer }))) return;
      this.cancelQuestionForm();
      await this.refreshQuestions();
      return;
    }

    const name = this.questionFormName().trim();
    const correctOptionId = this.questionFormCorrectOptionId();
    if (!name || !correctOptionId) return;

    const question: QuestionAdminItem = {
      id,
      name,
      questionTypeId: QUESTION_TYPE.CHOOSE,
      options: this.questionFormOptions().filter(o => o.name.trim()),
      duration: this.questionFormDuration(),
      ...classification
    };

    if (!(await this.persistQuestion(question, { correctOptionId }))) return;
    this.cancelQuestionForm();
    await this.refreshQuestions();
  }

  getSemesterLabel(semester: string | undefined): string {
    const key = this.semesterOptions.find(o => o.value === semester)?.label;
    return key ? this.translate.instant(key) : '';
  }

  async removeQuestion(id: number): Promise<void> {
    if (!confirm('Are you sure you want to delete this question?')) return;
    await this.quizAdminService.deleteQuestion(id);
    this.selectedQuestionIds.update(ids => ids.filter(x => x !== id));
    await this.refreshQuestions();
  }

  toggleQuestionSelection(id: number): void {
    const current = this.selectedQuestionIds();
    if (current.includes(id)) {
      this.selectedQuestionIds.set(current.filter(x => x !== id));
    } else {
      this.selectedQuestionIds.set([...current, id]);
    }
  }

  isQuestionSelected(id: number): boolean {
    return this.selectedQuestionIds().includes(id);
  }

  /**
   * Select or clear every row on the current page.
   *
   * Scoped to the page on purpose: a "select all" that reached rows the admin
   * cannot see would make the bulk delete far more dangerous than it looks.
   * Selections do survive paging — the ids are kept, so an admin can gather a
   * set across several pages and edit them in one go.
   */
  togglePageSelection(): void {
    const ids = this.visibleQuestionRows().map(row => row.question.id);
    const selected = new Set(this.selectedQuestionIds());
    const allSelected = ids.every(id => selected.has(id));
    ids.forEach(id => allSelected ? selected.delete(id) : selected.add(id));
    this.selectedQuestionIds.set([...selected]);
  }

  clearQuestionSelection(): void {
    this.selectedQuestionIds.set([]);
  }

  async deleteSelectedQuestions(): Promise<void> {
    const ids = this.selectedQuestionIds();
    if (ids.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${ids.length} selected question(s)?`)) return;
    for (const id of ids) {
      await this.quizAdminService.deleteQuestion(id);
    }
    this.selectedQuestionIds.set([]);
    await this.refreshQuestions();
  }

  // ---- Bulk edit Stage / Subject / Semester ------------------------------

  /** Open the bulk-edit dialog for the current selection (no-op if empty). */
  openBulkEdit(): void {
    if (this.selectedQuestionIds().length === 0) return;
    this.resetBulkEditFields();
    this.showBulkEditForm.set(true);
  }

  cancelBulkEdit(): void {
    this.showBulkEditForm.set(false);
    this.resetBulkEditFields();
  }

  private resetBulkEditFields(): void {
    this.bulkEditStageId.set('');
    this.bulkEditSubjectId.set('');
    this.bulkEditSemester.set('');
  }

  /**
   * Apply the armed Stage/Subject/Semester values to every selected question in
   * one batch write. Only armed fields are sent, so untouched fields — and each
   * question's text, options and correct answer — are preserved.
   */
  async applyBulkEdit(): Promise<void> {
    const ids = this.selectedQuestionIds();
    if (ids.length === 0 || !this.bulkEditHasChanges()) return;

    const patch: { stageId?: string; subjectId?: string; semester?: QuestionSemester } = {};
    if (this.bulkEditStageId()) patch.stageId = this.bulkEditStageId();
    if (this.bulkEditSubjectId()) patch.subjectId = this.bulkEditSubjectId();
    const semester = this.bulkEditSemester();
    if (semester) patch.semester = semester;

    this.isBulkUpdating.set(true);
    try {
      const count = await this.quizAdminService.bulkUpdateQuestionFields(ids, patch);
      this.notification.success(`Updated ${count} question${count === 1 ? '' : 's'}.`);
      this.showBulkEditForm.set(false);
      this.resetBulkEditFields();
      this.selectedQuestionIds.set([]);
      await this.refreshQuestions();
    } catch (error) {
      this.notification.error('Failed to update questions. Please try again.');
      console.error(error);
    } finally {
      this.isBulkUpdating.set(false);
    }
  }

  // ---- Bulk upload (JSON file → many new questions) ----------------------

  /** Reads the chosen file, parses + validates it, and opens the classification popup. */
  onBulkUploadFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // allow re-selecting the same file after fixing it
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json')) {
      this.notification.error('Please choose a .json file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      let parsedRaw: unknown;
      try {
        parsedRaw = JSON.parse(String(reader.result));
      } catch {
        this.notification.error('That file is not valid JSON.');
        return;
      }
      const { questions, errors } = parseBulkQuestionsJson(parsedRaw);
      this.bulkUploadFileName.set(file.name);
      this.bulkUploadParsedQuestions.set(questions);
      this.bulkUploadErrors.set(errors);
      this.bulkUploadSubjectId.set('');
      this.bulkUploadStageId.set('');
      this.bulkUploadGradeId.set('');
      this.bulkUploadSemester.set('');
      this.showBulkUploadForm.set(true);
    };
    reader.onerror = () => this.notification.error('Could not read that file.');
    reader.readAsText(file);
  }

  /** Stage select in the upload popup; clears Grade if it no longer belongs to the new stage. */
  onBulkUploadStageChange(stageId: string): void {
    this.bulkUploadStageId.set(stageId);
    const grade = this.grades().find(g => g.id === this.bulkUploadGradeId());
    if (!grade || grade.stageId !== stageId) {
      this.bulkUploadGradeId.set('');
    }
  }

  cancelBulkUpload(): void {
    this.showBulkUploadForm.set(false);
    this.bulkUploadFileName.set('');
    this.bulkUploadParsedQuestions.set([]);
    this.bulkUploadErrors.set([]);
    this.bulkUploadSubjectId.set('');
    this.bulkUploadStageId.set('');
    this.bulkUploadGradeId.set('');
    this.bulkUploadSemester.set('');
  }

  /** Lets the admin grab a starting point matching the expected schema. */
  /**
   * Hand the admin the upload template.
   *
   * Offered in two places on purpose: beside "Upload JSON", which is where
   * someone who has never built one of these files starts, and inside the upload
   * modal, which is where someone whose file was rejected wants to compare.
   */
  downloadBulkUploadSample(): void {
    const blob = new Blob([JSON.stringify(BULK_UPLOAD_SAMPLE, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'questions-template.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Stamps every parsed question with the popup's Subject/Stage/Grade/Semester
   * and sends them in one request.
   */
  async confirmBulkUpload(): Promise<void> {
    if (!this.bulkUploadCanConfirm()) return;

    const subjectId = this.bulkUploadSubjectId();
    const stageId = this.bulkUploadStageId();
    const gradeId = this.bulkUploadGradeId();
    const semester = this.bulkUploadSemester() as QuestionSemester;

    // The server assigns every id, and saves the whole file or (reporting the first bad question) none of it.
    const rows = this.bulkUploadParsedQuestions().map(parsed => {
      const question: QuestionAdminItem = {
        id: 0,
        name: parsed.text,
        questionTypeId: parsed.questionTypeId,
        options: parsed.options.map(o => ({ id: o.id, name: o.text })),
        segments: parsed.segments,
        subjectHtml: parsed.subjectHtml,
        weightPercent: parsed.weightPercent,
        duration: parsed.duration,
        subjectId,
        stageId,
        gradeId,
        semester
      };
      return {
        question,
        answer: {
          correctOptionId: parsed.correctOptionId,
          correctBlanks: parsed.correctBlanks ?? null,
          referenceAnswer: parsed.referenceAnswer ?? null
        }
      };
    });

    this.isBulkUploading.set(true);
    try {
      await this.quizAdminService.bulkInsertQuestions(rows);
      this.notification.success(`Imported ${rows.length} question${rows.length === 1 ? '' : 's'}.`);
      this.cancelBulkUpload();
      await this.refreshQuestions();
    } catch (error) {
      this.notification.error(error instanceof ServiceError ? error.message : 'Failed to import questions. Please try again.');
      console.error(error);
    } finally {
      this.isBulkUploading.set(false);
    }
  }

  // Split-screen quiz creation methods
  async startCreateQuiz(): Promise<void> {
    // The Available Questions panel filters the whole bank client-side, so this
    // is where the full read is paid for — on opening the builder, not on
    // landing on the page.
    await this.ensureAllQuestionsLoaded();
    await this.clearQuizForm();
    this.showSplitScreen.set(true);
    this.assignedQuestionIds.set([]);
  }

  cancelCreateQuiz(): void {
    this.showSplitScreen.set(false);
    this.assignedQuestionIds.set([]);
    this.editingQuiz.set(false);
  }

  // Question assignment methods
  assignQuestion(questionId: number): void {
    const current = this.assignedQuestionIds();
    if (!current.includes(questionId)) {
      this.assignedQuestionIds.set([...current, questionId]);
      this.updateQuizFormQuestions();
    }
  }

  unassignQuestion(questionId: number): void {
    this.assignedQuestionIds.update(ids => ids.filter(id => id !== questionId));
    this.updateQuizFormQuestions();
  }

  isQuestionAssigned(questionId: number): boolean {
    return this.assignedQuestionIds().includes(questionId);
  }

  private updateQuizFormQuestions(): void {
    const ids = this.assignedQuestionIds();
    this.quizFormQuestions.set(ids.join(', '));
  }

  // Homework methods (moved from application-admin)
  /**
   * Load the first page of assignments and the toggle counts.
   *
   * Was a drain of the whole collection into `allHomework`, which the table then
   * sliced. Nothing holds every assignment now — the table reads
   * {@link homeworkList} and the badges read server counts.
   */
  async loadAllHomework(): Promise<void> {
    await Promise.all([
      this.homeworkList.reload(),
      this.refreshHomeworkCounts()
    ]);
  }

  // ---- Wizard navigation -------------------------------------------------

  /** Validate the current step before allowing forward navigation. */
  private canLeaveHomeworkStep(step: number): boolean {
    switch (step) {
      case 1:
        return !!(
          this.homeworkTitle().trim() &&
          this.homeworkQuizId() &&
          this.homeworkStageId().trim() &&
          this.homeworkClassId().trim() &&
          this.homeworkDueAt()
        );
      case 2:
        return this.homeworkSourceQuiz() || this.homeworkSourceBank();
      case 3:
        return this.homeworkSelectedQuestionIds().length > 0;
      default:
        return true;
    }
  }

  async nextHomeworkStep(): Promise<void> {
    const step = this.homeworkWizardStep();
    if (!this.canLeaveHomeworkStep(step)) {
      this.notification.warning(this.homeworkStepHint(step));
      return;
    }
    // Resolve the base quiz's questions once we leave the details step.
    if (step === 1) {
      await this.loadBaseQuizQuestions();
    }
    // Step 3 lists the bank filtered by subject/stage/semester, so it needs the
    // full set in memory.
    if (step === 2) {
      await this.ensureAllQuestionsLoaded();
    }
    this.homeworkWizardStep.set(Math.min(this.homeworkWizardSteps.length, step + 1));
  }

  prevHomeworkStep(): void {
    this.homeworkWizardStep.update(s => Math.max(1, s - 1));
  }

  /** Allow jumping back to an already-completed step via the stepper. */
  goToHomeworkStep(step: number): void {
    if (step < this.homeworkWizardStep()) {
      this.homeworkWizardStep.set(step);
    }
  }

  private homeworkStepHint(step: number): string {
    switch (step) {
      case 1: return 'Please fill in title, quiz, stage, class and due date.';
      case 2: return 'Pick at least one question source.';
      case 3: return 'Select at least one question.';
      default: return '';
    }
  }

  /** Load the selected quiz's question id list (resolved for display in step 3). */
  private async loadBaseQuizQuestions(): Promise<void> {
    const quizId = Number(this.homeworkQuizId());
    if (!quizId) {
      this.homeworkBaseQuizQuestionIds.set([]);
      return;
    }
    const full = await this.quizAdminService.getQuizWithConfig(quizId);
    this.homeworkBaseQuizQuestionIds.set((full?.Question ?? []).filter(id => Number.isFinite(id)));
  }

  // ---- Wizard question selection -----------------------------------------

  isHomeworkQuestionSelected(id: number): boolean {
    return this.homeworkSelectedQuestionIds().includes(id);
  }

  toggleHomeworkQuestion(id: number): void {
    const selected = new Set(this.homeworkSelectedQuestionIds());
    if (selected.has(id)) selected.delete(id); else selected.add(id);
    this.homeworkSelectedQuestionIds.set([...selected]);
  }

  /** Select or clear all of the base quiz's questions in one action. */
  toggleAllQuizQuestions(): void {
    const quizIds = this.quizSourceQuestions().map(q => q.id);
    const selected = new Set(this.homeworkSelectedQuestionIds());
    const allSelected = quizIds.every(id => selected.has(id));
    quizIds.forEach(id => allSelected ? selected.delete(id) : selected.add(id));
    this.homeworkSelectedQuestionIds.set([...selected]);
  }

  async submitHomework(): Promise<void> {
    const quizId = Number(this.homeworkQuizId());
    const dueAt = this.parseDueDateEndOfDay(this.homeworkDueAt());
    const title = this.homeworkTitle().trim();
    const stageId = this.homeworkStageId().trim();
    const classId = this.homeworkClassId().trim();

    if (!quizId || !title || !stageId || !classId || !dueAt) {
      this.notification.warning('Please fill in all required fields.');
      return;
    }

    const questionIds = [...this.homeworkSelectedQuestionIds()];
    if (questionIds.length === 0) {
      this.notification.warning('Add at least one question before saving.');
      return;
    }

    const semester = this.homeworkFormSemester() || undefined;
    const editingId = this.editingHomeworkId();
    const previous = this.editingHomeworkSnapshot();

    try {
      if (editingId && previous) {
        await this.homeworkService.updateAssignment(
          editingId,
          { title, quizId, stageId, classId, dueAt, semester, questionIds }
        );
        this.notification.success('Homework updated.');
      } else {
        await this.homeworkService.createAssignment({
          quizId,
          title,
          stageId,
          classId,
          dueAt,
          semester,
          questionIds,
          createdBy: 'quizzesAdmin',
          active: true
        });
        this.notification.success('Homework created.');
      }
      this.clearHomeworkForm();
      await this.loadAllHomework();
    } catch (error) {
      this.notification.error('Failed to save homework. Please try again.');
      console.error(error);
    }
  }

  // Preserved alias for any existing callers/tests.
  async addHomework(): Promise<void> {
    return this.submitHomework();
  }

  private parseDueDateEndOfDay(value: string): number {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return NaN;
    const [, y, m, d] = match;
    return new Date(Number(y), Number(m) - 1, Number(d), 23, 59, 59, 999).getTime();
  }

  setHomeworkForm(hw: HomeworkAssignment): void {
    this.editingHomeworkId.set(hw.id);
    this.editingHomeworkSnapshot.set(hw);
    this.homeworkTitle.set(hw.title);
    this.homeworkQuizId.set(hw.quizId);
    this.homeworkStageId.set(hw.stageId);
    this.homeworkClassId.set(hw.classId);
    this.homeworkDueAt.set(this.formatDueDateForInput(hw.dueAt));
    this.homeworkFormSemester.set(hw.semester ?? '');

    // Restart the wizard at step 1, seeded with this homework's saved questions.
    const saved = (hw.questionIds ?? []).filter(id => Number.isFinite(id));
    this.homeworkSelectedQuestionIds.set(saved);
    this.homeworkSourceQuiz.set(true);
    this.homeworkSourceBank.set(saved.length > 0);
    this.homeworkBankSubjectFilter.set('');
    this.homeworkBankStageFilter.set('');
    this.homeworkBankSemesterFilter.set('');
    this.homeworkBankSearch.set('');
    this.homeworkWizardStep.set(1);
    void this.loadBaseQuizQuestions();
    // Editing shows the saved selection by name straight away, which resolves
    // against the full bank.
    void this.ensureAllQuestionsLoaded();
    this.activeTab.set('homework');
  }

  private formatDueDateForInput(timestamp: number | undefined): string {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  clearHomeworkForm(): void {
    this.homeworkTitle.set('');
    this.homeworkQuizId.set(null);
    this.homeworkStageId.set('');
    this.homeworkClassId.set('');
    this.homeworkDueAt.set('');
    this.homeworkFormSemester.set('');
    this.editingHomeworkId.set(null);
    this.editingHomeworkSnapshot.set(null);

    // Reset the wizard back to a clean step 1.
    this.homeworkWizardStep.set(1);
    this.homeworkSourceQuiz.set(true);
    this.homeworkSourceBank.set(false);
    this.homeworkSelectedQuestionIds.set([]);
    this.homeworkBaseQuizQuestionIds.set([]);
    this.homeworkBankSubjectFilter.set('');
    this.homeworkBankStageFilter.set('');
    this.homeworkBankSemesterFilter.set('');
    this.homeworkBankSearch.set('');
  }

  async toggleHomeworkActive(hw: HomeworkAssignment): Promise<void> {
    const nextActive = !hw.active;
    try {
      await this.homeworkService.setAssignmentActive(hw.id, nextActive);
      this.notification.success(nextActive ? 'Homework activated.' : 'Homework deactivated.');
      await this.loadAllHomework();
    } catch (error) {
      this.notification.error('Failed to update homework status.');
      console.error(error);
    }
  }

  // Preserved for backwards compatibility — same behavior as before.
  async deactivateHomework(id: string): Promise<void> {
    try {
      await this.homeworkService.deactivateAssignment(id);
      await this.loadAllHomework();
    } catch (error) {
      this.notification.error('Failed to deactivate homework.');
      console.error(error);
    }
  }

  async viewHomeworkCompletion(assignment: HomeworkAssignment): Promise<void> {
    this.selectedHomeworkId.set(assignment.id);
    this.selectedHomeworkTitle.set(assignment.title);
    this.selectedHomeworkKind.set(this.assignmentKindOf(assignment));
    this.homeworkParticipations.set([]);
    this.homeworkParticipationCursor.set(undefined);
    await this.loadHomeworkParticipations();
  }

  closeHomeworkCompletion(): void {
    this.selectedHomeworkId.set(null);
    this.selectedHomeworkTitle.set(null);
    this.selectedHomeworkKind.set('homework');
    this.homeworkParticipations.set([]);
    this.homeworkParticipationCursor.set(undefined);
  }

  async loadHomeworkParticipations(): Promise<void> {
    const homeworkId = this.selectedHomeworkId();
    if (!homeworkId) return;
    const result = await this.homeworkParticipationService.listByHomework(homeworkId, 10, this.homeworkParticipationCursor());
    this.homeworkParticipations.update(items => [...items, ...result.items]);
    this.homeworkParticipationCursor.set(result.nextCursor);
    await this.populateHomeworkChildNames(result.items);
  }

  /**
   * Name of a bank quiz.
   *
   * Reads the picker list when it happens to be loaded (the wizard needs it
   * anyway), and otherwise the per-page cache filled by
   * {@link cacheQuizNamesFor} — so the assignments table shows real names
   * without this screen holding the whole bank.
   */
  getQuizName(quizId: number): string {
    const fromPicker = this.allQuizzes().find(q => q.id === quizId)?.name;
    return fromPicker || this.assignmentQuizNames().get(String(quizId)) || `Quiz #${quizId}`;
  }

  /**
   * The name of the quiz an assignment actually runs.
   *
   * Not `getQuizName(hw.quizId)`. An assignment built on a teacher-authored quiz
   * stores `quizSource: 'custom'` with the real quiz at
   * `teacherQuizzes/{customQuizId}`, and leaves `quizId` at the sentinel `0`
   * (see `HomeworkAssignment.quizSource`). Looking that sentinel up in the bank
   * can never match, so every such row rendered as the literal "Quiz #0" — which
   * is every row in a school whose quizzes are all teacher-authored.
   */
  assignmentQuizName(assignment: HomeworkAssignment): string {
    if (assignment.quizSource === 'custom') {
      const name = assignment.customQuizId
        ? this.assignmentQuizNames().get(assignment.customQuizId)
        : undefined;
      // Falls back to the assignment's own title rather than "Quiz #0": the
      // teacher quiz may have been deleted, and the title is the closest true
      // thing we hold.
      return name || assignment.title;
    }
    return this.getQuizName(assignment.quizId);
  }

  /**
   * Names of the teacher quizzes referenced by the assignments currently on
   * screen, keyed by quiz id.
   *
   * Filled on demand from the visible page rather than read out of a full
   * `teacherQuizzes` list. That list is what stops this screen scaling: an
   * assignments table showing twenty rows needs at most twenty names, so it
   * fetches those and nothing else. Mirrors `customQuizCache` on the student
   * dashboard, which resolves the same names the same way.
   */
  readonly assignmentQuizNames = signal<Map<string, string>>(new Map());

  /**
   * Fetch any teacher-quiz names this page of assignments needs and does not
   * already have. One `getDoc` per genuinely new id, so paging back over rows
   * already seen costs nothing.
   */
  private async cacheQuizNamesFor(assignments: HomeworkAssignment[]): Promise<void> {
    const known = this.assignmentQuizNames();

    const missingCustom = [...new Set(
      assignments
        .filter(a => a.quizSource === 'custom' && a.customQuizId && !known.has(a.customQuizId))
        .map(a => a.customQuizId!)
    )];
    // Bank-sourced rows share the cache, keyed by the stringified numeric id —
    // the two id spaces cannot collide because a teacher quiz id is a Firestore
    // auto-id, never a bare number.
    const missingBank = [...new Set(
      assignments
        .filter(a => a.quizSource !== 'custom' && a.quizId && !known.has(String(a.quizId)))
        .map(a => a.quizId)
    )];
    if (missingCustom.length === 0 && missingBank.length === 0) return;

    const [custom, bank] = await Promise.all([
      Promise.all(missingCustom.map(id => this.teacherQuizService.getById(id))),
      Promise.all(missingBank.map(id => this.quizAdminService.getQuiz(id)))
    ]);

    this.assignmentQuizNames.update(map => {
      const next = new Map(map);
      missingCustom.forEach((id, i) => { const q = custom[i]; if (q) next.set(id, q.name); });
      missingBank.forEach((id, i) => { const q = bank[i]; if (q) next.set(String(id), q.name); });
      return next;
    });
  }

  getStageName(stageId: string): string {
    const stage = this.stages().find(s => s.id === stageId);
    return stage?.name || stageId;
  }

  getClassName(classId: string): string {
    const cls = this.classes().find(c => c.id === classId);
    return cls?.name || classId;
  }

  getGradeName(gradeId: string | undefined): string {
    if (!gradeId) return '';
    return this.grades().find(g => g.id === gradeId)?.name ?? gradeId;
  }

  private async populateHomeworkChildNames(records: ParticipationRecord[]): Promise<void> {
    const existing = this.homeworkChildNames();
    const missing = records
      .map(r => r.childId)
      .filter(id => id && !existing[id]);
    if (missing.length === 0) return;

    const users = await this.appUserService.fetchUsersByIds(missing);
    const mapping = users.reduce((acc, user) => {
      acc[user.uid] = user.displayName;
      return acc;
    }, {} as Record<string, string>);

    this.homeworkChildNames.set({
      ...existing,
      ...mapping
    });
  }
}