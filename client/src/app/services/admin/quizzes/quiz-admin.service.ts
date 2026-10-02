import { Injectable, inject } from '@angular/core';
import { PagedResult } from '../../../models';
import { QuizAdminItem, QuizAdminPayload, QuestionAdminItem, AnswerItem, QuestionAnswerInput } from '../../../interfaces';
import { ApiClient } from '../../api/api-client.service';
import { ApiBankQuiz, ApiBankQuizSummary, ApiPage, ApiQuestion, idNumber, idNumbers, idString } from '../../api/api-models';
import { questionTypeId, toApiSemester, toDraft, toQuizConfig, toQuizSettings, toSegments, toSemester } from '../../api/question-mapping';
import { onePage } from '../../api/list-paging';
import { ServiceError } from '../../shared/service-error';

export type QuestionSemester = 'first' | 'second' | 'full';

/** Filters the questions bank pages by; omitted fields do not filter. */
export interface QuestionBankFilters {
  subjectId?: string;
  stageId?: string;
  gradeId?: string;
  tagId?: string;
}

const MAX_PAGE = 100;                                    // the API's page-size limit

/**
 * The question bank and bank quizzes, through the API (`/questions`, `/quizzes`).
 *
 * A question and its answer are one record there, written in one request, so
 * they cannot diverge and the answer is only ever sent to staff. Ids are
 * assigned by the server: creating returns the new id, and nothing is saved
 * under an id the screen made up.
 */
@Injectable({ providedIn: 'root' })
export class QuizAdminService {
  private readonly api = inject(ApiClient);

  // ---- bank quizzes ----

  /** Every bank quiz, by name; the API returns them all, so there is one page. */
  async listQuizzes(_pageSize = 10, _cursor?: string): Promise<PagedResult<QuizAdminItem>> {
    return onePage((await this.allQuizzes()).map(toQuizItem));
  }

  async countQuizzes(): Promise<number> {
    return (await this.allQuizzes()).length;
  }

  async getQuiz(quizId: number): Promise<QuizAdminItem | null> {
    const quiz = await this.fetchQuiz(quizId);
    return quiz ? toQuizItem(quiz) : null;
  }

  async getQuizWithConfig(quizId: number): Promise<QuizAdminPayload | null> {
    const quiz = await this.fetchQuiz(quizId);
    return quiz ? { ...toQuizItem(quiz), config: toQuizConfig(quiz.settings) as unknown as Record<string, unknown>, Question: quiz.questionIds } : null;
  }

  /** Returns the new quiz's id. */
  async createQuiz(payload: QuizAdminPayload): Promise<number> {
    return (await this.api.post<{ id: number }>('/quizzes', quizBody(payload))).id;
  }

  async updateQuiz(payload: QuizAdminPayload): Promise<void> {
    await this.api.put(`/quizzes/${payload.id}`, quizBody(payload));
  }

  async deleteQuiz(quizId: number): Promise<void> {
    await this.api.delete(`/quizzes/${quizId}`);
  }

  // ---- questions ----

  /** The whole bank, by id: for the quiz builder and the homework wizard, which filter it as the admin types. */
  async listQuestions(): Promise<QuestionAdminItem[]> {
    const questions: QuestionAdminItem[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.listQuestionsPage(MAX_PAGE, cursor);
      questions.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor);
    return questions.sort((a, b) => a.id - b.id);
  }

  /** One page of the bank, narrowed by any of subject / stage / grade; paged on the server (cursor = next page number). */
  async listQuestionsPage(pageSize = 20, cursor?: string, filters: QuestionBankFilters = {}): Promise<PagedResult<QuestionAdminItem>> {
    const page = cursor ? Number(cursor) : 1;
    const result = await this.searchQuestions(filters, page, pageSize);
    return {
      items: result.items.map(toQuestionItem),
      nextCursor: page * result.pageSize < result.totalCount ? String(page + 1) : undefined
    };
  }

  async countQuestions(filters: QuestionBankFilters = {}): Promise<number> {
    return (await this.searchQuestions(filters, 1, 1)).totalCount;
  }

  async getQuestion(id: number): Promise<QuestionAdminItem | null> {
    const question = await this.fetchQuestion(id);
    return question ? toQuestionItem(question) : null;
  }

  async getAnswer(questionId: number): Promise<AnswerItem | null> {
    const question = await this.fetchQuestion(questionId);
    return question ? { ...question.key } : null;
  }

  /** A new question with its answer, in one request. Returns the new question's id. */
  async createQuestion(question: QuestionAdminItem, answer: QuestionAnswerInput): Promise<number> {
    return (await this.api.post<{ id: number }>('/questions', questionBody(question, answer))).id;
  }

  async updateQuestion(question: QuestionAdminItem, answer: QuestionAnswerInput): Promise<void> {
    await this.api.put(`/questions/${question.id}`, questionBody(question, answer));
  }

  /** The bank's JSON upload: all of the questions, or (if any is invalid) none, with the first problem reported. */
  async bulkInsertQuestions(rows: { question: QuestionAdminItem; answer: QuestionAnswerInput }[]): Promise<void> {
    if (rows.length === 0) return;
    await this.api.post('/questions/bulk', { questions: rows.map(row => questionBody(row.question, row.answer)) });
  }

  /** Move questions to another subject / stage / grade / semester; only the fields given change. Returns how many. */
  async bulkUpdateQuestionFields(
    ids: number[],
    patch: { stageId?: string; gradeId?: string; subjectId?: string; semester?: QuestionSemester }
  ): Promise<number> {
    if (ids.length === 0) return 0;
    const { updatedCount } = await this.api.post<{ updatedCount: number }>('/questions:reclassify', {
      questionIds: [...new Set(ids)],
      subjectId: idNumber(patch.subjectId),
      stageId: idNumber(patch.stageId),
      gradeId: idNumber(patch.gradeId),
      semester: toApiSemester(patch.semester)
    });
    return updatedCount;
  }

  /**
   * Add and remove tags across many questions, keeping each one's other tags. The tags to add must all be of one
   * subject, and every question must be in it (the API refuses otherwise, saying which). Returns how many.
   */
  async retagQuestions(ids: number[], addTagIds: string[], removeTagIds: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const { updatedCount } = await this.api.post<{ updatedCount: number }>('/questions:retag', {
      questionIds: [...new Set(ids)],
      addTagIds: idNumbers(addTagIds),
      removeTagIds: idNumbers(removeTagIds)
    });
    return updatedCount;
  }

  async deleteQuestion(questionId: number): Promise<void> {
    await this.api.delete(`/questions/${questionId}`);
  }

  // ---- helpers ----

  private async allQuizzes(): Promise<ApiBankQuizSummary[]> {
    return (await this.api.get<{ quizzes: ApiBankQuizSummary[] }>('/quizzes')).quizzes;
  }

  private async fetchQuiz(id: number): Promise<ApiBankQuiz | null> {
    return this.orNull(async () => (await this.api.get<{ quiz: ApiBankQuiz }>(`/quizzes/${id}`)).quiz);
  }

  private async fetchQuestion(id: number): Promise<ApiQuestion | null> {
    return this.orNull(async () => (await this.api.get<{ question: ApiQuestion }>(`/questions/${id}`)).question);
  }

  private searchQuestions(filters: QuestionBankFilters, page: number, pageSize: number): Promise<ApiPage<ApiQuestion>> {
    return this.api.get<ApiPage<ApiQuestion>>('/questions', {
      subjectId: filters.subjectId, stageId: filters.stageId, gradeId: filters.gradeId, tagId: filters.tagId, page, pageSize: Math.min(pageSize, MAX_PAGE)
    });
  }

  private async orNull<T>(load: () => Promise<T>): Promise<T | null> {
    try {
      return await load();
    } catch (error) {
      if (error instanceof ServiceError && error.code === '404') return null;
      throw error;
    }
  }
}

function toQuizItem(quiz: ApiBankQuizSummary | ApiBankQuiz): QuizAdminItem {
  return {
    id: quiz.id,
    name: quiz.name,
    description: quiz.description,
    stageId: idString(quiz.stageId),
    gradeId: idString(quiz.gradeId),
    classId: idString(quiz.classId),
    subjectId: idString(quiz.subjectId),
    semester: toSemester(quiz.semester),
    reviewerId: idString(quiz.reviewerId)
  };
}

function quizBody(payload: QuizAdminPayload) {
  return {
    name: payload.name,
    description: payload.description ?? '',
    settings: toQuizSettings(payload.config),
    subjectId: idNumber(payload.subjectId),
    stageId: idNumber(payload.stageId),
    gradeId: idNumber(payload.gradeId),
    classId: idNumber(payload.classId),
    semester: toApiSemester(payload.semester),
    reviewerId: idNumber(payload.reviewerId),
    questionIds: payload.Question ?? []
  };
}

function toQuestionItem(question: ApiQuestion): QuestionAdminItem {
  return {
    id: question.id,
    name: question.name,
    questionTypeId: questionTypeId(question.type),
    options: question.options.map(option => ({ id: option.id, name: option.name })),
    segments: question.segments.length > 0 ? toSegments(question.segments) : undefined,
    subjectHtml: question.subjectHtml ?? undefined,
    weightPercent: question.weightPercent ?? undefined,
    duration: question.durationSeconds ?? undefined,
    subjectId: idString(question.subjectId),
    stageId: idString(question.stageId),
    gradeId: idString(question.gradeId),
    semester: toSemester(question.semester),
    tagIds: (question.tagIds ?? []).map(String)
  };
}

function questionBody(question: QuestionAdminItem, answer: QuestionAnswerInput) {
  return {
    ...toDraft({ ...question, correctOptionId: answer.correctOptionId, correctBlanks: answer.correctBlanks, referenceAnswer: answer.referenceAnswer }),
    subjectId: idNumber(question.subjectId),
    stageId: idNumber(question.stageId),
    gradeId: idNumber(question.gradeId),
    semester: toApiSemester(question.semester),
    tagIds: question.tagIds ? idNumbers(question.tagIds) : null
  };
}
