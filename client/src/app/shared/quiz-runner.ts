import { Question, QUESTION_TYPE } from '../models';
import { hasExplainResponse } from './explain-question';

/** Fisher-Yates shuffle. Returns a new array; never mutates the input. */
export function shuffleArray<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * True when a question has a usable in-progress answer. Type-aware:
 * - Complete needs a non-empty (trimmed) value in *every* blank.
 * - Explain needs non-empty text once its rich HTML is flattened (an "empty"
 *   contenteditable still reports markup like `<p><br></p>`).
 * - Choose and Right-or-Wrong need a selected option.
 *
 * Must branch on type — Complete and Explain questions both carry an empty
 * `options` array, and `[].some(...)` is `false`, so the plain Choose check
 * would report them as permanently unanswered and block `requiredAll` submission.
 */
export function isQuestionAnswered(question: Question): boolean {
  if (question.questionTypeId === QUESTION_TYPE.COMPLETE) {
    const blanks = question.blanks ?? [];
    return blanks.length > 0 && blanks.every(b => (b.userAnswer ?? '').trim().length > 0);
  }
  if (question.questionTypeId === QUESTION_TYPE.EXPLAIN) {
    return hasExplainResponse(question.responseText);
  }
  return question.options.some(o => o.userSelected);
}

/** True when every question has a usable answer (vacuously true for an empty list). */
export function isQuizFullyAnswered(questions: Question[]): boolean {
  return questions.every(isQuestionAnswered);
}
