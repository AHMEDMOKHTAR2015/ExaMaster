import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LoadingButtonDirective } from '../../../directives';
import { QuizAdminService } from '../../../services/admin/quizzes/quiz-admin.service';
import { TeacherQuizService } from '../../../services/teacher-quiz.service';
import { NotificationService } from '../../../services/notification.service';
import { QuestionAdminItem } from '../../../interfaces';
import { QuestionBankFilters } from '../../../services/admin/quizzes/quiz-admin.service';
import { debounced } from '../../../shared/debounce';
import { LoadMoreList } from '../../../shared/load-more-list';
import {
  TeacherQuiz, TeacherQuizQuestion, QuizConfig, HomeworkSemester, Grade,
  QUESTION_TYPE, DEFAULT_QUESTION_DURATION_SECONDS
} from '../../../models';
import { GradeService } from '../../../services/admin';
import { parseCompleteAuthoredText, isCompleteParseError, renderPreviewText, reconstructAuthoredText } from '../../../shared/complete-question';
import { buildRightWrongOptions, rightWrongCorrectOptionId, readRightWrongIsRight } from '../../../shared/right-wrong-question';
import {
  DEFAULT_EXPLAIN_WEIGHT_PERCENT, MAX_EXPLAIN_WEIGHT_PERCENT, MIN_EXPLAIN_WEIGHT_PERCENT,
  plainTextFromHtml, validateExplainAuthoring
} from '../../../shared/explain-question';
import { validateExplainWeights } from '../../../shared/question-scoring';
import { RichTextEditorComponent } from '../../../shared/rich-text-editor/rich-text-editor.component';
import { TagToggleListComponent } from '../../../shared/tag-toggle-list/tag-toggle-list.component';
import { QuizManagementStateService } from '../quiz-management-state.service';

/** Working state for one question in the custom-quiz builder. */
interface BuilderQuestion {
  id: number;
  questionTypeId: number;
  /**
   * Choose: the question text. Right or Wrong: the statement. Complete and
   * Explain: unused (their text lives on `rawText` / `subjectHtml`).
   */
  name: string;
  options: BuilderOption[];
  correctOptionId: number | null;
  /** Complete only: the authored passage with `(Complete)` markers. */
  rawText: string;
  /** Right or Wrong only: the verdict; `null` until the author picks one. */
  isRight: boolean | null;
  /** Explain only: the prompt as rich HTML. */
  subjectHtml: string;
  /** Explain only: the model answer as rich HTML. */
  referenceAnswer: string;
  /** Explain only: share of the whole quiz score, 1–100. */
  weightPercent: number;
  /** Seconds this question gets on the clock during quiz-taking. */
  duration: number;
  /** Tags of the quiz's subject; any of another subject (a copied question) are dropped when the quiz is saved. */
  tagIds: string[];
  /**
   * Id of the question-bank item this was copied from, when it came from the
   * bank picker. Purely provenance for the picker's Add/Remove toggle — the
   * copy is independent once made, and this is never persisted, so editing or
   * re-saving the quiz does not depend on the bank question still existing.
   */
  sourceBankId?: number;
}

interface BuilderOption {
  id: number;
  name: string;
}

/**
 * Builder-side wording for each Explain authoring failure. Hardcoded English to
 * match every other `builderError` message in this component (the admin
 * Questions Bank routes the same errors through `translate.instant` instead).
 */
const EXPLAIN_AUTHORING_MESSAGES: Record<string, string> = {
  'empty-subject': 'Every Explain question needs a subject.',
  'empty-answer': 'Every Explain question needs a reference answer.',
  'invalid-weight': 'An Explain question\'s score share must be between 1 and 100.',
  'too-long': 'That Explain question is too large to save. Shorten the subject or the reference answer.'
};

/**
 * "My Quizzes" tab — this teacher's own authored quizzes, plus the custom quiz
 * builder that creates and edits them.
 *
 * The builder is self-contained here (nothing outside this tab opens it), which
 * is why the sidebar's "Create New Quiz" CTA deep-links to this route with
 * `?action=create` rather than going through the workspace shell.
 */
@Component({
    selector: 'app-my-quizzes-tab',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, NgTemplateOutlet, TranslatePipe, LoadingButtonDirective, RichTextEditorComponent, TagToggleListComponent],
    templateUrl: './my-quizzes-tab.component.html'
})
export class MyQuizzesTabComponent implements OnInit {
  readonly state = inject(QuizManagementStateService);
  private readonly teacherQuizService = inject(TeacherQuizService);
  private readonly quizAdminService = inject(QuizAdminService);
  private readonly gradeService = inject(GradeService);
  private readonly notification = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // ---- Custom quiz builder ---------------------------------------------------
  readonly showQuizBuilder = signal(false);
  /** Which of the builder's three tabs is showing; every open starts on Quiz Content. */
  readonly builderTab = signal<'content' | 'config' | 'sources'>('content');
  /**
   * Questions written from scratch on Question Sources since the builder opened:
   * that tab shows their editors under its buttons, so a new question is filled
   * in where it was added. They are ordinary builder questions, listed on Quiz
   * Content too.
   */
  readonly sourcesNewQuestionIds = signal<number[]>([]);
  readonly sourcesNewQuestions = computed(() => {
    const ids = new Set(this.sourcesNewQuestionIds());
    return this.builderQuestions()
      .map((question, index) => ({ question, index }))
      .filter(({ question }) => ids.has(question.id));
  });
  readonly editingQuizId = signal<string | null>(null);
  readonly builderName = signal('');
  readonly builderDescription = signal('');
  readonly builderStageId = signal('');
  readonly builderSubjectId = signal('');
  readonly builderSemester = signal<HomeworkSemester | ''>('');

  /**
   * Narrows the question picker to one grade.
   *
   * Purely a picker filter — it is not saved on the quiz. A custom quiz is
   * bound to a group when it is *assigned*, not when it is authored, so
   * recording a year here would claim a scope the quiz does not have.
   */
  readonly builderGradeId = signal('');

  /** Grades for the Grade select. Loaded with the builder, not with the app. */
  readonly grades = signal<Grade[]>([]);
  private gradesLoaded = false;
  readonly builderShuffleQuestions = signal(false);
  readonly builderRequiredAll = signal(false);
  readonly builderPageSize = signal(1);
  readonly builderAllowBack = signal(true);
  readonly builderAllowReview = signal(true);
  readonly builderAutoMove = signal(false);
  /** "One Time Join" — see `QuizConfig.oneTimeJoin`. Off unless deliberately chosen. */
  readonly builderOneTimeJoin = signal(false);
  readonly builderRichText = signal(false);
  readonly builderShowClock = signal(true);
  readonly builderShowPager = signal(true);
  readonly builderShuffleOptions = signal(false);

  readonly builderQuestions = signal<BuilderQuestion[]>([]);
  readonly builderError = signal('');
  readonly isSavingQuiz = signal(false);

  /**
   * Total quiz duration in minutes — no longer authored directly, but derived
   * from summing every builder question's own `duration` (seconds), each
   * defaulting to `DEFAULT_QUESTION_DURATION_SECONDS` when unset. Display-only,
   * mirroring `quizzes-admin`'s `configDuration`.
   */
  readonly builderDurationMinutes = computed(() =>
    Math.round(this.builderQuestions().reduce((total, q) => total + (q.duration ?? DEFAULT_QUESTION_DURATION_SECONDS), 0) / 60)
  );

  /** Exposed for the template to branch the builder UI on question type. */
  readonly QUESTION_TYPE = QUESTION_TYPE;
  /** Exposed so the weight input's min/max match the validator's bounds. */
  readonly MIN_EXPLAIN_WEIGHT_PERCENT = MIN_EXPLAIN_WEIGHT_PERCENT;
  readonly MAX_EXPLAIN_WEIGHT_PERCENT = MAX_EXPLAIN_WEIGHT_PERCENT;

  /** Inline panel for appending questions from the admin question bank into the builder. */
  readonly showBankPicker = signal(false);
  readonly bankPickerSearch = signal('');
  /** The matching questions, a page at a time; the API applies {@link bankPickerFilters} across the whole bank. */
  readonly bankList = new LoadMoreList<QuestionAdminItem>(
    () => this.quizAdminService.questionSource(this.bankPickerFilters()),
    50,
    () => this.notification.error('Failed to load the question bank.')
  );
  readonly bankTotal = this.bankList.total;
  readonly isLoadingBankQuestions = this.bankList.isLoading;
  readonly isLoadingMoreBankQuestions = this.bankList.isLoadingMore;
  private readonly bankSearchSoon = debounced(inject(DestroyRef));

  /** Inline panel for reusing questions from one of this teacher's other quizzes. */
  readonly showQuizPicker = signal(false);
  readonly quizPickerSearch = signal('');
  readonly quizPickerSourceId = signal<string | null>(null);

  /**
   * Grades belonging to the stage the builder is set to, in their authored
   * order.
   *
   * A grade sits inside exactly one stage, so offering grades from another one
   * would let the two selects contradict each other and quietly empty the
   * picker.
   */
  readonly builderGradeOptions = computed<Grade[]>(() => {
    const stageId = this.builderStageId();
    const grades = stageId ? this.grades().filter(g => g.stageId === stageId) : this.grades();
    return [...grades].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  });

  /**
   * The bank questions this quiz could use, for "Add from question bank": the
   * API matches the builder's stage, group's grade, subject and term, and the
   * search box, across the whole bank (see {@link bankPickerFilters}).
   */
  readonly filteredBankQuestions = this.bankList.items;

  readonly hasMoreBankQuestions = this.bankList.hasMore;

  /**
   * The builder's selections as the API's question filters. Grade is strict — a
   * question nobody has classified is not "for every year" — while the term is
   * permissive: most banks are authored without one, so an unset term fits any.
   */
  private bankPickerFilters(): QuestionBankFilters {
    return {
      stageId: this.builderStageId() || undefined,
      gradeId: this.builderGradeId() || undefined,
      subjectId: this.builderSubjectId() || undefined,
      forSemester: this.builderSemester() || undefined,
      search: this.bankPickerSearch() || undefined
    };
  }

  /**
   * Bank question ids currently represented in the builder, driving the picker's
   * Add/Remove toggle.
   *
   * Derived from the builder list rather than tracked alongside it, so removing
   * a question from the builder's own editor flips the picker's button back to
   * "Add" with no extra bookkeeping and no way for the two to disagree.
   */
  readonly addedBankQuestionIds = computed<ReadonlySet<number>>(() => {
    const ids = new Set<number>();
    for (const q of this.builderQuestions()) {
      if (q.sourceBankId !== undefined) ids.add(q.sourceBankId);
    }
    return ids;
  });

  /** This teacher's other quizzes, for the "add from my quizzes" picker (excludes the one being edited). */
  readonly quizPickerCandidates = computed<TeacherQuiz[]>(() => {
    const excludeId = this.editingQuizId();
    const search = this.quizPickerSearch().toLowerCase().trim();
    return this.state.myCustomQuizzes()
      .filter(q => q.id !== excludeId)
      .filter(q => !search || q.name.toLowerCase().includes(search));
  });

  /** The quiz currently opened in the picker to browse its questions, if any. */
  readonly quizPickerSourceQuiz = computed<TeacherQuiz | null>(() => {
    const id = this.quizPickerSourceId();
    return id ? this.state.customQuizById().get(id) ?? null : null;
  });

  constructor() {
    // While the bank picker is open it shows what this quiz could use, so it
    // re-asks the API whenever it opens or the builder's stage, group, subject or
    // term changes. The search box reloads on its own, once typing pauses.
    effect(() => {
      if (!this.showBankPicker()) return;
      this.builderStageId(); this.builderGradeId(); this.builderSubjectId(); this.builderSemester();
      untracked(() => void this.bankList.reload());
    });
  }

  ngOnInit(): void {
    // The sidebar "Create New Quiz" CTA links here with ?action=create so the
    // custom quiz builder opens immediately. Consumed via an observable (not
    // just the initial snapshot) so clicking the CTA again while already on
    // this page — a query-param-only navigation — still re-opens the
    // builder; the param is then cleared so a later click always produces a
    // fresh navigation. Waits for the workspace's scope load so the builder's
    // subject dropdown isn't opened before this teacher's subjects are loaded.
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      if (params.get('action') === 'create') {
        this.state.init().then(() => this.openQuizBuilder());
        this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
      }
    });
  }

  // ---- Builder lifecycle -----------------------------------------------------

  /** Opens the builder for a new quiz, or seeds it from an existing one when editing. */
  /**
   * Changing the stage drops a grade that no longer belongs to it, so the two
   * selects can never disagree — a grade from the old stage would otherwise
   * keep filtering against a year the chosen stage does not contain, quietly
   * emptying the picker.
   */
  onBuilderStageChange(stageId: string): void {
    this.builderStageId.set(stageId);
    const stillValid = this.builderGradeOptions().some(grade => grade.id === this.builderGradeId());
    if (!stillValid) this.builderGradeId.set('');
  }

  /**
   * The grade list, fetched once per session.
   *
   * Kicked off when the builder opens rather than awaited, because the Grade
   * select is visible immediately and holding the whole dialog for a reference
   * lookup would make opening it feel slow. The select simply fills in.
   */
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
      // A missing grade list costs the filter, not the builder — the teacher
      // can still author and pick questions with the other three filters.
      this.grades.set([]);
    }
  }

  openQuizBuilder(quiz?: TeacherQuiz): void {
    this.editingQuizId.set(quiz?.id ?? null);
    this.builderName.set(quiz?.name ?? '');
    this.builderDescription.set(quiz?.description ?? '');
    this.builderStageId.set(quiz?.stageId ?? this.state.myStages()[0]?.id ?? '');
    this.builderSubjectId.set(quiz?.subjectId ?? this.state.mySubjects()[0]?.id ?? '');
    this.builderSemester.set(quiz?.semester ?? '');
    // Always starts at "all grades": the grade is a picker filter, not part of
    // the quiz, so there is nothing on an edited quiz to restore it from.
    this.builderGradeId.set('');
    void this.loadGrades();
    this.builderShuffleQuestions.set(quiz?.config?.shuffleQuestions ?? false);
    this.builderRequiredAll.set(quiz?.config?.requiredAll ?? false);
    this.builderPageSize.set(quiz?.config?.pageSize ?? 1);
    this.builderAllowBack.set(quiz?.config?.allowBack ?? true);
    this.builderAllowReview.set(quiz?.config?.allowReview ?? true);
    this.builderAutoMove.set(quiz?.config?.autoMove ?? false);
    this.builderOneTimeJoin.set(quiz?.config?.oneTimeJoin ?? false);
    this.builderRichText.set(quiz?.config?.richText ?? false);
    this.builderShowClock.set(quiz?.config?.showClock ?? true);
    this.builderShowPager.set(quiz?.config?.showPager ?? true);
    this.builderShuffleOptions.set(quiz?.config?.shuffleOptions ?? false);
    this.builderQuestions.set(
      (quiz?.questions ?? []).map(q => this.toBuilderQuestion(q))
    );
    this.builderError.set('');
    this.builderTab.set('content');
    this.sourcesNewQuestionIds.set([]);
    this.showQuizBuilder.set(true);
  }

  closeQuizBuilder(): void {
    this.showQuizBuilder.set(false);
    this.showBankPicker.set(false);
    this.showQuizPicker.set(false);
    this.quizPickerSourceId.set(null);
    this.quizPickerSearch.set('');
  }

  /** A builder question with every type-specific field at its neutral value. */
  private emptyBuilderQuestion(id: number, questionTypeId: number, duration: number): BuilderQuestion {
    return {
      id,
      questionTypeId,
      name: '',
      options: [],
      correctOptionId: null,
      rawText: '',
      isRight: null,
      subjectHtml: '',
      referenceAnswer: '',
      weightPercent: DEFAULT_EXPLAIN_WEIGHT_PERCENT,
      duration,
      tagIds: []
    };
  }

  /** Map a stored {@link TeacherQuizQuestion} back into editable builder state, per type. */
  private toBuilderQuestion(q: TeacherQuizQuestion): BuilderQuestion {
    const duration = q.duration ?? DEFAULT_QUESTION_DURATION_SECONDS;
    const base = { ...this.emptyBuilderQuestion(q.id, q.questionTypeId, duration), tagIds: [...(q.tagIds ?? [])] };

    if (q.questionTypeId === QUESTION_TYPE.COMPLETE) {
      return {
        ...base,
        name: q.name,
        rawText: reconstructAuthoredText(q.segments ?? [], (q.blanks ?? []).map(b => b.answer))
      };
    }
    if (q.questionTypeId === QUESTION_TYPE.RIGHT_WRONG) {
      return {
        ...base,
        name: q.name,
        isRight: readRightWrongIsRight(q.options.find(o => o.isAnswer)?.id)
      };
    }
    if (q.questionTypeId === QUESTION_TYPE.EXPLAIN) {
      return {
        ...base,
        name: q.name,
        subjectHtml: q.subjectHtml ?? q.name,
        referenceAnswer: q.referenceAnswer ?? '',
        weightPercent: q.weightPercent ?? DEFAULT_EXPLAIN_WEIGHT_PERCENT
      };
    }
    return {
      ...base,
      questionTypeId: QUESTION_TYPE.CHOOSE,
      name: q.name,
      options: q.options.map(o => ({ id: o.id, name: o.name })),
      correctOptionId: q.options.find(o => o.isAnswer)?.id ?? null
    };
  }

  // ---- Question bank picker --------------------------------------------------

  /** Toggles the "Add from question bank" panel; while open it follows the builder's selections (see the constructor). */
  toggleBankPicker(): void {
    this.showBankPicker.update(open => !open);
  }

  onBankSearchChange(search: string): void {
    this.bankPickerSearch.set(search);
    this.bankSearchSoon(() => void this.bankList.reload());
  }

  loadMoreBankQuestions(): void {
    void this.bankList.loadMore();
  }

  /**
   * Add the bank question to the builder, or take it back out if it is already
   * there — the picker's button reads "Add"/"Remove" off
   * {@link addedBankQuestionIds} accordingly.
   */
  async toggleQuestionFromBank(bankQuestion: QuestionAdminItem): Promise<void> {
    if (this.addedBankQuestionIds().has(bankQuestion.id)) {
      this.removeQuestionFromBank(bankQuestion);
      return;
    }
    await this.appendQuestionFromBank(bankQuestion);
  }

  /** Drop every builder question copied from `bankQuestion`. */
  private removeQuestionFromBank(bankQuestion: QuestionAdminItem): void {
    this.builderQuestions.update(qs => qs.filter(q => q.sourceBankId !== bankQuestion.id));
    this.notification.success('Question removed.');
  }

  /** Copies a question-bank item (text, options, correct answer) into the builder as a new local question. */
  async appendQuestionFromBank(bankQuestion: QuestionAdminItem): Promise<void> {
    // The bank keeps answers in a separate node, so one fetch supplies whichever
    // answer field this question's type uses.
    const answer = await this.quizAdminService.getAnswer(bankQuestion.id);
    const duration = bankQuestion.duration ?? DEFAULT_QUESTION_DURATION_SECONDS;
    const base = { ...this.emptyBuilderQuestion(this.nextQuestionId(), bankQuestion.questionTypeId, duration), tagIds: [...(bankQuestion.tagIds ?? [])] };
    let question: BuilderQuestion;

    if (bankQuestion.questionTypeId === QUESTION_TYPE.COMPLETE) {
      question = {
        ...base,
        name: bankQuestion.name,
        rawText: reconstructAuthoredText(bankQuestion.segments ?? [], answer?.correctBlanks ?? [])
      };
    } else if (bankQuestion.questionTypeId === QUESTION_TYPE.RIGHT_WRONG) {
      question = {
        ...base,
        name: bankQuestion.name,
        isRight: readRightWrongIsRight(answer?.correctOptionId)
      };
    } else if (bankQuestion.questionTypeId === QUESTION_TYPE.EXPLAIN) {
      question = {
        ...base,
        name: bankQuestion.name,
        subjectHtml: bankQuestion.subjectHtml ?? bankQuestion.name,
        referenceAnswer: answer?.referenceAnswer ?? '',
        weightPercent: bankQuestion.weightPercent ?? DEFAULT_EXPLAIN_WEIGHT_PERCENT
      };
    } else {
      const options: BuilderOption[] = bankQuestion.options.map((o, i) => ({ id: i + 1, name: o.name }));
      const correctIndex = bankQuestion.options.findIndex(o => o.id === answer?.correctOptionId);
      question = {
        ...base,
        questionTypeId: QUESTION_TYPE.CHOOSE,
        name: bankQuestion.name,
        options,
        correctOptionId: correctIndex >= 0 ? options[correctIndex].id : null
      };
    }
    this.builderQuestions.update(qs => [...qs, { ...question, sourceBankId: bankQuestion.id }]);
    this.notification.success('Question added from the bank.');
  }

  // ---- "Add from my quizzes" picker ------------------------------------------

  /** Toggles the "Add from my quizzes" panel, resetting its browse state on close. */
  toggleQuizPicker(): void {
    const opening = !this.showQuizPicker();
    this.showQuizPicker.set(opening);
    if (!opening) {
      this.quizPickerSourceId.set(null);
      this.quizPickerSearch.set('');
    }
  }

  selectQuizPickerSource(quizId: string): void {
    this.quizPickerSourceId.set(quizId);
  }

  backToQuizPickerList(): void {
    this.quizPickerSourceId.set(null);
  }

  /** Copies one question from another of this teacher's quizzes into the builder as a new local question. */
  appendQuestionFromQuiz(question: TeacherQuizQuestion): void {
    const built = this.copyTeacherQuizQuestion(question, this.nextQuestionId());
    this.builderQuestions.update(qs => [...qs, built]);
    this.notification.success('Question added.');
  }

  /** Copies every question from `sourceQuiz` into the builder in one batch. */
  appendAllQuestionsFromQuiz(sourceQuiz: TeacherQuiz): void {
    if (sourceQuiz.questions.length === 0) return;
    let nextId = this.nextQuestionId();
    const copied: BuilderQuestion[] = sourceQuiz.questions.map(q => this.copyTeacherQuizQuestion(q, nextId++));
    this.builderQuestions.update(qs => [...qs, ...copied]);
    this.notification.success(`${copied.length} question(s) added from "${sourceQuiz.name}".`);
  }

  /**
   * Build a fresh-id builder question from a source teacher-quiz question
   * (answers are already embedded, so nothing needs fetching). Delegates the
   * per-type mapping to {@link toBuilderQuestion}; only Choose differs, because
   * a copy renumbers its options from 1 rather than carrying the source's ids.
   */
  private copyTeacherQuizQuestion(question: TeacherQuizQuestion, id: number): BuilderQuestion {
    const mapped = { ...this.toBuilderQuestion(question), id };
    // Right or Wrong synthesizes its option pair at save time from `isRight`,
    // so like Complete and Explain it has nothing to renumber here.
    if (mapped.questionTypeId !== QUESTION_TYPE.CHOOSE) return mapped;
    const options: BuilderOption[] = question.options.map((o, i) => ({ id: i + 1, name: o.name }));
    const correctIndex = question.options.findIndex(o => o.isAnswer);
    return {
      ...mapped,
      options,
      correctOptionId: correctIndex >= 0 ? options[correctIndex].id : null
    };
  }

  // ---- Builder question editing ----------------------------------------------

  private nextQuestionId(): number {
    return Math.max(0, ...this.builderQuestions().map(q => q.id)) + 1;
  }

  private nextOptionId(question: BuilderQuestion): number {
    return Math.max(0, ...question.options.map(o => o.id)) + 1;
  }

  addBuilderQuestion(): void {
    const id = this.nextQuestionId();
    const question: BuilderQuestion = {
      ...this.emptyBuilderQuestion(id, QUESTION_TYPE.CHOOSE, DEFAULT_QUESTION_DURATION_SECONDS),
      options: [{ id: 1, name: '' }, { id: 2, name: '' }]
    };
    this.builderQuestions.update(qs => [...qs, question]);
    this.sourcesNewQuestionIds.update(ids => [...ids, id]);
  }

  /** The builder's label key for a question type, as its own type selector words it. */
  questionTypeKey(questionTypeId: number): string {
    switch (questionTypeId) {
      case QUESTION_TYPE.COMPLETE: return 'quizManagement.builder.typeComplete';
      case QUESTION_TYPE.RIGHT_WRONG: return 'quizManagement.builder.typeRightWrong';
      case QUESTION_TYPE.EXPLAIN: return 'quizManagement.builder.typeExplain';
      default: return 'quizManagement.builder.typeChoose';
    }
  }

  /** A bank question's tags by name. The picker lists the chosen subject's questions, so these are its tags. */
  bankTagNames(question: QuestionAdminItem): string[] {
    const tags = this.builderSubjectTags();
    return (question.tagIds ?? [])
      .map(id => tags.find(tag => tag.id === id)?.name)
      .filter((name): name is string => !!name);
  }

  /** The tags a question of this quiz can carry: its subject's. */
  readonly builderSubjectTags = computed(() =>
    this.state.subjects().find(subject => subject.id === this.builderSubjectId())?.tags ?? []
  );

  updateBuilderQuestionTags(questionId: number, tagIds: string[]): void {
    this.builderQuestions.update(qs => qs.map(q => q.id === questionId ? { ...q, tagIds } : q));
  }

  updateBuilderQuestionDuration(questionId: number, value: number): void {
    this.builderQuestions.update(qs => qs.map(q => q.id === questionId ? { ...q, duration: value } : q));
  }

  /**
   * Switch one builder question's type, clearing the fields the previous type
   * owned so an abandoned draft can't leak into the saved question.
   */
  setBuilderQuestionType(questionId: number, typeId: number): void {
    this.builderQuestions.update(qs => qs.map(q => {
      if (q.id !== questionId) return q;
      const cleared = { ...this.emptyBuilderQuestion(q.id, typeId, q.duration), tagIds: q.tagIds };
      if (typeId === QUESTION_TYPE.COMPLETE) {
        return { ...cleared, rawText: q.rawText };
      }
      if (typeId === QUESTION_TYPE.RIGHT_WRONG) {
        return { ...cleared, name: q.name, isRight: q.isRight };
      }
      if (typeId === QUESTION_TYPE.EXPLAIN) {
        return {
          ...cleared,
          subjectHtml: q.subjectHtml,
          referenceAnswer: q.referenceAnswer,
          weightPercent: q.weightPercent
        };
      }
      return {
        ...cleared,
        questionTypeId: QUESTION_TYPE.CHOOSE,
        name: q.name,
        options: q.options.length >= 2 ? q.options : [{ id: 1, name: '' }, { id: 2, name: '' }],
        correctOptionId: q.correctOptionId
      };
    }));
  }

  setBuilderIsRight(questionId: number, isRight: boolean): void {
    this.builderQuestions.update(qs => qs.map(q => q.id === questionId ? { ...q, isRight } : q));
    this.builderError.set('');
  }

  updateBuilderSubjectHtml(questionId: number, value: string): void {
    this.builderQuestions.update(qs => qs.map(q => q.id === questionId ? { ...q, subjectHtml: value } : q));
    this.builderError.set('');
  }

  updateBuilderReferenceAnswer(questionId: number, value: string): void {
    this.builderQuestions.update(qs => qs.map(q => q.id === questionId ? { ...q, referenceAnswer: value } : q));
    this.builderError.set('');
  }

  updateBuilderWeightPercent(questionId: number, value: number): void {
    this.builderQuestions.update(qs => qs.map(q => q.id === questionId ? { ...q, weightPercent: Number(value) } : q));
    this.builderError.set('');
  }

  removeBuilderQuestion(questionId: number): void {
    this.builderQuestions.update(qs => qs.filter(q => q.id !== questionId));
  }

  updateBuilderQuestionText(questionId: number, value: string): void {
    this.builderQuestions.update(qs => qs.map(q => q.id === questionId ? { ...q, name: value } : q));
  }

  updateBuilderQuestionRawText(questionId: number, value: string): void {
    this.builderQuestions.update(qs => qs.map(q => q.id === questionId ? { ...q, rawText: value } : q));
  }

  addBuilderOption(questionId: number): void {
    this.builderQuestions.update(qs => qs.map(q => {
      if (q.id !== questionId || q.options.length >= 6) return q;
      return { ...q, options: [...q.options, { id: this.nextOptionId(q), name: '' }] };
    }));
  }

  removeBuilderOption(questionId: number, optionId: number): void {
    this.builderQuestions.update(qs => qs.map(q => {
      if (q.id !== questionId || q.options.length <= 2) return q;
      return {
        ...q,
        options: q.options.filter(o => o.id !== optionId),
        correctOptionId: q.correctOptionId === optionId ? null : q.correctOptionId
      };
    }));
  }

  updateBuilderOptionText(questionId: number, optionId: number, value: string): void {
    this.builderQuestions.update(qs => qs.map(q => {
      if (q.id !== questionId) return q;
      return { ...q, options: q.options.map(o => o.id === optionId ? { ...o, name: value } : o) };
    }));
  }

  setBuilderCorrectOption(questionId: number, optionId: number): void {
    this.builderQuestions.update(qs => qs.map(q => q.id === questionId ? { ...q, correctOptionId: optionId } : q));
  }

  // ---- Saving ----------------------------------------------------------------

  async saveQuizBuilder(): Promise<void> {
    this.builderError.set('');
    const user = this.state.currentUser();
    if (!user) { this.builderError.set('Your session could not be resolved. Please re-login.'); return; }

    const name = this.builderName().trim();
    const subjectId = this.builderSubjectId();
    const questions = this.builderQuestions();

    if (!name) { this.builderError.set('Quiz name is required.'); return; }
    if (!subjectId) { this.builderError.set('Please select a subject.'); return; }
    if (questions.length === 0) { this.builderError.set('Add at least one question.'); return; }

    // Validate and build each question by type in one pass.
    const builtQuestions: TeacherQuizQuestion[] = [];
    for (const q of questions) {
      if (q.questionTypeId === QUESTION_TYPE.COMPLETE) {
        const parsed = parseCompleteAuthoredText(q.rawText.trim());
        if (isCompleteParseError(parsed)) {
          this.builderError.set(parsed.error === 'no-markers'
            ? 'Each Complete question needs at least one "(Complete)" marker.'
            : 'Each "(Complete)" marker must directly follow a word.');
          return;
        }
        builtQuestions.push({
          id: q.id,
          name: renderPreviewText(parsed.segments),
          questionTypeId: QUESTION_TYPE.COMPLETE,
          options: [],
          segments: parsed.segments,
          blanks: parsed.keywords.map((answer, index) => ({ index, answer })),
          duration: q.duration
        });
        continue;
      }

      if (q.questionTypeId === QUESTION_TYPE.RIGHT_WRONG) {
        const statement = q.name.trim();
        if (!statement) { this.builderError.set('Every Right or Wrong question needs a statement.'); return; }
        if (q.isRight === null) {
          this.builderError.set(`Mark "${statement}" as Right or Wrong.`);
          return;
        }
        // Stored as a two-option Choose question — see `right-wrong-question.ts`.
        const correctOptionId = rightWrongCorrectOptionId(q.isRight);
        builtQuestions.push({
          id: q.id,
          name: statement,
          questionTypeId: QUESTION_TYPE.RIGHT_WRONG,
          options: buildRightWrongOptions().map(o => ({ ...o, isAnswer: o.id === correctOptionId })),
          duration: q.duration
        });
        continue;
      }

      if (q.questionTypeId === QUESTION_TYPE.EXPLAIN) {
        const error = validateExplainAuthoring({
          subjectHtml: q.subjectHtml,
          referenceAnswer: q.referenceAnswer,
          weightPercent: q.weightPercent
        });
        if (error) {
          this.builderError.set(EXPLAIN_AUTHORING_MESSAGES[error]);
          return;
        }
        builtQuestions.push({
          id: q.id,
          // Plain flattening — `name` reaches list/search surfaces that print it raw.
          name: plainTextFromHtml(q.subjectHtml),
          questionTypeId: QUESTION_TYPE.EXPLAIN,
          options: [],
          subjectHtml: q.subjectHtml,
          referenceAnswer: q.referenceAnswer,
          weightPercent: q.weightPercent,
          duration: q.duration
        });
        continue;
      }

      if (!q.name.trim()) { this.builderError.set('Every question needs text.'); return; }
      const filledOptions = q.options.filter(o => o.name.trim());
      if (filledOptions.length < 2) { this.builderError.set(`"${q.name || 'A question'}" needs at least 2 answer options.`); return; }
      if (q.correctOptionId == null || !q.options.some(o => o.id === q.correctOptionId && o.name.trim())) {
        this.builderError.set(`Mark the correct answer for "${q.name || 'a question'}".`);
        return;
      }
      builtQuestions.push({
        id: q.id,
        name: q.name.trim(),
        questionTypeId: QUESTION_TYPE.CHOOSE,
        options: filledOptions.map(o => ({ id: o.id, name: o.name.trim(), isAnswer: o.id === q.correctOptionId })),
        duration: q.duration
      });
    }

    // Each built question matches its builder question by position. Tags of another subject (a question copied from
    // a quiz in another subject, or the subject changed since) are dropped rather than refused.
    const subjectTagIds = new Set(this.builderSubjectTags().map(tag => tag.id));
    builtQuestions.forEach((built, i) => built.tagIds = questions[i].tagIds.filter(id => subjectTagIds.has(id)));

    // Explain weights are authored per question but only make sense against the
    // whole quiz, so this check can only run once every question is built.
    const weightError = validateExplainWeights(builtQuestions);
    if (weightError) {
      this.builderError.set(weightError === 'over-100'
        ? 'The Explain questions in this quiz add up to more than 100% of the score. Lower their shares.'
        : 'The Explain questions already use the full 100%, leaving the other questions worth nothing. Lower their shares.');
      return;
    }

    const config: QuizConfig = {
      allowBack: this.builderAllowBack(),
      allowReview: this.builderAllowReview(),
      autoMove: this.builderAutoMove(),
      oneTimeJoin: this.builderOneTimeJoin(),
      duration: builtQuestions.reduce((total, q) => total + (q.duration ?? DEFAULT_QUESTION_DURATION_SECONDS), 0),
      pageSize: this.builderPageSize(),
      requiredAll: this.builderRequiredAll(),
      richText: this.builderRichText(),
      shuffleQuestions: this.builderShuffleQuestions(),
      shuffleOptions: this.builderShuffleOptions(),
      showClock: this.builderShowClock(),
      showPager: this.builderShowPager()
    };

    this.isSavingQuiz.set(true);
    try {
      const editingId = this.editingQuizId();
      if (editingId) {
        await this.teacherQuizService.update(editingId, {
          name,
          description: this.builderDescription().trim(),
          config,
          subjectId,
          stageId: this.builderStageId() || undefined,
          semester: this.builderSemester() || undefined,
          questions: builtQuestions
        });
        this.notification.success(`Quiz "${name}" updated.`);
      } else {
        await this.teacherQuizService.create({
          name,
          description: this.builderDescription().trim(),
          config,
          subjectId,
          stageId: this.builderStageId() || undefined,
          semester: this.builderSemester() || undefined,
          questions: builtQuestions,
          createdBy: user.id ?? ''                     // the API records the author itself; kept for the model
        });
        this.notification.success(`Quiz "${name}" created.`);
      }
      this.showQuizBuilder.set(false);
      await this.state.loadCustomQuizzes();
    } catch (error) {
      console.error('Failed to save custom quiz:', error);
      this.builderError.set('Failed to save the quiz. Please try again.');
    } finally {
      this.isSavingQuiz.set(false);
    }
  }

  async deleteCustomQuiz(quiz: TeacherQuiz): Promise<void> {
    const inUse = this.state.assignments().some(a => a.customQuizId === quiz.id);
    if (inUse) {
      this.notification.error('This quiz is used by an existing assignment. Remove that assignment first.');
      return;
    }
    if (!confirm(`Delete "${quiz.name}"? This cannot be undone.`)) return;
    try {
      await this.teacherQuizService.remove(quiz.id);
      this.notification.success('Quiz deleted.');
      await this.state.loadCustomQuizzes();
    } catch {
      this.notification.error('Failed to delete the quiz.');
    }
  }

  customQuizQuestionCount(quiz: TeacherQuiz): number {
    return quiz.questions?.length ?? 0;
  }

  /** True when this custom quiz backs at least one active assignment whose due date has passed. */
  isCustomQuizOverdue(quiz: TeacherQuiz): boolean {
    return this.state.assignments().some(a =>
      a.quizSource === 'custom' && a.customQuizId === quiz.id && a.active && this.state.isOverdue(a.dueAt)
    );
  }
}
