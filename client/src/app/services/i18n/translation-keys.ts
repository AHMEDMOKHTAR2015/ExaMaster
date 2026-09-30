import { insertValue, TranslationObject } from '@ngx-translate/core';

/**
 * Pure helpers for the translation-override feature: turning the shipped
 * nested JSON into a flat key list, turning a school's flat overrides back
 * into the nested shape ngx-translate wants, and deciding whether an override
 * is safe to apply.
 *
 * Deliberately free of Angular and Firebase so both the runtime merge and the
 * editor can share one definition of "valid", and so it is testable without a
 * TestBed.
 */

/** A label longer than this is almost certainly a mistake; the longest shipped value is 179 characters. */
export const MAX_OVERRIDE_LENGTH = 500;

/**
 * The interpolation tokens ngx-translate will actually substitute.
 *
 * Copied verbatim from `TranslateDefaultParser.templateMatcher` in
 * @ngx-translate/core. It allows at most ONE space either side, so `{{ name }}`
 * is a token and `{{  name  }}` is not — the latter reaches the user as literal
 * text. A looser regex here would let the editor approve a label the runtime
 * cannot interpolate, so this must stay in step with the parser.
 */
export const TRANSLATION_PARAM_MATCHER = /{{\s?([^{}\s]*)\s?}}/g;

/** Why an override was rejected. */
export type OverrideIssueKind = 'empty' | 'tooLong' | 'missingParams' | 'unknownParams';

export interface OverrideIssue {
  kind: OverrideIssueKind;
  /** The offending token names, for `missingParams` / `unknownParams`. */
  params?: string[];
}

/** The interpolation tokens in a label, as a set — repeating one is legitimate. */
export function extractParams(value: string): Set<string> {
  const found = new Set<string>();
  // `matchAll` needs its own traversal; the shared regex is global and stateful.
  for (const match of value.matchAll(new RegExp(TRANSLATION_PARAM_MATCHER))) {
    if (match[1]) found.add(match[1]);
  }
  return found;
}

/**
 * Nested translation JSON → `{ 'nav.dashboard': 'Dashboard' }`.
 *
 * Only string leaves are emitted. The shipped files contain no arrays and no
 * numeric leaves, and anything else could not be edited as text anyway.
 */
export function flattenTranslations(source: unknown, prefix = ''): Record<string, string> {
  const flat: Record<string, string> = {};
  if (!source || typeof source !== 'object') return flat;

  for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      flat[path] = value;
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(flat, flattenTranslations(value, path));
    }
  }
  return flat;
}

/**
 * `{ 'nav.dashboard': 'Homeroom' }` → `{ nav: { dashboard: 'Homeroom' } }`.
 *
 * Uses the core's own `insertValue` so the nesting matches exactly what
 * `mergeDeep` expects during `setTranslation(..., true)`.
 */
export function unflattenOverrides(values: Record<string, string>): TranslationObject {
  return Object.entries(values).reduce<TranslationObject>(
    (nested, [key, value]) => insertValue(nested, key, value),
    {}
  );
}

/**
 * Whether one override may replace one base label.
 *
 * Both directions of token drift matter, and neither surfaces as an error at
 * runtime:
 *
 *  - Dropping a token silently renders "Hello," instead of "Hello, Sara" —
 *    the parser simply has nothing to substitute.
 *  - Adding one that the base lacks renders the literal `{{ foo }}`, because
 *    the call site passes no parameters and the parser returns the string
 *    untouched.
 *
 * Returns `null` when the override is fine.
 */
export function validateOverride(baseValue: string, overrideValue: string): OverrideIssue | null {
  const trimmed = overrideValue.trim();
  // An empty label is indistinguishable from a bug; clearing is what Reset is for.
  if (!trimmed) return { kind: 'empty' };
  if (overrideValue.length > MAX_OVERRIDE_LENGTH) return { kind: 'tooLong' };

  const baseParams = extractParams(baseValue);
  const overrideParams = extractParams(overrideValue);

  const missing = [...baseParams].filter(p => !overrideParams.has(p));
  if (missing.length > 0) return { kind: 'missingParams', params: missing };

  const unknown = [...overrideParams].filter(p => !baseParams.has(p));
  if (unknown.length > 0) return { kind: 'unknownParams', params: unknown };

  return null;
}

/**
 * Reduce a stored override map to the entries that are safe to merge.
 *
 * This is the load-bearing check, not the editor's. A document can reach
 * Firestore from an older client, a script, or the console, and whatever is in
 * it gets merged into the UI of every member of that school. Anything
 * suspicious is dropped so the label falls back to the shipped one.
 *
 * Dropping an entry whose key is absent from the base also handles the ordinary
 * case of a developer deleting a key in a later release while a school still
 * holds an override for it.
 */
export function sanitizeOverrides(
  values: Record<string, unknown> | undefined | null,
  baseFlat: Record<string, string>
): Record<string, string> {
  const clean: Record<string, string> = {};
  if (!values) return clean;

  for (const [key, value] of Object.entries(values)) {
    if (typeof value !== 'string') continue;
    const baseValue = baseFlat[key];
    if (baseValue === undefined) continue;
    if (validateOverride(baseValue, value)) continue;
    clean[key] = value;
  }
  return clean;
}
