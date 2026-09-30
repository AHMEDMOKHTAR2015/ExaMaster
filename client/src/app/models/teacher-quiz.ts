import { QuizConfig } from './quiz-config';
import { HomeworkSemester } from './homework';
import { CompleteSegment } from './question';

/** A single answer choice on a teacher-authored question. */
export interface TeacherQuizOption {
  id: number;
  name: string;
  isAnswer: boolean;
}

/**
 * The correct keyword for one blank in a teacher-authored Complete question.
 * Like {@link TeacherQuizOption}'s `isAnswer`, the answer is embedded directly
 * (no Questions/Answers split) because the record is private to its owning quiz.
 */
export interface TeacherQuizBlank {
  index: number;
  answer: string;
}

/**
 * A teacher-authored question. Unlike the admin question bank, the correct
 * answer is embedded directly on the option (`isAnswer`) rather than split
 * into a separate `Answers` node — these questions are private to the quiz
 * that owns them, not a shared bank, so there is nothing to protect by
 * splitting them.
 *
 * For a Complete question, `name` is the *masked* preview text (blanks shown as
 * a placeholder), never the raw authored text — it flows into the runtime
 * `Question.name` untouched and is read by list/search surfaces, so it must not
 * carry the answer. `options` is empty; the passage and answers live on
 * `segments`/`blanks`. For an Explain question `name` is likewise derived: the
 * plain-text flattening of `subjectHtml`.
 */
export interface TeacherQuizQuestion {
  id: number;
  name: string;
  questionTypeId: number;
  options: TeacherQuizOption[];
  /** Complete-only: parsed passage (static text + blank placeholders), masked. */
  segments?: CompleteSegment[];
  /** Complete-only: correct keyword per blank, embedded (private per quiz). */
  blanks?: TeacherQuizBlank[];
  /** Explain-only: the authored prompt as rich HTML. Carries no answer. */
  subjectHtml?: string;
  /** Explain-only: the model answer, embedded (private per quiz). */
  referenceAnswer?: string;
  /** Explain-only: authored share of the whole quiz score, 1–100. */
  weightPercent?: number;
  /** Seconds on the clock for this question; unset means the runtime default applies. */
  duration?: number;
}

/**
 * A quiz/homework a teacher authored from scratch (as opposed to one picked
 * from the application-admin's shared quiz bank). Only its author (or an
 * administrator) may change it; the server enforces that.
 */
export interface TeacherQuiz {
  id: string;
  name: string;
  description: string;
  config: QuizConfig;
  subjectId: string;
  /** Educational stage this quiz targets (Stage.id) — narrows question-bank suggestions in the builder. */
  stageId?: string;
  semester?: HomeworkSemester;
  questions: TeacherQuizQuestion[];
  /** The author's API user id. */
  createdBy: string;
  createdAt: number;
  /** Lists only (the overview carries no questions): how many the quiz has. */
  questionCount?: number;
}
