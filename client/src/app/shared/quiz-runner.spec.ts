import { Question, QUESTION_TYPE, DEFAULT_QUESTION_DURATION_SECONDS } from '../models';
import { isQuestionAnswered, isQuizFullyAnswered, shuffleArray } from './quiz-runner';
import { RIGHT_WRONG_OPTION, buildRightWrongOptions } from './right-wrong-question';

function makeQuestion(id: number, selectedOptionId: number | null): Question {
  return {
    id,
    name: `Q${id}`,
    questionTypeId: QUESTION_TYPE.CHOOSE,
    userAnsweredQuestion: false,
    duration: DEFAULT_QUESTION_DURATION_SECONDS,
    options: [1, 2, 3].map(optId => ({
      id: optId,
      name: `Option ${optId}`,
      isAnswer: false,
      userSelected: optId === selectedOptionId
    }))
  };
}

function makeCompleteQuestion(id: number, userAnswers: (string | undefined)[]): Question {
  return {
    id,
    name: `Q${id}`,
    questionTypeId: QUESTION_TYPE.COMPLETE,
    userAnsweredQuestion: false,
    duration: DEFAULT_QUESTION_DURATION_SECONDS,
    options: [],
    segments: [
      { kind: 'text', text: 'Fill ' },
      ...userAnswers.map((_, i) => ({ kind: 'blank' as const, index: i, expectedLength: 4 }))
    ],
    blanks: userAnswers.map((userAnswer, index) => ({ index, answer: 'x', userAnswer }))
  };
}

function makeRightWrongQuestion(id: number, selectedOptionId: number | null): Question {
  return {
    id,
    name: `Q${id}`,
    questionTypeId: QUESTION_TYPE.RIGHT_WRONG,
    userAnsweredQuestion: false,
    duration: DEFAULT_QUESTION_DURATION_SECONDS,
    options: buildRightWrongOptions().map(opt => ({
      ...opt,
      isAnswer: false,
      userSelected: opt.id === selectedOptionId
    }))
  };
}

function makeExplainQuestion(id: number, responseText: string | undefined): Question {
  return {
    id,
    name: `Q${id}`,
    questionTypeId: QUESTION_TYPE.EXPLAIN,
    userAnsweredQuestion: false,
    duration: DEFAULT_QUESTION_DURATION_SECONDS,
    options: [],
    subjectHtml: `<p>Q${id}</p>`,
    referenceAnswer: '',
    weightPercent: 20,
    responseText
  };
}

describe('shuffleArray', () => {
  it('returns a new array containing the same elements', () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffleArray(input);
    expect(result).not.toBe(input);
    expect(result.slice().sort()).toEqual(input.slice().sort());
  });

  it('does not mutate the input array', () => {
    const input = [1, 2, 3, 4, 5];
    const copy = [...input];
    shuffleArray(input);
    expect(input).toEqual(copy);
  });

  it('handles empty and single-element arrays', () => {
    expect(shuffleArray([])).toEqual([]);
    expect(shuffleArray([1])).toEqual([1]);
  });
});

describe('isQuestionAnswered', () => {
  it('Choose: true only when an option is selected', () => {
    expect(isQuestionAnswered(makeQuestion(1, 2))).toBe(true);
    expect(isQuestionAnswered(makeQuestion(2, null))).toBe(false);
  });

  it('Complete: true only when every blank has a non-empty trimmed value', () => {
    expect(isQuestionAnswered(makeCompleteQuestion(1, ['Paris', 'blue']))).toBe(true);
    expect(isQuestionAnswered(makeCompleteQuestion(2, ['Paris', '']))).toBe(false);
    expect(isQuestionAnswered(makeCompleteQuestion(3, ['Paris', '   ']))).toBe(false);
    expect(isQuestionAnswered(makeCompleteQuestion(4, ['Paris', undefined]))).toBe(false);
  });

  it('Right or Wrong: true only when one of the two options is selected', () => {
    expect(isQuestionAnswered(makeRightWrongQuestion(1, RIGHT_WRONG_OPTION.RIGHT))).toBe(true);
    expect(isQuestionAnswered(makeRightWrongQuestion(2, RIGHT_WRONG_OPTION.WRONG))).toBe(true);
    expect(isQuestionAnswered(makeRightWrongQuestion(3, null))).toBe(false);
  });

  it('Explain: true only when the response has text once flattened', () => {
    expect(isQuestionAnswered(makeExplainQuestion(1, '<p>Because of chlorophyll.</p>'))).toBe(true);
    expect(isQuestionAnswered(makeExplainQuestion(2, '<p><br></p>'))).toBe(false);
    expect(isQuestionAnswered(makeExplainQuestion(3, '<p>   </p>'))).toBe(false);
    expect(isQuestionAnswered(makeExplainQuestion(4, undefined))).toBe(false);
  });
});

describe('isQuizFullyAnswered', () => {
  it('returns true when every question has an answer', () => {
    const questions = [makeQuestion(1, 1), makeQuestion(2, 3)];
    expect(isQuizFullyAnswered(questions)).toBe(true);
  });

  it('returns false when at least one question has no answer', () => {
    const questions = [makeQuestion(1, 1), makeQuestion(2, null)];
    expect(isQuizFullyAnswered(questions)).toBe(false);
  });

  it('handles a mix of Choose and Complete questions', () => {
    expect(isQuizFullyAnswered([
      makeQuestion(1, 2),
      makeCompleteQuestion(2, ['Paris', 'blue'])
    ])).toBe(true);
    expect(isQuizFullyAnswered([
      makeQuestion(1, 2),
      makeCompleteQuestion(2, ['Paris', ''])
    ])).toBe(false);
  });

  it('handles a quiz containing all four question types', () => {
    expect(isQuizFullyAnswered([
      makeQuestion(1, 2),
      makeCompleteQuestion(2, ['Paris']),
      makeRightWrongQuestion(3, RIGHT_WRONG_OPTION.RIGHT),
      makeExplainQuestion(4, '<p>An answer.</p>')
    ])).toBe(true);

    expect(isQuizFullyAnswered([
      makeQuestion(1, 2),
      makeCompleteQuestion(2, ['Paris']),
      makeRightWrongQuestion(3, RIGHT_WRONG_OPTION.RIGHT),
      makeExplainQuestion(4, '<p><br></p>')
    ])).toBe(false);
  });

  it('returns true for an empty question list (vacuously)', () => {
    expect(isQuizFullyAnswered([])).toBe(true);
  });
});
