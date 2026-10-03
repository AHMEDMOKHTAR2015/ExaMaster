/**
 * Weighted quiz scoring.
 *
 * Before the Explain type every question was worth the same, so a score was just
 * `correct / total`. Explain questions carry an authored share of the whole quiz
 * (`weightPercent`), which makes the split uneven: the Explain questions take
 * their declared percentages off the top and the auto-graded questions divide
 * whatever is left, equally.
 *
 * The math lives here, in one pure module, because two independent graders read
 * it — `QuizRunnerService.submit()` (which persists the result) and
 * `QuizResultComponent` (which displays it). They must never disagree.
 *
 * Backward compatibility: a quiz with no Explain questions yields exactly
 * `100 / questionCount` per question, which is the percentage math the app used
 * before this feature. That invariant is pinned by a test, and it survived
 * Complete becoming teacher-graded precisely because weighting keys off
 * {@link carriesAuthoredWeight}, not {@link requiresManualReview}.
 */

import { QUESTION_TYPE } from '../models/question';
import {
  DEFAULT_EXPLAIN_WEIGHT_PERCENT,
  MAX_EXPLAIN_WEIGHT_PERCENT,
  MIN_EXPLAIN_WEIGHT_PERCENT,
} from './explain-question';

/** The minimum a question needs for weighting: its id, type and authored weight. */
export interface WeightableQuestion {
  id: number;
  questionTypeId: number;
  weightPercent?: number;
}

export interface QuestionWeight {
  /** This question's share of the quiz, 0–100. Fractional; round only to display. */
  weightPercent: number;
  /** True when the question cannot be auto-graded and awaits a teacher's mark. */
  requiresReview: boolean;
}

export interface QuizWeighting {
  byQuestionId: Map<number, QuestionWeight>;
  /** Combined share held by Explain questions after normalization, 0–100. */
  explainTotalPercent: number;
  /** Share each auto-graded question carries. 0 when the quiz is all Explain. */
  autoPerQuestionPercent: number;
}

/**
 * Whether a question type is graded by a human rather than by the app.
 *
 * Explain has never been auto-gradable. Complete joined it because a blank
 * legitimately has more than one right answer — `normalizeCompleteAnswer` can
 * only compare against the single keyword the author typed, so a student who
 * writes a valid synonym is marked wrong by a grader that has no way to know
 * better. A human is the only thing that can.
 */
export function requiresManualReview(questionTypeId: number): boolean {
  return questionTypeId === QUESTION_TYPE.EXPLAIN
    || questionTypeId === QUESTION_TYPE.COMPLETE;
}

/**
 * Whether a question type claims an authored share of the quiz off the top,
 * rather than an equal slice of whatever is left.
 *
 * Deliberately NOT the same question as {@link requiresManualReview}, though
 * the two were one function until Complete became teacher-graded. Weighting and
 * grading are independent: Explain carries an authored `weightPercent` *and*
 * needs a human, while Complete needs a human but has no authored weight — it
 * is worth an ordinary equal share, exactly as it was when the app graded it
 * itself.
 *
 * Merging them again would give every Complete question
 * `DEFAULT_EXPLAIN_WEIGHT_PERCENT` off the top, so a quiz of five Complete
 * questions would over-subscribe itself and silently re-weight every other
 * question in it.
 */
export function carriesAuthoredWeight(questionTypeId: number): boolean {
  return questionTypeId === QUESTION_TYPE.EXPLAIN;
}

function clampWeight(weight: number | undefined): number {
  if (!Number.isFinite(weight as number)) return DEFAULT_EXPLAIN_WEIGHT_PERCENT;
  return Math.min(MAX_EXPLAIN_WEIGHT_PERCENT, Math.max(MIN_EXPLAIN_WEIGHT_PERCENT, weight as number));
}

/**
 * Resolve every question's share of a 100-point quiz.
 *
 * 1. Each Explain question claims its authored `weightPercent`, clamped to 1–100.
 * 2. If those claims total more than 100 they are scaled down proportionally —
 *    bank questions are authored independently of the quizzes they end up in, so
 *    an over-subscribed quiz is data the runtime must survive, not crash on.
 * 3. If the quiz is *entirely* Explain, the weights are scaled (up or down) to
 *    total exactly 100 so the quiz is still marked out of 100.
 * 4. Whatever budget is left is divided equally across the auto-graded questions.
 */
export function computeQuizWeighting(questions: WeightableQuestion[]): QuizWeighting {
  const byQuestionId = new Map<number, QuestionWeight>();
  if (questions.length === 0) {
    return { byQuestionId, explainTotalPercent: 0, autoPerQuestionPercent: 0 };
  }

  const explain = questions.filter(q => carriesAuthoredWeight(q.questionTypeId));
  const autoCount = questions.length - explain.length;

  const rawWeights = explain.map(q => clampWeight(q.weightPercent));
  const rawTotal = rawWeights.reduce((sum, w) => sum + w, 0);

  // Scale down an over-subscribed quiz; scale an all-Explain quiz to fill 100.
  let scale = 1;
  if (rawTotal > 100) {
    scale = 100 / rawTotal;
  } else if (autoCount === 0 && rawTotal > 0) {
    scale = 100 / rawTotal;
  }

  let explainTotalPercent = 0;
  explain.forEach((question, i) => {
    const weightPercent = rawWeights[i] * scale;
    explainTotalPercent += weightPercent;
    byQuestionId.set(question.id, { weightPercent, requiresReview: true });
  });

  const autoBudget = Math.max(0, 100 - explainTotalPercent);
  const autoPerQuestionPercent = autoCount > 0 ? autoBudget / autoCount : 0;

  for (const question of questions) {
    if (carriesAuthoredWeight(question.questionTypeId)) continue;
    // Shares the equal slice, but may still need a human verdict — a Complete
    // question is worth what it always was and is now marked by the teacher.
    byQuestionId.set(question.id, {
      weightPercent: autoPerQuestionPercent,
      requiresReview: requiresManualReview(question.questionTypeId)
    });
  }

  return { byQuestionId, explainTotalPercent, autoPerQuestionPercent };
}

/** Look up one question's share, falling back to 0 for an unknown id. */
export function weightOf(weighting: QuizWeighting, questionId: number): number {
  return weighting.byQuestionId.get(questionId)?.weightPercent ?? 0;
}

export type ExplainWeightError = 'over-100' | 'no-auto-budget';

/**
 * Save-time check for a quiz being assembled: reject weights the author almost
 * certainly did not intend, rather than silently normalizing them the way
 * {@link computeQuizWeighting} does at runtime.
 *
 * - `over-100`: the Explain weights alone exceed the whole quiz.
 * - `no-auto-budget`: they total exactly 100 while auto-graded questions are
 *   also present, which would leave those questions worth nothing.
 */
export function validateExplainWeights(questions: WeightableQuestion[]): ExplainWeightError | null {
  const explain = questions.filter(q => carriesAuthoredWeight(q.questionTypeId));
  if (explain.length === 0) return null;

  const total = explain.reduce((sum, q) => sum + clampWeight(q.weightPercent), 0);
  if (total > 100) return 'over-100';

  const autoCount = questions.length - explain.length;
  if (autoCount > 0 && total >= 100) return 'no-auto-budget';

  return null;
}

/** Sum the earned shares of a set of graded answers, ignoring ungraded ones. */
export function sumEarnedPercent(answers: { earnedPercent?: number | null }[]): number {
  return answers.reduce((sum, a) => sum + (a.earnedPercent ?? 0), 0);
}

/** Round a 0–100 share for display/persistence. */
export function roundPercent(value: number): number {
  return Math.round(value);
}

/** A submission's score: its graded shares added up, rounded, and never above 100. */
export function scorePercentOf(answers: { earnedPercent?: number | null }[]): number {
  return Math.min(100, roundPercent(sumEarnedPercent(answers)));
}

/**
 * The most points a teacher can give a reviewed answer: its share of the quiz
 * rounded, and at least 1 so even a tiny question can be credited. The server
 * (`QuizScoring.MaxMark`) converts the points back to the real share — 3/3 on a
 * 3.45% question earns 3.45% — so these are points, not percent.
 */
export function maxMark(weightPercent: number): number {
  return Math.max(1, roundPercent(weightPercent));
}

/** What `mark` points earn towards the score: that proportion of the real share (`QuizScoring.EarnedFromMark`). */
export function earnedFromMark(mark: number, weightPercent: number): number {
  return (weightPercent * mark) / maxMark(weightPercent);
}
