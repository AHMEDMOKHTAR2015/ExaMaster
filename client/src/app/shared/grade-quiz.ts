/**
 * Grading a submitted quiz.
 *
 * **The server grades** (QuizMaster.Domain/Grading in the backend): changing a
 * student's mark means changing it there. What the app uses from here is the
 * shape of a response and an answer key, `applyAnswerKey` (putting the key the
 * submission returns onto the questions) and `suggestedCompleteAward` (the
 * review screen's starting mark). `gradeQuiz` and `hydrateQuestion` remain as
 * the TypeScript statement of the same rules, used by the runner's specs.
 *
 * The runtime {@link Question} is the common currency. The browser builds it by
 * loading a quiz and recording what the student picked; the server builds the
 * same shape with {@link hydrateQuestion} from the stored question, the answer
 * key and the student's submitted response. Both then call {@link gradeQuiz}.
 */

import {
  Question,
  ParticipationAnswer,
  ParticipationBlankAnswer,
  QUESTION_TYPE
} from '../models';
import { normalizeCompleteAnswer } from './complete-question';
import { plainTextFromHtml } from './explain-question';
import {
  QuizWeighting,
  computeQuizWeighting,
  maxMark,
  scorePercentOf,
  weightOf
} from './question-scoring';

/** The answer key for one question, as stored and as returned to the client after submit. */
export interface QuestionAnswerKey {
  questionId: number;
  /** Choose / Right-or-Wrong. */
  correctOptionId: number | null;
  /** Complete — indexed by `CompleteBlank.index`, not by array position. */
  correctBlanks: string[] | null;
  /** Explain — the model answer, as rich HTML. */
  referenceAnswer: string | null;
}

/** What one student submitted for one question. Carries no verdict — the server decides that. */
export interface QuestionResponse {
  questionId: number;
  /** Choose / Right-or-Wrong. */
  selectedOptionId?: number | null;
  /** Complete. */
  blanks?: { index: number; userAnswer: string | null }[];
  /** Explain — rich HTML. */
  responseText?: string | null;
}

/** Everything an attempt resolves to, ready to persist. */
export interface QuizGrade {
  answers: ParticipationAnswer[];
  /** Raw count of correct auto-graded questions — NOT a percentage. */
  score: number;
  /** Weighted 0–100. */
  scorePercent: number;
  correctCount: number;
  wrongCount: number;
  pendingReviewCount: number;
}

/**
 * One question's submitted-vs-correct breakdown, persisted on the participation
 * record so teachers and admins can review the attempt later.
 *
 * Reads the answer key off the question itself (`option.isAnswer`,
 * `blank.answer`, `referenceAnswer`) — those are blank while the quiz is being
 * taken and are filled in only at submit, which is what keeps the key out of the
 * browser beforehand.
 */
export function buildAnswerDetail(q: Question, weighting: QuizWeighting): ParticipationAnswer {
  const weightPercent = weightOf(weighting, q.id);

  if (q.questionTypeId === QUESTION_TYPE.EXPLAIN) {
    const responseText = q.responseText ?? '';
    return {
      questionId: q.id,
      // Always plain text here — this string is printed raw by review lists.
      questionName: plainTextFromHtml(q.subjectHtml) || q.name,
      selectedOptionId: null,
      selectedOptionText: null,
      correctOptionId: null,
      correctOptionText: null,
      isCorrect: false,
      responseText: responseText || null,
      referenceAnswer: q.referenceAnswer ?? null,
      weightPercent,
      earnedPercent: null,
      requiresReview: true
    };
  }

  if (q.questionTypeId === QUESTION_TYPE.COMPLETE) {
    // The per-blank exact match is still computed and still persisted — it is
    // just no longer the verdict. A blank can have more than one right answer
    // and the author only ever typed one, so this is a *suggestion* for the
    // teacher (see `suggestedCompleteAward`), not a mark. `isCorrect` and
    // `earnedPercent` stay unawarded until a human says otherwise, exactly as
    // an Explain answer does.
    const blanks: ParticipationBlankAnswer[] = (q.blanks ?? []).map(b => ({
      index: b.index,
      userAnswer: (b.userAnswer ?? '').trim() || null,
      correctAnswer: b.answer,
      isCorrect: normalizeCompleteAnswer(b.userAnswer) === normalizeCompleteAnswer(b.answer)
    }));
    return {
      questionId: q.id,
      questionName: q.name,
      selectedOptionId: null,
      selectedOptionText: null,
      correctOptionId: null,
      correctOptionText: null,
      isCorrect: false,
      blanks,
      weightPercent,
      earnedPercent: null,
      requiresReview: true
    };
  }

  // Choose and Right-or-Wrong share this branch — a Right-or-Wrong question is
  // stored as an ordinary two-option Choose question.
  const selected = q.options.find(o => o.userSelected);
  const correct = q.options.find(o => o.isAnswer);
  const isCorrect = !!(selected && correct && selected.id === correct.id);
  return {
    questionId: q.id,
    questionName: q.name,
    selectedOptionId: selected?.id ?? null,
    selectedOptionText: selected?.name ?? null,
    correctOptionId: correct?.id ?? null,
    correctOptionText: correct?.name ?? null,
    isCorrect,
    weightPercent,
    earnedPercent: isCorrect ? weightPercent : 0,
    requiresReview: false
  };
}

/**
 * What the exact-match grader *would* have awarded this Complete answer, as a
 * starting point for the teacher's mark.
 *
 * Credit is per blank rather than all-or-nothing: a three-blank question with
 * two exact matches suggests two thirds of its points (`maxMark`), which is the
 * fairer opening position and the one a teacher most often only has to nudge.
 * They can set any value from 0 to the question's full points regardless — that
 * freedom is the entire point of routing these through review.
 *
 * Returns 0 for an answer with no blanks, and for anything that is not a
 * Complete answer, so callers can apply it unconditionally.
 */
export function suggestedCompleteAward(answer: ParticipationAnswer): number {
  const blanks = answer.blanks ?? [];
  if (blanks.length === 0) return 0;
  const matched = blanks.filter(b => b.isCorrect).length;
  return Math.round((maxMark(answer.weightPercent ?? 0) * matched) / blanks.length);
}

/**
 * Strip everything from a graded answer that would reveal the correct answer,
 * keeping only what the student legitimately gets to see immediately: their own
 * response, whether it was right, and its weight.
 *
 * Used by `submitQuiz` when returning results for a not-yet-finished homework
 * attempt — the response the student gets no longer carries `correctOptionId`,
 * `correctOptionText`, a Complete blank's `correctAnswer`, or `referenceAnswer`.
 * What survives is a real verdict (`isCorrect`, `earnedPercent`), not a
 * placeholder — a checkmark on a wrong answer does not tell you what the right
 * one was, so withholding the detail costs the student nothing they are
 * entitled to yet.
 *
 * Never applied to what gets persisted: `ParticipationRecord.metadata.answers`
 * keeps the full detail always, because a teacher grading an Explain answer or
 * reviewing a submission needs it.
 */
export function redactAnswerDetail(answer: ParticipationAnswer): ParticipationAnswer {
  return {
    ...answer,
    correctOptionId: null,
    correctOptionText: null,
    referenceAnswer: null,
    blanks: answer.blanks?.map(b => ({ ...b, correctAnswer: '' }))
  };
}

/**
 * Grade a whole attempt.
 *
 * The weighting is resolved once and persisted per answer — a teacher grading a
 * reviewed answer later must mark it against the weighting this attempt actually
 * had, not a re-derived one.
 */
export function gradeQuiz(questions: Question[]): QuizGrade {
  const weighting = computeQuizWeighting(questions);
  const answers = questions.map(q => buildAnswerDetail(q, weighting));

  // Auto-graded questions only: an answer awaiting review has no verdict yet,
  // and counting it as wrong here would misreport a pending answer as a
  // failure. Complete questions joined Explain in that set, so a quiz made
  // entirely of them reports 0 correct / 0 wrong until it is marked — which is
  // honest, where "0 correct, 11 wrong" would not be.
  const autoGraded = answers.filter(a => !a.requiresReview);
  const score = autoGraded.filter(a => a.isCorrect).length;

  return {
    answers,
    score,
    scorePercent: scorePercentOf(answers),
    correctCount: score,
    wrongCount: autoGraded.length - score,
    pendingReviewCount: answers.filter(a => a.requiresReview && !a.manualGrade).length
  };
}

/**
 * Apply an answer key to a question, in place.
 *
 * Shared by the browser (after submit, to render the result screen) and the
 * server (before grading). `correctBlanks` arrives positionally but is applied
 * by `blank.index`, which is the safe reading when a Complete question's blank
 * indices are not contiguous.
 */
export function applyAnswerKey(question: Question, key: QuestionAnswerKey): void {
  question.options.forEach(opt => {
    opt.isAnswer = opt.id === key.correctOptionId;
  });

  if (question.questionTypeId === QUESTION_TYPE.COMPLETE && question.blanks) {
    const correctBlanks = key.correctBlanks ?? [];
    question.blanks.forEach(blank => {
      blank.answer = correctBlanks[blank.index] ?? '';
    });
  }

  if (question.questionTypeId === QUESTION_TYPE.EXPLAIN) {
    question.referenceAnswer = key.referenceAnswer ?? '';
  }
}

/**
 * Build the runtime {@link Question} the grader expects, server-side.
 *
 * `stored` is the question as persisted (no answer data of any kind), `key` is
 * its answer, and `response` is what the student submitted. Assembling them here
 * — rather than grading from a bespoke server-side shape — is what lets the
 * server run the exact same {@link gradeQuiz} the browser used to.
 *
 * A missing `response` grades as unanswered rather than throwing: a student can
 * legitimately submit having skipped a question whenever `requiredAll` is off.
 */
export function hydrateQuestion(
  stored: Pick<Question, 'id' | 'name' | 'questionTypeId' | 'options' | 'segments' | 'subjectHtml' | 'weightPercent' | 'duration'>,
  key: QuestionAnswerKey,
  response: QuestionResponse | undefined
): Question {
  const userAnswerByIndex = new Map(
    (response?.blanks ?? []).map(b => [b.index, b.userAnswer])
  );

  const question: Question = {
    ...stored,
    options: (stored.options ?? []).map(opt => ({
      ...opt,
      isAnswer: false,
      userSelected: opt.id === response?.selectedOptionId
    })),
    // Blanks are derived from the (masked) segments, exactly as the browser
    // derives them when it loads a quiz.
    blanks: (stored.segments ?? [])
      .filter((s): s is Extract<typeof s, { kind: 'blank' }> => s.kind === 'blank')
      .map(s => ({
        index: s.index,
        answer: '',
        userAnswer: userAnswerByIndex.get(s.index) ?? ''
      })),
    responseText: response?.responseText ?? '',
    referenceAnswer: '',
    userAnsweredQuestion: false
  };

  applyAnswerKey(question, key);
  return question;
}
