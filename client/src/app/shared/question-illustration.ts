import { QUESTION_TYPE } from '../models';

/** The quiz header's picture when no question is on screen (loading, review, result). */
export const QUIZ_IN_PROGRESS_ILLUSTRATION = 'assets/illustrations/quiz-in-progress.svg';

/** Each question type's own picture, named after it in `assets/illustrations` (the spaces URL-encoded). */
const ILLUSTRATION_BY_TYPE: Record<number, string> = {
  [QUESTION_TYPE.CHOOSE]: 'assets/illustrations/Choose.svg',
  [QUESTION_TYPE.COMPLETE]: 'assets/illustrations/Complete.svg',
  [QUESTION_TYPE.RIGHT_WRONG]: 'assets/illustrations/Right%20or%20Wrong.svg',
  [QUESTION_TYPE.EXPLAIN]: 'assets/illustrations/Explain.svg'
};

/** The picture for a question type, or the generic quiz picture for none or an unknown type. */
export function questionIllustration(questionTypeId: number | null | undefined): string {
  return (questionTypeId != null && ILLUSTRATION_BY_TYPE[questionTypeId]) || QUIZ_IN_PROGRESS_ILLUSTRATION;
}
