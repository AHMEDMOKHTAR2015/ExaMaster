/**
 * Pure-function tests for weighted quiz scoring. No TestBed/DI — the logic is
 * static and deterministic (same approach as `complete-question.spec.ts`).
 *
 * The first block is the regression guard for every pre-existing quiz: with no
 * Explain questions the weighting must reproduce the old `100 / n` math exactly.
 */

import { QUESTION_TYPE } from '../models';
import {
  WeightableQuestion,
  carriesAuthoredWeight,
  computeQuizWeighting,
  earnedFromMark,
  maxMark,
  requiresManualReview,
  roundPercent,
  scorePercentOf,
  sumEarnedPercent,
  validateExplainWeights,
  weightOf,
} from './question-scoring';

function auto(id: number, questionTypeId: number = QUESTION_TYPE.CHOOSE): WeightableQuestion {
  return { id, questionTypeId };
}

function explain(id: number, weightPercent?: number): WeightableQuestion {
  return { id, questionTypeId: QUESTION_TYPE.EXPLAIN, weightPercent };
}

describe('computeQuizWeighting — quizzes with no Explain questions', () => {
  it('splits 100 equally, matching the pre-weighting behaviour', () => {
    const weighting = computeQuizWeighting([auto(1), auto(2), auto(3), auto(4)]);
    expect(weighting.autoPerQuestionPercent).toBe(25);
    expect(weightOf(weighting, 1)).toBe(25);
    expect(weighting.explainTotalPercent).toBe(0);
  });

  it('handles the non-round case without losing the total', () => {
    const weighting = computeQuizWeighting([auto(1), auto(2), auto(3)]);
    const total = [1, 2, 3].reduce((sum, id) => sum + weightOf(weighting, id), 0);
    expect(total).toBeCloseTo(100, 10);
  });

  it('treats every auto-gradable type the same', () => {
    const weighting = computeQuizWeighting([
      auto(1, QUESTION_TYPE.CHOOSE),
      auto(2, QUESTION_TYPE.COMPLETE),
      auto(3, QUESTION_TYPE.RIGHT_WRONG),
    ]);
    expect(weightOf(weighting, 2)).toBeCloseTo(weightOf(weighting, 1), 10);
    expect(weightOf(weighting, 3)).toBeCloseTo(weightOf(weighting, 1), 10);
  });

  it('returns an empty weighting for an empty quiz', () => {
    const weighting = computeQuizWeighting([]);
    expect(weighting.byQuestionId.size).toBe(0);
    expect(weighting.autoPerQuestionPercent).toBe(0);
  });
});

describe('computeQuizWeighting — mixed quizzes', () => {
  it('gives Explain its authored share and splits the rest equally', () => {
    const weighting = computeQuizWeighting([auto(1), auto(2), auto(3), explain(4, 40)]);
    expect(weightOf(weighting, 4)).toBe(40);
    expect(weighting.autoPerQuestionPercent).toBeCloseTo(20, 10);
    expect(weightOf(weighting, 1)).toBeCloseTo(20, 10);
  });

  it('falls back to the default weight when none was authored', () => {
    const weighting = computeQuizWeighting([auto(1), explain(2)]);
    expect(weightOf(weighting, 2)).toBe(10);
    expect(weightOf(weighting, 1)).toBe(90);
  });

  it('scales an over-subscribed quiz down to 100 rather than exceeding it', () => {
    const weighting = computeQuizWeighting([auto(1), explain(2, 80), explain(3, 80)]);
    expect(weighting.explainTotalPercent).toBeCloseTo(100, 10);
    expect(weightOf(weighting, 2)).toBeCloseTo(50, 10);
    expect(weighting.autoPerQuestionPercent).toBeCloseTo(0, 10);
  });

  it('clamps an out-of-range authored weight before using it', () => {
    const weighting = computeQuizWeighting([auto(1), explain(2, 0), explain(3, 999)]);
    // 1 and 100 after clamping, then scaled by 100/101 to fit the quiz.
    expect(weighting.explainTotalPercent).toBeCloseTo(100, 10);
    expect(weightOf(weighting, 2)).toBeLessThan(weightOf(weighting, 3));
  });
});

describe('computeQuizWeighting — all-Explain quizzes', () => {
  it('scales the weights up to fill 100', () => {
    const weighting = computeQuizWeighting([explain(1, 10), explain(2, 10)]);
    expect(weightOf(weighting, 1)).toBeCloseTo(50, 10);
    expect(weightOf(weighting, 2)).toBeCloseTo(50, 10);
    expect(weighting.autoPerQuestionPercent).toBe(0);
  });

  it('preserves the authored ratio while scaling', () => {
    const weighting = computeQuizWeighting([explain(1, 30), explain(2, 10)]);
    expect(weightOf(weighting, 1)).toBeCloseTo(75, 10);
    expect(weightOf(weighting, 2)).toBeCloseTo(25, 10);
  });
});

describe('validateExplainWeights', () => {
  it('accepts a quiz with no Explain questions', () => {
    expect(validateExplainWeights([auto(1), auto(2)])).toBeNull();
  });

  it('accepts weights that leave budget for the auto-graded questions', () => {
    expect(validateExplainWeights([auto(1), explain(2, 60)])).toBeNull();
  });

  it('rejects Explain weights totalling more than the whole quiz', () => {
    expect(validateExplainWeights([auto(1), explain(2, 60), explain(3, 50)])).toBe('over-100');
  });

  it('rejects weights that would leave auto-graded questions worth nothing', () => {
    expect(validateExplainWeights([auto(1), explain(2, 100)])).toBe('no-auto-budget');
  });

  it('allows an all-Explain quiz to total 100', () => {
    expect(validateExplainWeights([explain(1, 50), explain(2, 50)])).toBeNull();
  });
});

describe('requiresManualReview', () => {
  it('covers the two types a human marks', () => {
    // Complete joined Explain: a blank can have several right answers and the
    // author only ever typed one, so exact matching cannot be the verdict.
    expect(requiresManualReview(QUESTION_TYPE.EXPLAIN)).toBe(true);
    expect(requiresManualReview(QUESTION_TYPE.COMPLETE)).toBe(true);
    expect(requiresManualReview(QUESTION_TYPE.CHOOSE)).toBe(false);
    expect(requiresManualReview(QUESTION_TYPE.RIGHT_WRONG)).toBe(false);
  });
});

describe('carriesAuthoredWeight', () => {
  it('is Explain only — needing review and claiming a weight are different questions', () => {
    // The distinction this pins is load-bearing. If Complete were treated as
    // carrying an authored weight, every Complete question would take
    // DEFAULT_EXPLAIN_WEIGHT_PERCENT off the top and silently re-weight the
    // rest of the quiz. It needs a human, but it is worth an ordinary share.
    expect(carriesAuthoredWeight(QUESTION_TYPE.EXPLAIN)).toBe(true);
    expect(carriesAuthoredWeight(QUESTION_TYPE.COMPLETE)).toBe(false);
    expect(carriesAuthoredWeight(QUESTION_TYPE.CHOOSE)).toBe(false);
    expect(carriesAuthoredWeight(QUESTION_TYPE.RIGHT_WRONG)).toBe(false);
  });

  it('leaves a Complete question worth exactly what it was before review', () => {
    // The regression this guards: four equally-weighted questions, one of them
    // Complete. Every one must still be worth 25.
    const weighting = computeQuizWeighting([
      { id: 1, questionTypeId: QUESTION_TYPE.CHOOSE },
      { id: 2, questionTypeId: QUESTION_TYPE.COMPLETE },
      { id: 3, questionTypeId: QUESTION_TYPE.RIGHT_WRONG },
      { id: 4, questionTypeId: QUESTION_TYPE.CHOOSE }
    ]);

    expect(weightOf(weighting, 1)).toBe(25);
    expect(weightOf(weighting, 2)).toBe(25);
    expect(weightOf(weighting, 3)).toBe(25);
    expect(weightOf(weighting, 4)).toBe(25);
    // ...and it is still flagged for a human.
    expect(weighting.byQuestionId.get(2)!.requiresReview).toBe(true);
  });

  it('does not let Complete questions eat the Explain weight budget', () => {
    // `validateExplainWeights` counts only authored weights. Were Complete
    // included, these three would be clamped to the default each and could
    // trip 'over-100' on a quiz whose author set nothing at all.
    expect(validateExplainWeights([
      { id: 1, questionTypeId: QUESTION_TYPE.COMPLETE },
      { id: 2, questionTypeId: QUESTION_TYPE.COMPLETE },
      { id: 3, questionTypeId: QUESTION_TYPE.COMPLETE }
    ])).toBeNull();
  });
});

describe('sumEarnedPercent', () => {
  it('adds graded shares and ignores ungraded ones', () => {
    expect(sumEarnedPercent([
      { earnedPercent: 20 },
      { earnedPercent: 0 },
      { earnedPercent: null },
      {}
    ])).toBe(20);
  });
});

describe('roundPercent', () => {
  it('rounds to the nearest whole percent', () => {
    expect(roundPercent(66.6)).toBe(67);
    expect(roundPercent(33.3)).toBe(33);
  });
});

// The same cases as the API's QuizScoringTests: a teacher's mark is points, worth
// its proportion of the question's real share (QuizScoring.MaxMark / EarnedFromMark).
describe('teacher marks', () => {
  it('are out of the share rounded, and at least one point', () => {
    expect(maxMark(40)).toBe(40);
    expect(maxMark(100 / 29)).toBe(3);
    expect(maxMark(2.5)).toBe(3);
    expect(maxMark(0.4)).toBe(1);
  });

  it('earn their proportion of the real share', () => {
    expect(earnedFromMark(3, 100 / 29)).toBeCloseTo(100 / 29, 9);
    expect(earnedFromMark(2, 100 / 29)).toBeCloseTo((100 / 29) * 2 / 3, 9);
    expect(earnedFromMark(0, 100 / 29)).toBe(0);
    expect(earnedFromMark(30, 40)).toBe(30);
  });

  it('give full marks a score of 100, however the shares round', () => {
    const fullMarks = (questionCount: number) =>
      Array.from({ length: questionCount }, () => ({ earnedPercent: earnedFromMark(maxMark(100 / questionCount), 100 / questionCount) }));

    expect(scorePercentOf(fullMarks(29))).toBe(100);   // points counted as percent gave 94
    expect(scorePercentOf(fullMarks(40))).toBe(100);   // ... and 112
  });

  it('never let a score exceed 100', () => {
    expect(scorePercentOf([{ earnedPercent: 60 }, { earnedPercent: 40.0000001 }, { earnedPercent: null }])).toBe(100);
  });
});
