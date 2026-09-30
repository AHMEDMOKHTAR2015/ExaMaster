import { CompleteSegment, QUESTION_TYPE, QuizConfig } from '../../models';
import type { QuestionSemester } from '../admin/quizzes/quiz-admin.service';
import { reconstructAuthoredText } from '../../shared/complete-question';
import { RIGHT_WRONG_OPTION } from '../../shared/right-wrong-question';
import { ApiQuestionDraft, ApiQuestionType, ApiQuizSettings, ApiSegment, ApiSemester } from './api-models';

/**
 * The app's question and quiz shapes ⇄ the API's, in one place, for the bank
 * and for teachers' own quizzes alike.
 *
 * The one real difference is authoring. The app kept a question as its parts —
 * options with ids, a Complete passage already split into masked segments, the
 * answer key on the side. The API takes what the author typed (option texts,
 * the correct option's position, the passage with its "(Complete)" markers) and
 * parses and validates it itself, so the rules live in one place.
 */

const TYPE_ID: Record<ApiQuestionType, number> = {
  Choose: QUESTION_TYPE.CHOOSE, Complete: QUESTION_TYPE.COMPLETE, RightWrong: QUESTION_TYPE.RIGHT_WRONG, Explain: QUESTION_TYPE.EXPLAIN
};
const TYPE_NAME: Record<number, ApiQuestionType> = Object.fromEntries(Object.entries(TYPE_ID).map(([name, id]) => [id, name])) as Record<number, ApiQuestionType>;

export const questionTypeId = (type: ApiQuestionType): number => TYPE_ID[type];

export const toSemester = (semester: ApiSemester | null | undefined): QuestionSemester | undefined =>
  semester ? (semester.toLowerCase() as QuestionSemester) : undefined;
export const toApiSemester = (semester: string | null | undefined): ApiSemester | null =>
  semester === 'first' ? 'First' : semester === 'second' ? 'Second' : semester === 'full' ? 'Full' : null;

export const toSegments = (segments: ApiSegment[]): CompleteSegment[] =>
  segments.map(segment => segment.kind === 'Blank'
    ? { kind: 'blank', index: segment.index ?? 0, expectedLength: segment.expectedLength ?? 0 }
    : { kind: 'text', text: segment.text ?? '' });

// A question's own timer; the API accepts 5–3600 s, and leaves it out otherwise (the quiz's default applies).
const duration = (seconds: number | null | undefined): number | null =>
  seconds != null && seconds >= 5 && seconds <= 3600 ? seconds : null;

/** The parts the app authors a question from, whether a bank or a teacher-quiz question. */
export interface AuthoredParts {
  questionTypeId: number;
  name: string;
  options: { id: number; name: string }[];
  segments?: CompleteSegment[];
  subjectHtml?: string;
  weightPercent?: number;
  duration?: number;
  correctOptionId?: number | null;
  correctBlanks?: string[] | null;
  referenceAnswer?: string | null;
}

/** The question as its author typed it, which is what the API authors from. */
export function toDraft(parts: AuthoredParts): ApiQuestionDraft {
  const type = TYPE_NAME[parts.questionTypeId];
  const base: ApiQuestionDraft = {
    type, text: null, options: null, correctOption: null, isRight: null,
    subjectHtml: null, referenceAnswer: null, weightPercent: null, durationSeconds: duration(parts.duration)
  };
  switch (type) {
    case 'Choose': {
      const position = parts.options.findIndex(option => option.id === parts.correctOptionId);
      return { ...base, text: parts.name, options: parts.options.map(option => option.name), correctOption: position >= 0 ? position + 1 : null };
    }
    case 'RightWrong':
      return { ...base, text: parts.name, isRight: parts.correctOptionId === RIGHT_WRONG_OPTION.RIGHT };
    case 'Complete':
      return { ...base, text: reconstructAuthoredText(parts.segments ?? [], parts.correctBlanks ?? []) };
    default:
      return { ...base, subjectHtml: parts.subjectHtml ?? parts.name, referenceAnswer: parts.referenceAnswer ?? null, weightPercent: parts.weightPercent ?? null };
  }
}

export function toQuizConfig(settings: ApiQuizSettings): QuizConfig {
  return {
    allowBack: settings.allowBack, allowReview: settings.allowReview, autoMove: settings.autoMove, duration: settings.durationSeconds,
    pageSize: settings.pageSize, requiredAll: settings.requiredAll, richText: settings.richText, shuffleQuestions: settings.shuffleQuestions,
    shuffleOptions: settings.shuffleOptions, showClock: settings.showClock, showPager: settings.showPager, oneTimeJoin: settings.oneTimeJoin,
    ImagePath: settings.imagePath ?? undefined
  };
}

export function toQuizSettings(config: Partial<QuizConfig> | Record<string, unknown> | undefined): ApiQuizSettings {
  const c = (config ?? {}) as Partial<QuizConfig>;
  return {
    allowBack: c.allowBack ?? true, allowReview: c.allowReview ?? true, autoMove: c.autoMove ?? false,
    durationSeconds: Number(c.duration) || 0, pageSize: Number(c.pageSize) || 1, requiredAll: c.requiredAll ?? false,
    richText: c.richText ?? false, shuffleQuestions: c.shuffleQuestions ?? false, shuffleOptions: c.shuffleOptions ?? false,
    showClock: c.showClock ?? true, showPager: c.showPager ?? true, oneTimeJoin: c.oneTimeJoin ?? false,
    imagePath: c.ImagePath || null
  };
}
