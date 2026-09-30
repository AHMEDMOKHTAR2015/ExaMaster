/**
 * Pure parser/validator for the Questions Bank "Upload JSON" feature.
 *
 * Kept out of the component so the file format can be unit-tested without a
 * browser FileReader (mirrors the approach in `shared/quiz-management.ts`).
 * Nothing here does I/O — the component reads the file text and passes the
 * already-`JSON.parse`d value in.
 *
 * Expected file shape: either `{ "questions": [...] }` or a bare `[...]`
 * array. Each entry is one of four shapes, selected by `questionTypeId`
 * (default `1` = Choose):
 *   Choose (1):        { "text": string, "options": [{ "id": number, "text": string }, ...],
 *                        "correctOptionId": number, "questionTypeId"?: 1, "duration"?: number }
 *   Complete (2):      { "text": string, "questionTypeId": 2, "duration"?: number }
 *                      where text is a passage containing (Complete) markers.
 *   Right or Wrong (3):{ "text": string, "questionTypeId": 3, "isRight": boolean,
 *                        "duration"?: number } — text is the statement being judged.
 *   Explain (4):       { "text": string, "questionTypeId": 4, "referenceAnswer": string,
 *                        "weightPercent"?: number, "duration"?: number } — text is the
 *                      prompt, `referenceAnswer` the model answer, `weightPercent`
 *                      (1–100, default 10) its share of the whole quiz score.
 * `correctOptionId` must match one of that Choose question's option ids. A
 * Complete row's `text` must contain at least one `(Complete)` marker. An
 * unrecognized `questionTypeId` is rejected rather than silently treated as
 * Choose. `duration` (seconds on the clock for that question) is optional — the
 * runtime default applies when omitted. Question ids are intentionally not
 * part of the file — the caller allocates them from the bank's current max id
 * so an uploaded batch never collides with existing questions.
 *
 * Explain `text` and `referenceAnswer` may contain the same simple HTML the
 * in-app editor produces; plain text is equally valid.
 */

import { CompleteSegment, QUESTION_TYPE, isSupportedQuestionType } from '../models';
import { parseCompleteAuthoredText, isCompleteParseError, renderPreviewText } from './complete-question';
import { buildRightWrongOptions, rightWrongCorrectOptionId } from './right-wrong-question';
import {
  DEFAULT_EXPLAIN_WEIGHT_PERCENT, MAX_EXPLAIN_WEIGHT_PERCENT, MIN_EXPLAIN_WEIGHT_PERCENT,
  plainTextFromHtml
} from './explain-question';

export interface BulkUploadOptionInput {
  id: number;
  text: string;
}

export interface BulkUploadQuestionInput {
  /**
   * Stored `name`: raw text for Choose and Right-or-Wrong, the masked preview
   * for Complete, the plain-text flattening of the prompt for Explain.
   */
  text: string;
  questionTypeId: number;
  /** Choose and Right-or-Wrong only; empty for Complete and Explain. */
  options: BulkUploadOptionInput[];
  /** Choose and Right-or-Wrong only; `null` for Complete and Explain. */
  correctOptionId: number | null;
  /** Complete only: parsed passage (masked). */
  segments?: CompleteSegment[];
  /** Complete only: correct keyword per blank. */
  correctBlanks?: string[];
  /** Explain only: the prompt as rich HTML. */
  subjectHtml?: string;
  /** Explain only: the model answer. Belongs to `/Answers`, never `/Questions`. */
  referenceAnswer?: string;
  /** Explain only: share of the whole quiz score, 1–100. */
  weightPercent?: number;
  /** Seconds on the clock for this question; omitted means the runtime default applies. */
  duration?: number;
}

export interface BulkUploadParseResult {
  questions: BulkUploadQuestionInput[];
  errors: string[];
}

/** Parses and validates an already-`JSON.parse`d value against the bulk-upload schema. */
export function parseBulkQuestionsJson(raw: unknown): BulkUploadParseResult {
  const rows = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>)?.['questions'])
      ? (raw as Record<string, unknown>)['questions'] as unknown[]
      : null;

  if (rows === null) {
    return { questions: [], errors: ['The file must contain a "questions" array (or be a JSON array of questions).'] };
  }
  if (rows.length === 0) {
    return { questions: [], errors: ['The file contains no questions.'] };
  }

  const questions: BulkUploadQuestionInput[] = [];
  const errors: string[] = [];

  rows.forEach((row, index) => {
    const label = `Question ${index + 1}`;
    const rowErrors = validateRow(row, label);
    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      return;
    }
    const r = row as Record<string, unknown>;
    const questionTypeId = typeof r['questionTypeId'] === 'number' ? r['questionTypeId'] as number : QUESTION_TYPE.CHOOSE;
    const duration = typeof r['duration'] === 'number' ? r['duration'] as number : undefined;

    if (questionTypeId === QUESTION_TYPE.COMPLETE) {
      // validateRow guarantees this parses successfully.
      const parsed = parseCompleteAuthoredText((r['text'] as string).trim());
      if (isCompleteParseError(parsed)) return; // unreachable; keeps types honest
      questions.push({
        text: renderPreviewText(parsed.segments),
        questionTypeId,
        options: [],
        correctOptionId: null,
        segments: parsed.segments,
        correctBlanks: parsed.keywords,
        ...(duration !== undefined && { duration })
      });
      return;
    }

    if (questionTypeId === QUESTION_TYPE.RIGHT_WRONG) {
      // Same storage as a two-option Choose question — see `right-wrong-question.ts`.
      questions.push({
        text: (r['text'] as string).trim(),
        questionTypeId,
        options: buildRightWrongOptions().map(o => ({ id: o.id, text: o.name })),
        correctOptionId: rightWrongCorrectOptionId(r['isRight'] as boolean),
        ...(duration !== undefined && { duration })
      });
      return;
    }

    if (questionTypeId === QUESTION_TYPE.EXPLAIN) {
      const subjectHtml = (r['text'] as string).trim();
      questions.push({
        // Stored `name` stays plain — bank lists and search print it raw.
        text: plainTextFromHtml(subjectHtml),
        questionTypeId,
        options: [],
        correctOptionId: null,
        subjectHtml,
        referenceAnswer: (r['referenceAnswer'] as string).trim(),
        weightPercent: typeof r['weightPercent'] === 'number'
          ? r['weightPercent'] as number
          : DEFAULT_EXPLAIN_WEIGHT_PERCENT,
        ...(duration !== undefined && { duration })
      });
      return;
    }

    const options = r['options'] as Record<string, unknown>[];
    questions.push({
      text: (r['text'] as string).trim(),
      questionTypeId,
      options: options.map(o => ({ id: o['id'] as number, text: (o['text'] as string).trim() })),
      correctOptionId: r['correctOptionId'] as number,
      ...(duration !== undefined && { duration })
    });
  });

  return { questions, errors };
}

function validateRow(row: unknown, label: string): string[] {
  if (typeof row !== 'object' || row === null) {
    return [`${label}: must be an object.`];
  }
  const errors: string[] = [];
  const r = row as Record<string, unknown>;

  if (r['questionTypeId'] !== undefined && typeof r['questionTypeId'] !== 'number') {
    errors.push(`${label}: "questionTypeId" must be a number if provided.`);
    return errors;
  }

  // Reject an unknown type outright. Falling through to the Choose branch would
  // store a question no renderer or grader knows how to handle.
  if (r['questionTypeId'] !== undefined && !isSupportedQuestionType(r['questionTypeId'])) {
    errors.push(`${label}: "questionTypeId" ${r['questionTypeId']} is not a supported question type (1 = Choose, 2 = Complete, 3 = Right or Wrong, 4 = Explain).`);
    return errors;
  }

  if (r['duration'] !== undefined && (typeof r['duration'] !== 'number' || r['duration'] <= 0)) {
    errors.push(`${label}: "duration" must be a positive number of seconds if provided.`);
    return errors;
  }

  if (typeof r['text'] !== 'string' || !(r['text'] as string).trim()) {
    errors.push(`${label}: "text" is required and must be a non-empty string.`);
    return errors;
  }

  const questionTypeId = typeof r['questionTypeId'] === 'number' ? r['questionTypeId'] as number : QUESTION_TYPE.CHOOSE;

  if (questionTypeId === QUESTION_TYPE.COMPLETE) {
    const parsed = parseCompleteAuthoredText((r['text'] as string).trim());
    if (isCompleteParseError(parsed)) {
      errors.push(parsed.error === 'no-markers'
        ? `${label}: a Complete question's "text" must contain at least one "(Complete)" marker.`
        : `${label}: each "(Complete)" marker must directly follow a word.`);
    }
    return errors;
  }

  if (questionTypeId === QUESTION_TYPE.RIGHT_WRONG) {
    if (typeof r['isRight'] !== 'boolean') {
      errors.push(`${label}: a Right or Wrong question needs "isRight": true or false.`);
    }
    return errors;
  }

  if (questionTypeId === QUESTION_TYPE.EXPLAIN) {
    if (typeof r['referenceAnswer'] !== 'string' || !plainTextFromHtml(r['referenceAnswer'] as string)) {
      errors.push(`${label}: an Explain question needs a non-empty "referenceAnswer".`);
    }
    const weight = r['weightPercent'];
    if (weight !== undefined) {
      if (typeof weight !== 'number' || weight < MIN_EXPLAIN_WEIGHT_PERCENT || weight > MAX_EXPLAIN_WEIGHT_PERCENT) {
        errors.push(`${label}: "weightPercent" must be a number between ${MIN_EXPLAIN_WEIGHT_PERCENT} and ${MAX_EXPLAIN_WEIGHT_PERCENT} if provided.`);
      }
    }
    return errors;
  }

  // Choose validation
  const options = r['options'];
  if (!Array.isArray(options) || options.length < 2) {
    errors.push(`${label}: "options" must be an array with at least 2 entries.`);
  } else {
    const ids = new Set<number>();
    let optionsValid = true;
    options.forEach((o, i) => {
      if (typeof o !== 'object' || o === null || typeof o.id !== 'number' || typeof o.text !== 'string' || !o.text.trim()) {
        errors.push(`${label}: option ${i + 1} must be { "id": number, "text": string }.`);
        optionsValid = false;
        return;
      }
      if (ids.has(o.id)) {
        errors.push(`${label}: duplicate option id ${o.id}.`);
        optionsValid = false;
      }
      ids.add(o.id);
    });

    if (optionsValid) {
      const correctOptionId = r['correctOptionId'];
      if (typeof correctOptionId !== 'number') {
        errors.push(`${label}: "correctOptionId" is required and must be a number.`);
      } else if (!ids.has(correctOptionId)) {
        errors.push(`${label}: "correctOptionId" (${correctOptionId}) does not match any option id.`);
      }
    }
  }

  return errors;
}

/** Downloadable example matching the schema above; also exercised by the spec. */
/**
 * The downloadable template for the Questions Bank's "Upload JSON" feature.
 *
 * One worked example of each of the four question types, in the order the admin
 * meets them in the UI. It is what an admin copies to build their own file, so
 * the examples have to be *correct*, not merely well-formed — the parser
 * validates structure and cannot tell that 7 × 8 is not 64.
 *
 * `_readme` is ignored by {@link parseBulkQuestionsJson}, which reads only
 * `questions`. It rides along because JSON has no comments and the file is
 * opened in a text editor by the person who has to fill it in — a test pins
 * that its presence never breaks a re-upload.
 */
export const BULK_UPLOAD_SAMPLE = {
  _readme: [
    'Delete this _readme key, or leave it — the importer ignores it.',
    'Only the "questions" array is read. Do not include question ids: the importer',
    'allocates them so an uploaded batch never collides with existing questions.',
    'Subject, Stage, Grade and Semester are chosen once in the app after upload,',
    'and applied to every question in the file — they are not per-question fields.',
    '',
    'questionTypeId 1 = Choose (the default when omitted)',
    '  text, options: [{ id, text }], correctOptionId (must match one option id)',
    'questionTypeId 2 = Complete (fill in the blank)',
    '  text only. Mark each blank by putting (Complete) straight after the word:',
    '  "The capital is Cairo(Complete)." A multi-word answer is consecutive marks:',
    '  "New(Complete) York(Complete)". The marker is case-sensitive.',
    'questionTypeId 3 = Right or Wrong',
    '  text is the statement being judged, plus isRight: true | false',
    'questionTypeId 4 = Explain (teacher-graded)',
    '  text is the prompt, referenceAnswer the model answer, weightPercent (1-100,',
    '  default 10) its share of the whole quiz score',
    '',
    'duration (seconds on the clock for that question) is optional everywhere.',
    'Complete and Explain answers are graded by a teacher after submission.'
  ],
  questions: [
    {
      text: 'What is 7 × 8?',
      options: [
        { id: 1, text: '54' },
        { id: 2, text: '56' },
        { id: 3, text: '64' },
        { id: 4, text: '48' }
      ],
      // 56 is option id 2. This file is what an admin copies to build their own,
      // so a demonstrably wrong answer in it teaches the wrong pattern — and the
      // parser cannot catch it, since any existing option id is structurally
      // valid.
      correctOptionId: 2,
      duration: 45
    },
    {
      text: 'What is the capital of Egypt?',
      options: [
        { id: 1, text: 'Alexandria' },
        { id: 2, text: 'Cairo' },
        { id: 3, text: 'Giza' }
      ],
      correctOptionId: 2
    },
    {
      text: 'The largest planet in our solar system is Jupiter(Complete).',
      questionTypeId: 2
    },
    {
      text: 'The Earth orbits the Sun.',
      questionTypeId: 3,
      isRight: true
    },
    {
      text: 'Explain why leaves are green.',
      questionTypeId: 4,
      referenceAnswer: 'Leaves contain chlorophyll, which reflects green light and absorbs red and blue light for photosynthesis.',
      weightPercent: 20
    }
  ]
};
