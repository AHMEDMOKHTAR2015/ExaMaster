import { Option } from './option';

/**
 * Question type discriminator, stored on `questionTypeId`.
 * - `CHOOSE` — the original multiple-choice type (options + one correct option).
 * - `COMPLETE` — fill-in-the-blank (a passage with `(Complete)`-marked keywords
 *   rendered as inline textboxes).
 * - `RIGHT_WRONG` — true/false. Stored as a two-option Choose question with the
 *   canonical `Right`/`Wrong` pair, so every grading/review path reuses the
 *   Choose branch unchanged (see `shared/right-wrong-question.ts`).
 * - `EXPLAIN` — open response. Not auto-gradable: the student writes free rich
 *   text, the teacher marks it afterwards, and the question carries an authored
 *   share of the quiz score (see `shared/explain-question.ts`).
 *
 * `questionTypeId` stays a plain `number` on every model to avoid cast churn at
 * the Firestore mapping boundaries — these constants are the canonical values to
 * compare against.
 */
export const QUESTION_TYPE = {
    CHOOSE: 1,
    COMPLETE: 2,
    RIGHT_WRONG: 3,
    EXPLAIN: 4,
} as const;

/** Every `questionTypeId` the app knows how to author, render and grade. */
export const SUPPORTED_QUESTION_TYPE_IDS: readonly number[] = Object.values(QUESTION_TYPE);

/** Whether `typeId` is one of the four supported question types. */
export function isSupportedQuestionType(typeId: unknown): boolean {
    return typeof typeId === 'number' && SUPPORTED_QUESTION_TYPE_IDS.includes(typeId);
}

/** Per-question clock default (seconds) applied wherever an authored `duration` is unset. */
export const DEFAULT_QUESTION_DURATION_SECONDS = 60;

/**
 * One piece of a parsed Complete-question passage: either a run of static text
 * or a blank the student fills in. `expectedLength` is the correct keyword's
 * character count — it reveals length only (never content), used to size the
 * blank's textbox. Segments carry no answer text, so they are safe to expose to
 * the client before submission.
 */
export type CompleteSegment =
    | { kind: 'text'; text: string }
    | { kind: 'blank'; index: number; expectedLength: number };

/**
 * Runtime state for one blank in a Complete question. `answer` mirrors
 * `Option.isAnswer`: it is zeroed to '' in the live quiz object and only filled
 * with the correct keyword at submission time. `userAnswer` is what the student
 * typed.
 */
export interface CompleteBlank {
    index: number;
    answer: string;
    userAnswer?: string;
}

export interface Question {
    id: number;
    /**
     * Display text, always plain (no markup). For Complete this is the masked
     * passage preview; for Explain it is the plain-text flattening of
     * {@link Question.subjectHtml} — every list/search/notification surface reads
     * `name` and none of them render markup.
     */
    name: string;
    questionTypeId: number;
    /** Choose/Right-Wrong options. Empty for Complete and Explain questions. */
    options: Option[];
    /** Complete-only: the parsed passage (static text + blank placeholders). */
    segments?: CompleteSegment[];
    /** Complete-only: per-blank state; `answer` is zeroed until submission. */
    blanks?: CompleteBlank[];
    /** Explain-only: the authored prompt as rich HTML. Carries no answer. */
    subjectHtml?: string;
    /** Explain-only: the student's typed rich-HTML response. */
    responseText?: string;
    /**
     * Explain-only: the teacher's model answer. Mirrors `Option.isAnswer` and
     * `CompleteBlank.answer` — zeroed to `''` in the live quiz object and only
     * filled at submission time.
     */
    referenceAnswer?: string;
    /**
     * Explain-only: the authored share of the whole quiz score, 1–100. Resolved
     * against the rest of the quiz by `shared/question-scoring.ts`.
     */
    weightPercent?: number;
    userAnsweredQuestion: boolean;
    /**
     * Seconds this question gets on the clock before the quiz runner auto-advances
     * (or auto-submits, on the last question). Always resolved by the time a
     * question reaches this runtime shape — `QuizService`'s mappers coalesce a
     * missing/unset authored value to `DEFAULT_QUESTION_DURATION_SECONDS` (1
     * minute), so consumers never need their own fallback.
     */
    duration: number;
}
