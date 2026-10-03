import { Question, QUESTION_TYPE, DEFAULT_QUESTION_DURATION_SECONDS } from '../models';
import { computeQuizWeighting } from './question-scoring';
import {
  buildAnswerDetail, gradeQuiz, applyAnswerKey, hydrateQuestion, redactAnswerDetail,
  suggestedCompleteAward
} from './grade-quiz';

/**
 * Grading was previously inlined in `QuizRunnerService` and covered only
 * transitively, through a notification test. It now runs unchanged in Cloud
 * Functions as well, so a regression here silently changes real marks — hence
 * direct coverage of every branch.
 */

function chooseQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 1,
    name: 'Pick one',
    questionTypeId: QUESTION_TYPE.CHOOSE,
    options: [
      { id: 1, name: 'A', isAnswer: false, userSelected: false },
      { id: 2, name: 'B', isAnswer: true, userSelected: false }
    ],
    userAnsweredQuestion: false,
    duration: DEFAULT_QUESTION_DURATION_SECONDS,
    ...overrides
  };
}

function completeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 2,
    name: 'The capital is ___',
    questionTypeId: QUESTION_TYPE.COMPLETE,
    options: [],
    segments: [
      { kind: 'text', text: 'The capital is ' },
      { kind: 'blank', index: 0, expectedLength: 5 }
    ],
    blanks: [{ index: 0, answer: 'Paris', userAnswer: '' }],
    userAnsweredQuestion: false,
    duration: DEFAULT_QUESTION_DURATION_SECONDS,
    ...overrides
  };
}

function explainQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 3,
    name: 'Explain photosynthesis.',
    questionTypeId: QUESTION_TYPE.EXPLAIN,
    options: [],
    subjectHtml: '<p>Explain <b>photosynthesis</b>.</p>',
    responseText: '',
    referenceAnswer: '<p>Plants convert light into chemical energy.</p>',
    weightPercent: 30,
    userAnsweredQuestion: false,
    duration: DEFAULT_QUESTION_DURATION_SECONDS,
    ...overrides
  };
}

const detailFor = (q: Question) => buildAnswerDetail(q, computeQuizWeighting([q]));

describe('buildAnswerDetail — Choose and Right or Wrong', () => {
  it('marks the selected correct option correct and awards its full weight', () => {
    const q = chooseQuestion();
    q.options[1].userSelected = true;

    const detail = detailFor(q);

    expect(detail.isCorrect).toBe(true);
    expect(detail.selectedOptionId).toBe(2);
    expect(detail.correctOptionId).toBe(2);
    expect(detail.earnedPercent).toBe(detail.weightPercent);
    expect(detail.requiresReview).toBe(false);
  });

  it('marks a wrong selection wrong and awards nothing, while recording both options', () => {
    const q = chooseQuestion();
    q.options[0].userSelected = true;

    const detail = detailFor(q);

    expect(detail.isCorrect).toBe(false);
    expect(detail.earnedPercent).toBe(0);
    // Both sides are persisted so the review popup can show "you picked A, the answer was B".
    expect(detail.selectedOptionText).toBe('A');
    expect(detail.correctOptionText).toBe('B');
  });

  it('treats an unanswered question as wrong rather than correct', () => {
    // Guards a real trap: an `every(selected === isAnswer)` style predicate
    // returns true for a question where nothing is selected and nothing is
    // marked correct. This branch compares ids instead.
    const detail = detailFor(chooseQuestion());

    expect(detail.isCorrect).toBe(false);
    expect(detail.selectedOptionId).toBeNull();
    expect(detail.earnedPercent).toBe(0);
  });

  it('grades Right or Wrong through the same branch as Choose', () => {
    const q = chooseQuestion({
      questionTypeId: QUESTION_TYPE.RIGHT_WRONG,
      options: [
        { id: 1, name: 'Right', isAnswer: true, userSelected: true },
        { id: 2, name: 'Wrong', isAnswer: false, userSelected: false }
      ]
    });

    const detail = detailFor(q);

    expect(detail.isCorrect).toBe(true);
    expect(detail.correctOptionText).toBe('Right');
    expect(detail.requiresReview).toBe(false);
  });
});

describe('buildAnswerDetail — Complete', () => {
  it('awaits a teacher rather than awarding itself, even on an exact match', () => {
    // The core of the change: a Complete answer carries NO verdict out of
    // grading. The exact match is recorded per blank as a hint, but
    // `isCorrect`/`earnedPercent` stay unawarded until a human marks it —
    // because the author typed one keyword and a blank can have several right
    // answers.
    const q = completeQuestion();
    q.blanks![0].userAnswer = '  pARiS ';

    const detail = detailFor(q);

    expect(detail.requiresReview).toBe(true);
    expect(detail.isCorrect).toBe(false);
    expect(detail.earnedPercent).toBeNull();
    // The match itself is still computed, and still normalizes case/whitespace.
    expect(detail.blanks![0].isCorrect).toBe(true);
    // The persisted value is trimmed but keeps the student's original casing.
    expect(detail.blanks![0].userAnswer).toBe('pARiS');
  });

  it('records each blank\'s match separately, for the teacher to mark from', () => {
    const q = completeQuestion({
      segments: [
        { kind: 'blank', index: 0, expectedLength: 5 },
        { kind: 'blank', index: 1, expectedLength: 6 }
      ],
      blanks: [
        { index: 0, answer: 'Paris', userAnswer: 'Paris' },
        { index: 1, answer: 'France', userAnswer: 'Germany' }
      ]
    });

    const detail = detailFor(q);

    expect(detail.requiresReview).toBe(true);
    expect(detail.earnedPercent).toBeNull();
    // Per-blank verdicts differ, which is what the grading editor shows.
    expect(detail.blanks!.map(b => b.isCorrect)).toEqual([true, false]);
  });

  it('suggests partial credit in proportion to the blanks that matched', () => {
    const q = completeQuestion({
      segments: [
        { kind: 'blank', index: 0, expectedLength: 5 },
        { kind: 'blank', index: 1, expectedLength: 6 }
      ],
      blanks: [
        { index: 0, answer: 'Paris', userAnswer: 'Paris' },
        { index: 1, answer: 'France', userAnswer: 'Germany' }
      ]
    });

    const detail = detailFor(q);

    // Sole question in the fixture quiz, so it is worth the whole 100; one of
    // two blanks matched, so the teacher's field opens at half.
    expect(suggestedCompleteAward(detail)).toBe(Math.round((detail.weightPercent ?? 0) / 2));

    // In a 40-question quiz the answer is worth 2.5% and marked out of 3 points:
    // half of 3 points, not half of 2.5% (which would open at a third).
    expect(suggestedCompleteAward({ ...detail, weightPercent: 2.5 })).toBe(2);
  });

  it('suggests nothing for an Explain answer, which has no match to go on', () => {
    const detail = detailFor(explainQuestion());
    expect(suggestedCompleteAward(detail)).toBe(0);
  });

  it('records an empty blank as null rather than an empty string', () => {
    const detail = detailFor(completeQuestion());

    expect(detail.blanks![0].userAnswer).toBeNull();
    expect(detail.isCorrect).toBe(false);
  });
});

describe('buildAnswerDetail — Explain', () => {
  it('defers the verdict and awards no percentage yet', () => {
    const q = explainQuestion({ responseText: '<p>Plants use sunlight.</p>' });

    const detail = detailFor(q);

    expect(detail.requiresReview).toBe(true);
    // `earnedPercent` is null, not 0 — `sumEarnedPercent` skips null, so a
    // pending answer does not drag the score down before a teacher marks it.
    expect(detail.earnedPercent).toBeNull();
    expect(detail.isCorrect).toBe(false);
    expect(detail.weightPercent).toBeGreaterThan(0);
  });

  it('flattens the prompt to plain text and carries the reference answer', () => {
    const detail = detailFor(explainQuestion());

    expect(detail.questionName).toBe('Explain photosynthesis.');
    expect(detail.referenceAnswer).toBe('<p>Plants convert light into chemical energy.</p>');
  });
});

describe('gradeQuiz', () => {
  it('counts only auto-graded questions towards correct and wrong', () => {
    const right = chooseQuestion({ id: 1 });
    right.options[1].userSelected = true;
    const wrong = chooseQuestion({ id: 2 });
    wrong.options[0].userSelected = true;
    const pending = explainQuestion({ id: 3, responseText: '<p>something</p>' });

    const grade = gradeQuiz([right, wrong, pending]);

    expect(grade.score).toBe(1);
    expect(grade.correctCount).toBe(1);
    // The Explain question is neither correct nor wrong — it is unmarked.
    expect(grade.wrongCount).toBe(1);
    expect(grade.pendingReviewCount).toBe(1);
  });

  it('reports a score below 100 while an Explain answer is pending', () => {
    const right = chooseQuestion({ id: 1 });
    right.options[1].userSelected = true;
    const pending = explainQuestion({ id: 3, weightPercent: 40 });

    const grade = gradeQuiz([right, pending]);

    // 60% auto-graded budget earned in full; the pending 40% is not yet awarded.
    expect(grade.scorePercent).toBe(60);
  });

  it('sends Complete answers to review and keeps them out of correct/wrong', () => {
    const right = chooseQuestion({ id: 1 });
    right.options[1].userSelected = true;
    const complete = completeQuestion({ id: 2 });
    complete.blanks![0].userAnswer = 'Paris';

    const grade = gradeQuiz([right, complete]);

    // Only the Choose question has a verdict. Reporting the Complete one as
    // wrong would be the old, unfair behaviour; reporting it as correct would
    // pre-empt the teacher.
    expect(grade.correctCount).toBe(1);
    expect(grade.wrongCount).toBe(0);
    expect(grade.pendingReviewCount).toBe(1);
  });

  it('reports 0/0 on an all-Complete quiz rather than marking it all wrong', () => {
    // The scenario from the field: an eleven-question quiz of Complete blanks.
    // Before review, an unmatched synonym read as "0 correct, 11 wrong".
    const questions = [1, 2, 3].map(id => {
      const q = completeQuestion({ id });
      q.blanks = [{ index: 0, answer: 'Paris', userAnswer: 'paris' }];
      return q;
    });

    const grade = gradeQuiz(questions);

    expect(grade.correctCount).toBe(0);
    expect(grade.wrongCount).toBe(0);
    expect(grade.pendingReviewCount).toBe(3);
    // Nothing is awarded until the teacher marks it, so the score starts at 0
    // and rises as they grade — the same shape an all-Explain quiz has.
    expect(grade.scorePercent).toBe(0);
  });

  it('grades an empty quiz without throwing', () => {
    const grade = gradeQuiz([]);

    expect(grade.answers).toEqual([]);
    expect(grade.score).toBe(0);
    expect(grade.scorePercent).toBe(0);
    expect(grade.pendingReviewCount).toBe(0);
  });
});

describe('applyAnswerKey', () => {
  it('applies Complete blanks by index, not by array position', () => {
    // The regression this guards: blank indices need not be contiguous or
    // zero-based, and the key arrives as a positional array. Indexing by
    // position would put "France" on the blank expecting "Paris".
    const q = completeQuestion({
      blanks: [
        { index: 2, answer: '', userAnswer: '' },
        { index: 0, answer: '', userAnswer: '' }
      ]
    });

    applyAnswerKey(q, {
      questionId: q.id,
      correctOptionId: null,
      correctBlanks: ['Paris', 'unused', 'France'],
      referenceAnswer: null
    });

    expect(q.blanks!.find(b => b.index === 0)!.answer).toBe('Paris');
    expect(q.blanks!.find(b => b.index === 2)!.answer).toBe('France');
  });

  it('blanks a missing key rather than leaving stale text', () => {
    const q = completeQuestion();

    applyAnswerKey(q, { questionId: q.id, correctOptionId: null, correctBlanks: null, referenceAnswer: null });

    expect(q.blanks![0].answer).toBe('');
  });

  it('flags exactly the correct option and clears the rest', () => {
    const q = chooseQuestion();
    q.options[0].isAnswer = true;
    q.options[1].isAnswer = true;

    applyAnswerKey(q, { questionId: q.id, correctOptionId: 2, correctBlanks: null, referenceAnswer: null });

    expect(q.options.map(o => o.isAnswer)).toEqual([false, true]);
  });
});

describe('hydrateQuestion — server-side assembly', () => {
  it('rebuilds the runtime shape the grader expects from a stored question', () => {
    const stored = {
      id: 1,
      name: 'Pick one',
      questionTypeId: QUESTION_TYPE.CHOOSE,
      options: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }],
      duration: DEFAULT_QUESTION_DURATION_SECONDS
    } as Parameters<typeof hydrateQuestion>[0];

    const q = hydrateQuestion(
      stored,
      { questionId: 1, correctOptionId: 2, correctBlanks: null, referenceAnswer: null },
      { questionId: 1, selectedOptionId: 2 }
    );

    expect(detailFor(q).isCorrect).toBe(true);
  });

  it('derives Complete blanks from the masked segments and the student response', () => {
    const stored = {
      id: 2,
      name: 'The capital is ___',
      questionTypeId: QUESTION_TYPE.COMPLETE,
      options: [],
      segments: [
        { kind: 'text', text: 'The capital is ' },
        { kind: 'blank', index: 0, expectedLength: 5 }
      ],
      duration: DEFAULT_QUESTION_DURATION_SECONDS
    } as Parameters<typeof hydrateQuestion>[0];

    const q = hydrateQuestion(
      stored,
      { questionId: 2, correctOptionId: null, correctBlanks: ['Paris'], referenceAnswer: null },
      { questionId: 2, blanks: [{ index: 0, userAnswer: 'paris' }] }
    );

    // What is being pinned here is the *assembly*: the blank was derived from
    // the masked segment, the key was applied to it, and the student's response
    // landed on it. The verdict is a teacher's now, so the per-blank match is
    // what proves all three came together.
    const detail = detailFor(q);
    expect(detail.blanks!.map(b => b.isCorrect)).toEqual([true]);
    expect(detail.blanks![0].userAnswer).toBe('paris');
    expect(detail.blanks![0].correctAnswer).toBe('Paris');
    expect(detail.requiresReview).toBe(true);
  });

  it('grades a skipped question as unanswered instead of throwing', () => {
    // Legitimate whenever `requiredAll` is off — the client sends no response
    // for that question at all.
    const stored = {
      id: 1,
      name: 'Pick one',
      questionTypeId: QUESTION_TYPE.CHOOSE,
      options: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }],
      duration: DEFAULT_QUESTION_DURATION_SECONDS
    } as Parameters<typeof hydrateQuestion>[0];

    const q = hydrateQuestion(
      stored,
      { questionId: 1, correctOptionId: 2, correctBlanks: null, referenceAnswer: null },
      undefined
    );

    const detail = detailFor(q);
    expect(detail.selectedOptionId).toBeNull();
    expect(detail.isCorrect).toBe(false);
  });
});

describe('redactAnswerDetail', () => {
  it('strips every field that would reveal the correct answer', () => {
    const q = chooseQuestion();
    q.options[1].userSelected = true;
    const redacted = redactAnswerDetail(detailFor(q));

    expect(redacted.correctOptionId).toBeNull();
    expect(redacted.correctOptionText).toBeNull();
  });

  it('keeps the verdict and the student\'s own response intact', () => {
    // A checkmark on a wrong answer does not reveal what the right one was —
    // this is the whole reason withholding the detail is safe to do.
    const q = chooseQuestion();
    q.options[0].userSelected = true; // the wrong option
    const redacted = redactAnswerDetail(detailFor(q));

    expect(redacted.isCorrect).toBe(false);
    expect(redacted.selectedOptionId).toBe(1);
    expect(redacted.selectedOptionText).toBe('A');
    expect(redacted.weightPercent).toBeGreaterThan(0);
    expect(redacted.earnedPercent).toBe(0);
  });

  it('blanks a Complete question\'s correct keyword but keeps the per-blank verdict', () => {
    const q = completeQuestion();
    q.blanks![0].userAnswer = 'paris';
    const redacted = redactAnswerDetail(detailFor(q));

    expect(redacted.blanks![0].correctAnswer).toBe('');
    expect(redacted.blanks![0].isCorrect).toBe(true);
    expect(redacted.blanks![0].userAnswer).toBe('paris');
  });

  it('strips an Explain question\'s reference answer but keeps the student\'s response', () => {
    const q = explainQuestion({ responseText: '<p>Chlorophyll.</p>' });
    const redacted = redactAnswerDetail(detailFor(q));

    expect(redacted.referenceAnswer).toBeNull();
    expect(redacted.responseText).toBe('<p>Chlorophyll.</p>');
    expect(redacted.requiresReview).toBe(true);
  });
});
