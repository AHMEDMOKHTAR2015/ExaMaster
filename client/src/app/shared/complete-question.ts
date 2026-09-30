/**
 * Pure parser/grader for the "Complete" (fill-in-the-blank) question type.
 *
 * Kept out of any component/service so it can be unit-tested without a browser
 * or Firebase (mirrors `shared/bulk-question-upload.ts` and
 * `shared/quiz-runner.ts`). Nothing here does I/O.
 *
 * Authoring format: free text in which a word immediately followed by the
 * literal marker `(Complete)` becomes a blank. The keyword for a marker is the
 * single whitespace-delimited word directly before it — a multi-word answer is
 * expressed as consecutive marked words (`New(Complete) York(Complete)`), not a
 * single phrase. The marker is matched literally and case-sensitively; there is
 * no escape mechanism (`(complete)` / `(COMPLETE)` stay plain text).
 */

import { CompleteSegment } from '../models/question';

/** The literal blank marker. Matched case-sensitively and literally. */
export const COMPLETE_MARKER = '(Complete)';

export interface CompleteParseSuccess {
  segments: CompleteSegment[];
  /** Correct keyword per blank, ordered by blank index. */
  keywords: string[];
}

export interface CompleteParseFailure {
  error: 'no-markers' | 'empty-keyword';
}

export type CompleteParseResult = CompleteParseSuccess | CompleteParseFailure;

/** Narrowing helper for {@link parseCompleteAuthoredText} results. */
export function isCompleteParseError(result: CompleteParseResult): result is CompleteParseFailure {
  return 'error' in result;
}

/**
 * Parse authored Complete text into ordered segments (static text + blanks) plus
 * the correct keyword for each blank.
 *
 * Rules:
 * - Zero markers anywhere → `{ error: 'no-markers' }`.
 * - The text between the previous cursor and a marker is right-trimmed; if it is
 *   empty (marker with no preceding word) → `{ error: 'empty-keyword' }`.
 * - The keyword is the last whitespace-delimited token of that trimmed text.
 *   Everything before that token (with its original spacing) becomes the
 *   preceding static-text segment.
 */
export function parseCompleteAuthoredText(raw: string): CompleteParseResult {
  if (raw.indexOf(COMPLETE_MARKER) === -1) {
    return { error: 'no-markers' };
  }

  const segments: CompleteSegment[] = [];
  const keywords: string[] = [];
  let cursor = 0;
  let blankIndex = 0;

  while (true) {
    const markerStart = raw.indexOf(COMPLETE_MARKER, cursor);
    if (markerStart === -1) {
      const tail = raw.slice(cursor);
      if (tail.length > 0) {
        segments.push({ kind: 'text', text: tail });
      }
      break;
    }

    const chunk = raw.slice(cursor, markerStart);
    const chunkTrimmed = chunk.replace(/\s+$/, '');
    if (chunkTrimmed.length === 0) {
      return { error: 'empty-keyword' };
    }

    // Keyword = last whitespace-delimited token; the rest is leading text.
    const lastSpace = chunkTrimmed.search(/\s\S*$/);
    const keyword = lastSpace === -1 ? chunkTrimmed : chunkTrimmed.slice(lastSpace + 1);
    const leadingText = lastSpace === -1 ? '' : chunkTrimmed.slice(0, lastSpace + 1);

    if (leadingText.length > 0) {
      segments.push({ kind: 'text', text: leadingText });
    }
    segments.push({ kind: 'blank', index: blankIndex, expectedLength: keyword.length });
    keywords.push(keyword);
    blankIndex++;

    cursor = markerStart + COMPLETE_MARKER.length;
  }

  return { segments, keywords };
}

/** Fixed placeholder used for a blank in flattened preview/list text. */
export const BLANK_PLACEHOLDER = '_____';

/**
 * Flatten parsed segments into a single display string, each blank shown as a
 * fixed placeholder. Used as the stored `name` for a Complete question (masked —
 * never reveals the answer or its length) so every list/search surface that
 * prints `question.name` keeps working unchanged.
 */
export function renderPreviewText(segments: CompleteSegment[]): string {
  return segments
    .map(seg => (seg.kind === 'text' ? seg.text : BLANK_PLACEHOLDER))
    .join('');
}

/**
 * Rebuild authorable text from masked segments + the correct keywords. Used to
 * re-seed the authoring textarea when editing an existing Complete question. The
 * marker is emitted in canonical form (`keyword(Complete)`); exact original
 * spacing/formatting is not preserved byte-for-byte, only round-trip-parseable.
 */
export function reconstructAuthoredText(segments: CompleteSegment[], keywords: string[]): string {
  return segments
    .map(seg => (seg.kind === 'text' ? seg.text : `${keywords[seg.index] ?? ''}${COMPLETE_MARKER}`))
    .join('');
}

/** Canonical comparison form for a Complete answer: trimmed and lower-cased. */
export function normalizeCompleteAnswer(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/**
 * Whether every blank's typed answer matches its keyword under
 * {@link normalizeCompleteAnswer}. An empty/missing `userAnswer` counts as not
 * matching. Never throws; an empty/missing blank list is treated as not matching
 * (defensive — save-time validation already rejects zero-marker questions, so it
 * should not occur).
 *
 * **No longer the grading verdict.** Complete questions are marked by a teacher
 * now, because a blank can have several right answers and the author typed only
 * one — see `requiresManualReview` in `question-scoring.ts`. This is a string
 * comparison, nothing more; `suggestedCompleteAward` in `grade-quiz.ts` is what
 * turns the per-blank matches into a mark the teacher can accept or override.
 */
export function isCompleteQuestionCorrect(
  blanks: { answer: string; userAnswer?: string | null }[] | undefined
): boolean {
  if (!blanks || blanks.length === 0) return false;
  return blanks.every(b => normalizeCompleteAnswer(b.userAnswer) === normalizeCompleteAnswer(b.answer));
}
