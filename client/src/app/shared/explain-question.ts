/**
 * Helpers for the "Explain" (open response) question type.
 *
 * Kept out of any component/service so it can be unit-tested without a browser
 * or Firebase (mirrors `shared/complete-question.ts`). Nothing here does I/O and
 * nothing here touches the DOM — the HTML helpers are deliberately string-only
 * so they run identically in the grader, the authoring validator and tests.
 *
 * Authoring shape: a rich-HTML `subject` (the prompt) plus a rich-HTML
 * `referenceAnswer` (the model answer), and a `weightPercent` — the share of the
 * whole quiz score this question is worth. The reference answer is the answer
 * key, so it lives on `/Answers`, never on `/Questions`. The subject is safe to
 * expose and is stored on `/Questions` alongside a plain-text `name`.
 */

/** Default share of the quiz score for an Explain question with no authored weight. */
export const DEFAULT_EXPLAIN_WEIGHT_PERCENT = 10;

/** Inclusive bounds for an authored `weightPercent`. */
export const MIN_EXPLAIN_WEIGHT_PERCENT = 1;
export const MAX_EXPLAIN_WEIGHT_PERCENT = 100;

/**
 * Ceiling for a single authored HTML field, in UTF-8 bytes.
 *
 * Firestore caps a whole *document* at 1 MiB, so this budget is shared with
 * every other field on the question. 512 KiB leaves ample room for the rest of
 * the document while still being far beyond any genuine answer.
 *
 * Nothing caps typing — this exists only so a paste-bomb fails save-time
 * validation with a readable message instead of an opaque write error.
 */
export const MAX_HTML_FIELD_BYTES = 512 * 1024;

/** UTF-8 byte length of a string. */
export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/** Whether a value would exceed {@link MAX_HTML_FIELD_BYTES} when written. */
export function exceedsHtmlFieldLimit(value: string | null | undefined): boolean {
  return utf8ByteLength(value ?? '') > MAX_HTML_FIELD_BYTES;
}

const BLOCK_LEVEL_TAG = /<\/?(p|div|br|li|tr|h[1-6]|blockquote|pre)\b[^>]*>/gi;
const ANY_TAG = /<[^>]*>/g;
const NAMED_ENTITY: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
};

/**
 * Flatten rich HTML to plain text: block-level tags become spaces (so
 * `<p>a</p><p>b</p>` reads as `a b`, not `ab`), every other tag is dropped, the
 * handful of entities our editor can emit are decoded, and whitespace is
 * collapsed.
 *
 * Used for the stored `name` of an Explain question and for
 * `ParticipationAnswer.questionName`, both of which flow into list search,
 * homework pickers and notifications — surfaces that render text, not markup.
 */
export function plainTextFromHtml(html: string | null | undefined): string {
  if (!html) return '';
  let text = html.replace(BLOCK_LEVEL_TAG, ' ').replace(ANY_TAG, '');
  for (const [entity, char] of Object.entries(NAMED_ENTITY)) {
    text = text.split(entity).join(char);
  }
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Whether the student actually wrote something. An empty contenteditable still
 * reports markup like `<p><br></p>`, so emptiness is decided on the flattened
 * text rather than on the raw HTML.
 */
export function hasExplainResponse(responseText: string | null | undefined): boolean {
  return plainTextFromHtml(responseText).length > 0;
}

/** Single-line, length-capped preview of rich text (review lists, summaries). */
export function summarizeExplainText(html: string | null | undefined, maxLength = 80): string {
  const text = plainTextFromHtml(html);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

export type ExplainAuthoringError =
  | 'empty-subject'
  | 'empty-answer'
  | 'invalid-weight'
  | 'too-long';

export interface ExplainAuthoringInput {
  subjectHtml: string;
  referenceAnswer: string;
  weightPercent: number;
}

/**
 * Validate one authored Explain question. Returns the first problem found, or
 * `null` when the question is saveable. Cross-question weight validation (the
 * whole quiz's Explain weights summing over 100) lives in
 * `shared/question-scoring.ts` — it needs the rest of the quiz, which this
 * per-question check does not see.
 */
export function validateExplainAuthoring(input: ExplainAuthoringInput): ExplainAuthoringError | null {
  if (plainTextFromHtml(input.subjectHtml).length === 0) return 'empty-subject';
  if (plainTextFromHtml(input.referenceAnswer).length === 0) return 'empty-answer';

  const weight = input.weightPercent;
  if (
    !Number.isFinite(weight) ||
    weight < MIN_EXPLAIN_WEIGHT_PERCENT ||
    weight > MAX_EXPLAIN_WEIGHT_PERCENT
  ) {
    return 'invalid-weight';
  }

  if (exceedsHtmlFieldLimit(input.subjectHtml) || exceedsHtmlFieldLimit(input.referenceAnswer)) {
    return 'too-long';
  }

  return null;
}
