import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { Quiz, Question, CompleteBlank, CompleteSegment } from '../models';
import { QuizInfo } from '../interfaces';
import { MixinBase, ServiceStateMixin } from './shared/service-mixins';
import { AuthService } from './auth/auth.service';
import { ApiClient } from './api/api-client.service';
import { ApiBankQuizSummary, ApiSitting, ApiSittingQuestion, idString } from './api/api-models';
import { questionTypeId, toQuizConfig, toSegments, toSemester } from './api/question-mapping';

class QuizServiceBase implements MixinBase {}
const QuizServiceWithState = ServiceStateMixin(QuizServiceBase);

/** Which quiz a sitting is for: an assignment (whose quiz the server decides), or a quiz practised on its own. */
export type SittingTarget =
  | { homeworkId: string }
  | { bankQuizId: number }
  | { teacherQuizId: string };

/**
 * The bank quiz list, and the quiz being sat.
 *
 * The list comes from `GET /quizzes`, which already narrows it for a student
 * (open quizzes and their own stage's). It loads once per signed-in account and
 * again on {@link refresh}; it is no longer a live listener.
 *
 * A quiz is sat from its *sitting* (`GET …/sitting`), which carries no answer
 * data of any kind — the API's sitting types have nowhere to put one. The key
 * arrives only in the submission's response.
 */
@Injectable()
export class QuizService extends QuizServiceWithState {
  private readonly api = inject(ApiClient);
  private readonly authService = inject(AuthService);

  private readonly summaries = signal<ApiBankQuizSummary[] | null>(null);
  private loadedFor: string | null = null;
  private pendingLoad: Promise<void> | null = null;

  readonly quizList = computed<QuizInfo[]>(() => (this.summaries() ?? []).map(toQuizInfo));
  readonly currentQuiz = signal<Quiz | null>(null);

  constructor() {
    super();
    // One account's list must never show under the next: clear on every change of who is signed in.
    effect(() => this.syncAccount(), { allowSignalWrites: true });
  }

  /**
   * Follow who is signed in. Called by the effect AND at the start of every load: straight after sign-in the first
   * screen asks for the list before the effect has run, and a load tagged with the previous account (none) was then
   * cleared by the effect and its response dropped — the student's first visit showed no quizzes at all.
   */
  private syncAccount(): void {
    const uid = this.authService.isAuthenticated() ? this.authService.user()?.uid ?? null : null;
    if (uid !== this.loadedFor) {
      this.loadedFor = uid;
      this.pendingLoad = null;
      this.summaries.set(null);
    }
  }

  /** Resolves once the list has loaded for the signed-in account. */
  async loadAll(): Promise<void> {
    this.syncAccount();
    if (this.summaries()) return;
    this.pendingLoad ??= this.fetchList();
    return this.pendingLoad;
  }

  /** Load the list again (after a quiz is added, or a submission changes what is completed). */
  async refresh(): Promise<void> {
    this.syncAccount();
    this.pendingLoad = this.fetchList();
    return this.pendingLoad;
  }

  private async fetchList(): Promise<void> {
    const forAccount = this.loadedFor;
    try {
      const { quizzes } = await this.api.get<{ quizzes: ApiBankQuizSummary[] }>('/quizzes');
      if (forAccount === this.loadedFor) this.summaries.set([...quizzes].sort((a, b) => a.id - b.id));
    } catch (error) {
      this.pendingLoad = null;                            // let the next caller try again
      throw error;
    }
  }

  /** Load a quiz's sitting into {@link currentQuiz}. */
  async loadSitting(target: SittingTarget): Promise<void> {
    return this.executeWithState(async () => {
      const sitting = await this.api.get<ApiSitting>(sittingPath(target));
      this.currentQuiz.set(toQuiz(sitting));
    });
  }

  /**
   * Bump `currentQuiz`'s version after an in-place mutation to its nested
   * questions/options (answer selection, retake reset) so computed signals
   * derived from `questions` recompute on next read. Must shallow-copy the
   * `questions` array itself, not just the top-level Quiz object — a
   * top-level-only copy leaves `QuizRunnerService.questions()` returning the
   * same (Object.is-equal) array reference, which silently absorbs the
   * change and never notifies `allAnswered`/`firstUnansweredIndex`/`reviewItems`.
   */
  touchCurrentQuiz(): void {
    this.currentQuiz.update(q => q ? { ...q, questions: [...q.questions] } : q);
  }
}

function sittingPath(target: SittingTarget): string {
  if ('homeworkId' in target) return `/assignments/${target.homeworkId}/sitting`;
  if ('bankQuizId' in target) return `/quizzes/${target.bankQuizId}/sitting`;
  return `/teacher-quizzes/${target.teacherQuizId}/sitting`;
}

function toQuizInfo(quiz: ApiBankQuizSummary): QuizInfo {
  return {
    id: quiz.id,
    name: quiz.name,
    description: quiz.description,
    config: toQuizConfig(quiz.settings),
    questionCount: quiz.questionCount,
    stageId: idString(quiz.stageId),
    classId: idString(quiz.classId),
    subjectId: idString(quiz.subjectId),
    semester: toSemester(quiz.semester),
    reviewerId: idString(quiz.reviewerId),
    completedByMe: quiz.completedByMe
  };
}

function toQuiz(sitting: ApiSitting): Quiz {
  return {
    id: sitting.bankQuizId ?? 0,
    name: sitting.name,
    description: '',
    config: toQuizConfig(sitting.settings),
    questions: sitting.questions.map(toQuestion)
  };
}

// The answer fields exist on the app's Question and stay empty until the submission returns the key.
function toQuestion(question: ApiSittingQuestion): Question {
  const segments = question.segments.length > 0 ? toSegments(question.segments) : undefined;
  return {
    id: question.questionId,
    name: question.name,
    questionTypeId: questionTypeId(question.type),
    options: question.options.map(option => ({ id: option.id, name: option.name, isAnswer: false, userSelected: false })),
    segments,
    blanks: zeroedBlanks(segments),
    subjectHtml: question.subjectHtml ?? undefined,
    weightPercent: question.weightPercent ?? undefined,
    responseText: '',
    referenceAnswer: '',
    userAnsweredQuestion: false,
    duration: question.durationSeconds
  };
}

function zeroedBlanks(segments: CompleteSegment[] | undefined): CompleteBlank[] | undefined {
  return segments
    ?.filter((s): s is Extract<CompleteSegment, { kind: 'blank' }> => s.kind === 'blank')
    .map(s => ({ index: s.index, answer: '', userAnswer: '' }));
}
