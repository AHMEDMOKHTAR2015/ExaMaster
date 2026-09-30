/**
 * Pure-function tests for the Right-or-Wrong helpers. No TestBed/DI — the logic
 * is static and deterministic (same approach as `complete-question.spec.ts`).
 */

import {
  RIGHT_WRONG_OPTION,
  buildRightWrongOptions,
  rightWrongCorrectOptionId,
  readRightWrongIsRight,
  rightWrongLabelKey,
} from './right-wrong-question';

describe('buildRightWrongOptions', () => {
  it('always produces the canonical Right-then-Wrong pair', () => {
    expect(buildRightWrongOptions()).toEqual([
      { id: RIGHT_WRONG_OPTION.RIGHT, name: 'Right' },
      { id: RIGHT_WRONG_OPTION.WRONG, name: 'Wrong' },
    ]);
  });

  it('returns a fresh array each call, so callers can mutate safely', () => {
    expect(buildRightWrongOptions()).not.toBe(buildRightWrongOptions());
  });
});

describe('rightWrongCorrectOptionId / readRightWrongIsRight', () => {
  it('round-trips both verdicts', () => {
    expect(readRightWrongIsRight(rightWrongCorrectOptionId(true))).toBe(true);
    expect(readRightWrongIsRight(rightWrongCorrectOptionId(false))).toBe(false);
  });

  it('maps the verdict to the canonical option ids', () => {
    expect(rightWrongCorrectOptionId(true)).toBe(RIGHT_WRONG_OPTION.RIGHT);
    expect(rightWrongCorrectOptionId(false)).toBe(RIGHT_WRONG_OPTION.WRONG);
  });

  it('reports "not chosen yet" rather than defaulting to Wrong', () => {
    expect(readRightWrongIsRight(null)).toBeNull();
    expect(readRightWrongIsRight(undefined)).toBeNull();
    expect(readRightWrongIsRight(99)).toBeNull();
  });
});

describe('rightWrongLabelKey', () => {
  it('returns the i18n key for each option', () => {
    expect(rightWrongLabelKey(RIGHT_WRONG_OPTION.RIGHT)).toBe('questionTypes.right');
    expect(rightWrongLabelKey(RIGHT_WRONG_OPTION.WRONG)).toBe('questionTypes.wrong');
  });
});
