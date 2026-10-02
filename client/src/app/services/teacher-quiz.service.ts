import { Injectable, inject } from '@angular/core';
import { TeacherQuiz, TeacherQuizQuestion, PagedResult, QUESTION_TYPE } from '../models';
import { ApiClient } from './api/api-client.service';
import { ApiTeacherQuiz, ApiTeacherQuizQuestion, ApiTeacherQuizSummary, idNumber, idNumbers, idString } from './api/api-models';
import { questionTypeId, toApiSemester, toDraft, toQuizConfig, toQuizSettings, toSegments, toSemester } from './api/question-mapping';
import { onePage } from './api/list-paging';
import { ServiceError } from './shared/service-error';

export type NewTeacherQuiz = Omit<TeacherQuiz, 'id' | 'createdAt'>;
export type TeacherQuizUpdate = Partial<Pick<TeacherQuiz, 'name' | 'description' | 'config' | 'subjectId' | 'stageId' | 'semester' | 'questions'>>;

/**
 * Teacher-authored quizzes, through the API (`/teacher-quizzes`).
 *
 * The answer key is part of the quiz there and only staff can read a quiz
 * whole, so the split into a second, student-proof collection is gone: the
 * API's own sitting endpoint is what a student gets (see QuizRunnerService).
 * `createdBy` is the author's API user id.
 */
@Injectable({ providedIn: 'root' })
export class TeacherQuizService {
  private readonly api = inject(ApiClient);

  /** One quiz, whole (with its answers): staff only. */
  async getById(id: string): Promise<TeacherQuiz | null> {
    try {
      return toTeacherQuiz((await this.api.get<{ quiz: ApiTeacherQuiz }>(`/teacher-quizzes/${id}`)).quiz);
    } catch (error) {
      if (error instanceof ServiceError && error.code === '404') return null;
      throw error;
    }
  }

  /** Every teacher's quizzes, for the application admin's overview: one page, without their questions. */
  async listAll(_pageSize?: number, _cursor?: string): Promise<PagedResult<TeacherQuiz>> {
    return onePage((await this.summaries(false)).map(toSummaryQuiz));
  }

  async countAll(): Promise<number> {
    return (await this.summaries(false)).length;
  }

  /** Returns the new quiz's id. */
  async create(input: NewTeacherQuiz): Promise<string> {
    return String((await this.api.post<{ id: number }>('/teacher-quizzes', body(input))).id);
  }

  /** The API replaces a quiz whole, so a partial update is merged onto the stored quiz first. */
  async update(id: string, patch: TeacherQuizUpdate): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) throw new Error(`Teacher quiz ${id} not found`);
    await this.api.put(`/teacher-quizzes/${id}`, body({ ...existing, ...patch }));
  }

  async remove(id: string): Promise<void> {
    await this.api.delete(`/teacher-quizzes/${id}`);
  }

  /**
   * The signed-in teacher's own quizzes, newest first, with their answers — the
   * authoring editor shows what they marked correct. The API knows who is
   * asking, so no author id is passed.
   */
  async listByCreator(): Promise<TeacherQuiz[]> {
    const mine = await this.summaries(true);
    const quizzes = await Promise.all(mine.map(summary => this.getById(String(summary.id))));
    return quizzes.filter((quiz): quiz is TeacherQuiz => quiz !== null).sort((a, b) => b.createdAt - a.createdAt);
  }

  /** How many questions every teacher's quizzes in this subject hold together (each quiz owns its own questions). */
  async countQuestionsInSubject(subjectId: string): Promise<number> {
    const { quizzes } = await this.api.get<{ quizzes: ApiTeacherQuizSummary[] }>('/teacher-quizzes', { subjectId });
    return quizzes.reduce((total, quiz) => total + quiz.questionCount, 0);
  }

  private async summaries(mine: boolean): Promise<ApiTeacherQuizSummary[]> {
    return (await this.api.get<{ quizzes: ApiTeacherQuizSummary[] }>('/teacher-quizzes', mine ? { mine: true } : {})).quizzes;
  }
}

function toTeacherQuiz(quiz: ApiTeacherQuiz): TeacherQuiz {
  return {
    id: String(quiz.id),
    name: quiz.name,
    description: quiz.description,
    config: toQuizConfig(quiz.settings),
    subjectId: String(quiz.subjectId),
    stageId: idString(quiz.stageId),
    semester: toSemester(quiz.semester),
    createdBy: String(quiz.createdById),
    createdAt: new Date(quiz.createdOn).getTime(),
    questions: [...quiz.questions].sort((a, b) => a.number - b.number).map(toQuestion)
  };
}

// A list entry: the overview shows names and counts, never the questions.
function toSummaryQuiz(quiz: ApiTeacherQuizSummary): TeacherQuiz {
  return {
    id: String(quiz.id),
    name: quiz.name,
    description: quiz.description,
    config: toQuizConfig(DEFAULT_SETTINGS),
    subjectId: String(quiz.subjectId),
    stageId: idString(quiz.stageId),
    semester: toSemester(quiz.semester),
    createdBy: String(quiz.createdById),
    createdAt: new Date(quiz.createdOn).getTime(),
    questions: [],
    questionCount: quiz.questionCount
  };
}

const DEFAULT_SETTINGS = toQuizSettings({});

// The app kept a teacher question's answer on the question (options[].isAnswer, blanks[].answer, referenceAnswer).
function toQuestion(question: ApiTeacherQuizQuestion): TeacherQuizQuestion {
  const key = question.key;
  return {
    id: question.number,
    name: question.name,
    questionTypeId: questionTypeId(question.type),
    options: question.options.map(option => ({ id: option.id, name: option.name, isAnswer: option.id === key.correctOptionId })),
    segments: question.segments.length > 0 ? toSegments(question.segments) : undefined,
    blanks: question.type === 'Complete' ? (key.correctBlanks ?? []).map((answer, index) => ({ index, answer })) : undefined,
    subjectHtml: question.subjectHtml ?? undefined,
    referenceAnswer: key.referenceAnswer ?? undefined,
    weightPercent: question.weightPercent ?? undefined,
    duration: question.durationSeconds ?? undefined,
    tagIds: (question.tagIds ?? []).map(String)
  };
}

function body(quiz: NewTeacherQuiz) {
  return {
    name: quiz.name,
    description: quiz.description ?? '',
    settings: toQuizSettings(quiz.config),
    subjectId: idNumber(quiz.subjectId),
    stageId: idNumber(quiz.stageId),
    semester: toApiSemester(quiz.semester),
    questions: (quiz.questions ?? []).map(question => ({ ...toDraft({
      questionTypeId: question.questionTypeId,
      name: question.name,
      options: question.options ?? [],
      segments: question.segments,
      subjectHtml: question.subjectHtml,
      weightPercent: question.weightPercent,
      duration: question.duration,
      correctOptionId: question.questionTypeId === QUESTION_TYPE.COMPLETE ? null : (question.options ?? []).find(option => option.isAnswer)?.id ?? null,
      correctBlanks: [...(question.blanks ?? [])].sort((a, b) => a.index - b.index).map(blank => blank.answer),
      referenceAnswer: question.referenceAnswer ?? null
    }), tagIds: idNumbers(question.tagIds) }))
  };
}
