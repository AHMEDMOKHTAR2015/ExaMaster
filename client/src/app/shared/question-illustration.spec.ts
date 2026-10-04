import { QUESTION_TYPE } from '../models';
import { QUIZ_IN_PROGRESS_ILLUSTRATION, questionIllustration } from './question-illustration';

describe('questionIllustration', () => {
  it('gives each question type its own picture', () => {
    expect(questionIllustration(QUESTION_TYPE.CHOOSE)).toBe('assets/illustrations/Choose.svg');
    expect(questionIllustration(QUESTION_TYPE.COMPLETE)).toBe('assets/illustrations/Complete.svg');
    expect(questionIllustration(QUESTION_TYPE.EXPLAIN)).toBe('assets/illustrations/Explain.svg');
  });

  it('encodes the spaces in the Right or Wrong file name', () => {
    expect(questionIllustration(QUESTION_TYPE.RIGHT_WRONG)).toBe('assets/illustrations/Right%20or%20Wrong.svg');
  });

  it('falls back to the generic quiz picture when no question, or an unknown type, is on screen', () => {
    expect(questionIllustration(undefined)).toBe(QUIZ_IN_PROGRESS_ILLUSTRATION);
    expect(questionIllustration(null)).toBe(QUIZ_IN_PROGRESS_ILLUSTRATION);
    expect(questionIllustration(99)).toBe(QUIZ_IN_PROGRESS_ILLUSTRATION);
  });
});
