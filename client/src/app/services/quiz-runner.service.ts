import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Question, Quiz, QuizConfig, QuizAttemptLock, QuizExitReason,
  QUESTION_TYPE, DEFAULT_QUESTION_DURATION_SECONDS
} from '../models';
import { isQuestionAnswered, isQuizFullyAnswered, shuffleArray } from '../shared/quiz-runner';
import { summarizeExplainText } from '../shared/explain-question';
import { QuestionResponse, applyAnswerKey } from '../shared/grade-quiz';
import { AuthService } from './auth';
import { NotificationService } from './notification.service';
import { QuizService, SittingTarget } from './quiz.service';
import { QuizSubmissionService } from './quiz-submission.service';
import { ServiceError } from './shared/service-error';
import { QuizLockService, isBlocking } from './quiz/quiz-lock.service';
import { QuizLockdownService } from './quiz/quiz-lockdown.service';
import { QuizAttemptScope } from '../shared/quiz-attempt-scope';
import { QuestionTimer, formatTime } from './quiz/question-timer';
import { QuizElapsedTimer } from './quiz/quiz-elapsed-timer';
import { StartQuizOptions } from '../interfaces';

export type QuizRunnerMode = 'quiz' | 'review' | 'result';

/**
 * Owns the lifecycle of an actively running quiz: load, navigate, time, submit.
 * Components subscribe to the signals — they should not duplicate this logic.
 */
@Injectable({ providedIn: 'root' })
export class QuizRunnerService {
  private readonly quizService = inject(QuizService);
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);
  private readonly quizSubmission = inject(QuizSubmissionService);
  private readonly quizLock = inject(QuizLockService);
  private readonly lockdown = inject(QuizLockdownService);

  readonly currentQuiz = computed<Quiz | null>(() => this.quizService.currentQuiz());
  readonly questions = computed<Question[]>(() => this.currentQuiz()?.questions ?? []);
  readonly questionCount = computed(() => this.questions().length);

  /**
   * How many questions render together on one screen. Clamped to at least 1 —
   * an author-entered `0` or negative value would otherwise make every page
   * empty and the runner unable to advance.
   */
  readonly pageSize = computed(() => {
    const configured = this.currentQuiz()?.config?.pageSize;
    return Number.isFinite(configured) && (configured as number) > 0 ? Math.floor(configured as number) : 1;
  });

  /** Index of the first question on the current page. Always a multiple of {@link pageSize}. */
  readonly currentQuestionIndex = signal<number>(0);
  readonly currentPageQuestions = computed<Question[]>(() => {
    const start = this.currentQuestionIndex();
    return this.questions().slice(start, start + this.pageSize());
  });
  readonly isLastPage = computed(
    () => this.questionCount() > 0 && this.currentQuestionIndex() + this.pageSize() >= this.questionCount()
  );

  readonly allAnswered = computed(() => isQuizFullyAnswered(this.questions()));
  /** Index of the first unanswered question, or -1 if none. Drives the "jump to missed question" flow. */
  readonly firstUnansweredIndex = computed(() =>
    this.questions().findIndex(q => !isQuestionAnswered(q))
  );
  readonly reviewItems = computed(() =>
    this.questions().map((q, index) => ({
      index,
      name: q.name,
      selectedOptionText: this.answerSummary(q)
    }))
  );

  /** A short human-readable summary of the student's in-progress answer, per type, for the review list. */
  private answerSummary(question: Question): string | null {
    if (question.questionTypeId === QUESTION_TYPE.COMPLETE) {
      const filled = (question.blanks ?? [])
        .map(b => (b.userAnswer ?? '').trim())
        .filter(v => v.length > 0);
      return filled.length > 0 ? filled.join(', ') : null;
    }
    if (question.questionTypeId === QUESTION_TYPE.EXPLAIN) {
      // The review list is a compact one-liner — flatten the rich text and cap it.
      return summarizeExplainText(question.responseText) || null;
    }
    return question.options.find(o => o.userSelected)?.name ?? null;
  }

  readonly mode = signal<QuizRunnerMode>('quiz');
  readonly isLoading = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);

  /**
   * True while the open attempt is a "One Time Join" one and still in progress.
   *
   * Drops to false the moment the result screen appears, because containment
   * ends at submission — the student has to be able to leave a finished quiz.
   * The app shell reads {@link QuizLockdownService.isActive} rather than this,
   * so it needs no knowledge of the runner; this is the template-facing form
   * for the quiz page's own controls.
   */
  readonly isContained = computed(() =>
    !!this.currentQuiz()?.config?.oneTimeJoin && this.mode() !== 'result'
  );

  /**
   * The server-computed outcome of the most recent `submit()`, held for the
   * result screen. `score`/`correctCount` here are authoritative even when
   * `resultsAvailable` is `false` — only the per-question answer key is
   * withheld in that case, never the score itself — so the result screen uses
   * these instead of recomputing from the (possibly key-less) live questions.
   */
  readonly lastSubmissionSummary = signal<{
    scorePercent: number;
    correctCount: number;
    resultsAvailable: boolean;
    resultsAvailableAt: number | null;
  } | null>(null);

  /**
   * The current page's countdown (the sum of its questions' durations, one
   * question's worth when `pageSize` is 1). Owns the interval, the two labels
   * and the mm:ss formatting; this service only says when to start it and
   * what expiry means (see {@link onQuestionTimeExpired}).
   */
  private readonly questionTimer = new QuestionTimer(() => this.onQuestionTimeExpired());

  /** Seconds left on the current page's clock, formatted mm:ss; ticks down to 0. */
  readonly questionTimeRemaining = this.questionTimer.remaining;
  /** The current page's total allotted time, formatted mm:ss — the fixed half of "remaining / total". */
  readonly questionDurationLabel = this.questionTimer.durationLabel;

  /** Whole-quiz duration, formatted mm:ss — the sum of every question's own `duration`, not the current question's. */
  readonly totalDurationLabel = computed(() => {
    const totalSeconds = this.questions().reduce((sum, q) => sum + q.duration, 0);
    return formatTime(totalSeconds);
  });

  /**
   * How long the student has been in this attempt, formatted mm:ss — ticks up
   * for the whole run rather than resetting per question (see
   * {@link QuizElapsedTimer}). Paired with `totalDurationLabel` in the header
   * as "elapsed / total".
   */
  private readonly elapsedTimer = new QuizElapsedTimer();
  readonly quizElapsedLabel = this.elapsedTimer.elapsed;

  /** The current page's question range as "N" (pageSize 1) or "N-M" (pageSize &gt; 1), for the "Question …" label. */
  readonly pageQuestionLabel = computed(() => {
    const start = this.currentQuestionIndex() + 1;
    const end = Math.min(this.currentQuestionIndex() + this.pageSize(), this.questionCount());
    return start === end ? `${start}` : `${start}-${end}`;
  });
  readonly progressText = computed(() => {
    const total = this.questionCount();
    if (total <= 0) return 'Ready to start';
    return `Question ${this.pageQuestionLabel()} of ${total}`;
  });
  readonly progressWidth = computed(() => {
    const total = this.questionCount();
    if (total <= 0) return '0%';
    const end = Math.min(this.currentQuestionIndex() + this.pageSize(), total);
    const pct = (end / total) * 100;
    return `${Math.max(0, Math.min(100, pct))}%`;
  });

  private startTime: Date | null = null;
  private autoMoveHandle: ReturnType<typeof setTimeout> | null = null;
  /** What is being sat — the assignment when there is one, else the quiz — for the lock and the submission. */
  private activeTarget: SittingTarget | null = null;
  /**
   * The containment record for the open attempt, when it is a One Time Join
   * one. Held so an observed exit can be written without re-reading it — the
   * `beforeunload` path has no time to await a read.
   */
  private activeLock: QuizAttemptLock | null = null;

  /**
   * Set the moment a contained attempt is ended by the student leaving it —
   * app switch, tab switch, minimise, Back, close. Null at every other time.
   *
   * The runner cannot end the attempt itself: which quiz is open is the quiz
   * page's state, not this service's. So the breach is published and the page
   * reacts by returning the student to their quiz list. A fresh object every
   * time, so two exits in the same attempt are two notifications.
   */
  readonly containmentBreach = signal<{ reason: QuizExitReason; lock: QuizAttemptLock | null } | null>(null);

  /** Sit a bank quiz — or, with `options.homeworkId`, the assignment built on it. */
  async start(quizId: number, options: StartQuizOptions = {}): Promise<void> {
    await this.run(options.homeworkId ? { homeworkId: options.homeworkId } : { bankQuizId: quizId });
  }

  /** Like {@link start}, but for a teacher-authored quiz instead of the admin quiz bank. */
  async startCustom(customQuizId: string, options: StartQuizOptions = {}): Promise<void> {
    await this.run(options.homeworkId ? { homeworkId: options.homeworkId } : { teacherQuizId: customQuizId });
  }

  private async run(target: SittingTarget): Promise<void> {
    this.beginRun(target);
    this.isLoading.set(true);
    try {
      await this.quizService.loadSitting(target);
      this.afterQuizLoaded();
    } catch (error) {
      this.notificationService.error(error instanceof ServiceError ? error.message : 'Failed to load quiz. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }

  private beginRun(target: SittingTarget): void {
    this.activeTarget = target;
    this.currentQuestionIndex.set(0);
    this.mode.set('quiz');
    // A previous attempt's breach must not fire the quiz page's handler again
    // the instant a new quiz opens.
    this.containmentBreach.set(null);
  }

  /** Shared post-load step: apply config defaults/shuffles and start the timer. */
  private afterQuizLoaded(): void {
    const quiz = this.quizService.currentQuiz();
    if (!quiz) return;
    quiz.config = this.applyConfigDefaults(quiz.config);
    if (quiz.config.shuffleQuestions) {
      quiz.questions = shuffleArray(quiz.questions);
    }
    if (quiz.config.shuffleOptions) {
      // Right or Wrong is exempt: its two options are a fixed pair whose order
      // is part of the interaction, not an arbitrary list to randomize.
      quiz.questions.forEach(q => {
        if (q.questionTypeId === QUESTION_TYPE.RIGHT_WRONG) return;
        q.options = shuffleArray(q.options);
      });
    }
    this.startTime = new Date();
    this.elapsedTimer.start();
    this.startPageTimer();
    // Deliberately not awaited: the quiz is already on screen and the student
    // should not be made to wait on a write. The `in-progress` lock is what
    // blocks re-entry, and the entry check that precedes `start()` has already
    // proved there was no blocking lock a moment ago.
    void this.beginContainment(quiz.config);
  }

  /**
   * Open the containment record and install the browser guards, for a One Time
   * Join quiz only. Everything else runs exactly as it always has.
   */
  private async beginContainment(config: QuizConfig): Promise<void> {
    if (!config.oneTimeJoin) return;
    const user = this.authService.user();
    if (!user) return;

    // Guards first, write second. The shell hides its chrome off
    // `lockdown.isActive()`, so awaiting the write here would leave the sidebar
    // on screen — and the Back button live — for the length of a round trip,
    // right at the moment the student is most likely to be looking for a way
    // out.
    this.lockdown.activate(reason => this.onContainedExit(reason));

    const target = this.activeTarget;
    if (!target) return;
    try {
      this.activeLock = await this.quizLock.begin(target);
    } catch {
      // A lock that could not be written must not take the quiz down with it —
      // the student is already sitting it. They lose the containment guarantee
      // for this attempt, which is the milder of the two failures.
      this.activeLock = null;
    }
  }

  /**
   * The student was seen leaving a contained attempt. **The attempt ends here.**
   *
   * One exit is the whole allowance: minimising, switching app or tab, Back, or
   * closing all reach this, and all of them end the sitting. The guards come
   * down first so nothing counts a second exit on the way out — the student is
   * already locked, and a second `locked` write would only inflate the number
   * the teacher reads on the Participation screen.
   *
   * The exit report is best-effort: on the `beforeunload` path the browser
   * may tear the page down before it lands. That is survivable precisely
   * because the lock is already `in-progress` and already blocking — this write
   * only upgrades it to `locked`, so the teacher can see the attempt was
   * abandoned rather than merely unfinished.
   */
  private onContainedExit(reason: QuizExitReason): void {
    const lock = this.activeLock;
    this.lockdown.deactivate();

    const locked: QuizAttemptLock | null = lock
      ? {
          ...lock,
          status: 'locked',
          lockedAt: Date.now(),
          exitAttempts: (lock.exitAttempts ?? 0) + 1,
          lastExitReason: reason
        }
      : null;
    this.activeLock = locked;
    if (lock) void this.quizLock.recordExit(lock, reason).catch(() => undefined);

    // Published even when no lock was written: a lock that failed to save
    // still leaves a student who left mid-quiz, and the sitting is over
    // either way. Only the "ask your teacher" dialog needs the record.
    this.containmentBreach.set({ reason, lock: locked });
  }

  /**
   * Whether this student may open `scope` at all.
   *
   * Called by the quiz list *before* `start()`, so a blocked student never
   * loads the questions. Not a security boundary on its own — that is
   * `POST /attempt-locks`, which refuses to open a second sitting while one is
   * blocking, no matter what the client believes.
   */
  async findBlockingLock(scope: QuizAttemptScope): Promise<QuizAttemptLock | null> {
    try {
      const lock = await this.quizLock.findMine(scope);
      return isBlocking(lock) ? lock : null;
    } catch {
      // A failed read must not become a lockout: the authoritative check runs
      // again on the server when the attempt opens.
      return null;
    }
  }

  /** Navigates to the page containing question `index` — any index within a page snaps to that page's start. */
  goTo(index: number): void {
    if (index < 0 || index >= this.questionCount()) return;
    const size = this.pageSize();
    const pageStart = Math.floor(index / size) * size;
    this.cancelAutoMove();
    this.currentQuestionIndex.set(pageStart);
    this.mode.set('quiz');
    this.startPageTimer();
  }

  /**
   * On a `requiredAll` quiz, jumps past every already-answered question ahead
   * to the next one that isn't — not just the immediately-following page —
   * so a student routed to a gap by {@link requestSubmit}/{@link submit}
   * can't "Next" past it onto already-done work. Falls straight through to
   * the last page once nothing unanswered remains ahead, so Submit is always
   * reachable. Any other quiz keeps the plain next-page behavior.
   */
  next(): void {
    const quiz = this.currentQuiz();
    if (quiz?.config?.requiredAll) {
      this.goToNextUnanswered();
      return;
    }
    this.goTo(this.currentQuestionIndex() + this.pageSize());
  }

  private goToNextUnanswered(): void {
    const questions = this.questions();
    const searchStart = this.currentQuestionIndex() + this.pageSize();
    const nextGapIndex = questions.findIndex((q, i) => i >= searchStart && !isQuestionAnswered(q));
    this.goTo(nextGapIndex >= 0 ? nextGapIndex : questions.length - 1);
  }

  prev(): void {
    this.goTo(Math.max(0, this.currentQuestionIndex() - this.pageSize()));
  }

  /** True once every question on the current page has a usable answer. */
  private readonly currentPageFullyAnswered = computed(() =>
    this.currentPageQuestions().every(isQuestionAnswered)
  );

  /**
   * Schedules the autoMove advance once the whole page is answered — not
   * after any single question on it, so a multi-question page doesn't jump
   * away while sibling questions are still blank. Cancels any previously
   * pending one first — without this, a manual "Next" click right after
   * answering left a stale timeout alive that fired moments later and
   * advanced a second time.
   */
  onAnswerSelected(): void {
    this.cancelAutoMove();
    const quiz = this.currentQuiz();
    if (quiz?.config?.autoMove && this.currentPageFullyAnswered() && !this.isLastPage()) {
      this.autoMoveHandle = setTimeout(() => this.next(), 300);
    }
  }

  private cancelAutoMove(): void {
    if (this.autoMoveHandle) {
      clearTimeout(this.autoMoveHandle);
      this.autoMoveHandle = null;
    }
  }

  /** Entry point for the "Submit Quiz" button — routes through the review step when enabled. */
  requestSubmit(): void {
    const quiz = this.currentQuiz();
    if (quiz?.config?.requiredAll && !this.allAnswered() && this.goToFirstUnanswered()) {
      return;
    }
    if (quiz?.config?.allowReview) {
      this.stopQuestionTimer();
      // Not folded into `stopQuestionTimer()`: that method also runs from
      // `startPageTimer()` on every ordinary page change, where the elapsed
      // clock must keep running. It gets its own call at each of the three
      // points the attempt itself actually ends or is set aside — here, in
      // `submit()`, and in `reset()`.
      this.elapsedTimer.stop();
      this.mode.set('review');
      return;
    }
    this.submit();
  }

  /** Jumps to the first unanswered question and warns the user. Returns false if every question is answered. */
  private goToFirstUnanswered(): boolean {
    const index = this.firstUnansweredIndex();
    if (index < 0) return false;
    this.goTo(index);
    this.notificationService.warning(`Question ${index + 1} hasn't been answered yet.`);
    return true;
  }

  /** Jump back to a question from the review screen to change an answer. */
  reviewQuestion(index: number): void {
    this.goTo(index);
  }

  async submit(force = false): Promise<void> {
    if (this.isSubmitting()) return;
    const quiz = this.currentQuiz();
    const target = this.activeTarget;
    if (!quiz || !target) return;
    if (!force && quiz.config?.requiredAll && !this.allAnswered() && this.goToFirstUnanswered()) {
      return;
    }

    this.stopQuestionTimer();
    this.elapsedTimer.stop();
    this.isSubmitting.set(true);

    try {
      // Grading happens on the server. The client sends only what the student
      // did — never a score — and the answer key comes back with the result,
      // once the attempt is graded and recorded and it can no longer help them.
      const submission = await this.quizSubmission.submit({
        target,
        startedAt: this.startTime?.getTime() ?? Date.now(),
        responses: quiz.questions.map(q => this.buildResponse(q))
      });
      const { scorePercent, correctCount, resultsAvailable, resultsAvailableAt } = submission;

      // Fill the answer key back onto the live questions so the result screen
      // can show what was correct — the same fields it has always read. Empty
      // when `!resultsAvailable`, which leaves every question's key fields at
      // their zeroed load-time value.
      const keyByQuestion = new Map(submission.key.map(k => [k.questionId, k]));
      quiz.questions.forEach(question => {
        const key = keyByQuestion.get(question.id);
        if (key) applyAnswerKey(question, key);
      });
      this.quizService.touchCurrentQuiz();
      this.lastSubmissionSummary.set({ scorePercent, correctCount, resultsAvailable, resultsAvailableAt });

      // Containment ends here and only here on the happy path. The lock itself
      // was released by the server as it recorded the submission — a client
      // write could be withheld, so the release is not one. Dropping the
      // browser guards before `mode` flips to 'result' keeps the result screen
      // from being contained.
      this.lockdown.deactivate();
      this.activeLock = null;

      await this.authService.refreshUserData();
      void this.quizService.refresh().catch(() => undefined);   // "completed" marks on the quiz list

      // The parent and the reviewer are told by the server, as it records the submission.
      this.notificationService.success('Quiz completed successfully!');
      this.mode.set('result');
    } catch (error) {
      // Stay on the quiz rather than showing a result screen for an attempt
      // that was never recorded — previously `mode` flipped in `finally`, so a
      // failed submit still rendered as a completed one.
      if (error instanceof ServiceError && error.message.includes('All questions must be answered')) {
        // Reachable even though the client itself already blocks this: a
        // question's own timer expiring force-submits past that block (see
        // `onQuestionTimeExpired`), and the server enforces `requiredAll`
        // unconditionally. Route back to the gap exactly as a client-side
        // block would, rather than showing a bare "failed, try again" — and
        // resume (not restart) the elapsed clock this method stopped above,
        // since the attempt is continuing, not starting over.
        this.goToFirstUnanswered();
        this.elapsedTimer.resume();
        this.notificationService.warning('Time ran out with a required question still unanswered. Please finish it and submit again.');
      } else if (error instanceof ServiceError && /^4\d\d$/.test(error.code)) {
        // The server's own refusal ("You have already submitted this assignment."): worded for the student.
        this.notificationService.error(error.message);
      } else {
        this.notificationService.error('Failed to submit quiz. Please try again.');
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }

  reset(): void {
    this.stopQuestionTimer();
    this.elapsedTimer.stop();
    // Unconditional: a contained attempt torn down without a submission (the
    // student navigated away, the component was destroyed) must not leave a
    // `beforeunload` handler behind on every later page. The lock stays put —
    // that is the point of it.
    this.lockdown.deactivate();
    this.activeLock = null;
    this.currentQuestionIndex.set(0);
    this.mode.set('quiz');
    this.isSubmitting.set(false);
    this.isLoading.set(false);
    this.lastSubmissionSummary.set(null);
    this.activeTarget = null;
  }

  private applyConfigDefaults(existing: Partial<QuizConfig> | undefined): QuizConfig {
    return {
      allowBack: true,
      allowReview: true,
      autoMove: false,
      duration: 300,
      pageSize: 1,
      requiredAll: false,
      richText: false,
      shuffleQuestions: false,
      shuffleOptions: false,
      showClock: true,
      showPager: true,
      oneTimeJoin: false,
      ...(existing || {})
    };
  }

  /** Starts (or restarts) the current page's countdown — the sum of its questions' own `duration`s (each defaulting per {@link DEFAULT_QUESTION_DURATION_SECONDS}). */
  private startPageTimer(): void {
    this.stopQuestionTimer();
    const totalSeconds = this.currentPageQuestions()
      .reduce((sum, q) => sum + (q.duration ?? DEFAULT_QUESTION_DURATION_SECONDS), 0);
    this.questionTimer.start(totalSeconds || DEFAULT_QUESTION_DURATION_SECONDS);
  }

  /** Time's up on the current page: move on, or force-submit if it was the last one.
   *  Forced (bypasses requiredAll/allowReview) — reaching review shouldn't buy unlimited extra time. */
  private onQuestionTimeExpired(): void {
    if (this.isLastPage()) {
      this.submit(true);
    } else {
      this.next();
    }
  }

  /**
   * What the student did for one question — never a verdict, and never the
   * answer. The server decides correctness from its own copy of the key.
   */
  private buildResponse(q: Question): QuestionResponse {
    if (q.questionTypeId === QUESTION_TYPE.EXPLAIN) {
      return { questionId: q.id, responseText: q.responseText ?? null };
    }
    if (q.questionTypeId === QUESTION_TYPE.COMPLETE) {
      return {
        questionId: q.id,
        blanks: (q.blanks ?? []).map(b => ({ index: b.index, userAnswer: b.userAnswer ?? null }))
      };
    }
    return { questionId: q.id, selectedOptionId: q.options.find(o => o.userSelected)?.id ?? null };
  }

  /**
   * Halts the question clock *and* any pending auto-advance. The two are
   * cancelled together everywhere, because a countdown that has been stopped
   * must not leave a timeout behind that still moves the student on.
   */
  private stopQuestionTimer(): void {
    this.questionTimer.stop();
    this.cancelAutoMove();
  }
}
