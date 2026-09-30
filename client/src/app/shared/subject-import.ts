/**
 * Pure parser/validator for the Subjects Admin "Import JSON" feature.
 *
 * Kept out of the component so the file format can be unit-tested without a
 * browser FileReader (mirrors `shared/bulk-question-upload.ts`). Nothing here
 * does I/O — the component reads the file text and passes the already-
 * `JSON.parse`d value in.
 *
 * Expected file shape: either `{ "subjects": [...] }` or a bare `[...]` array.
 * Each entry: `{ "name": string, "color"?: string, "id"?: string }`. `id` is
 * optional — when omitted the caller allocates one from the catalog's current
 * max id (continuing the same numeric scheme as "New Subject"); when present
 * it overwrites any existing subject with that id.
 */

export interface ParsedSubjectInput {
  id?: string;
  name: string;
  color?: string;
}

export interface SubjectImportParseResult {
  subjects: ParsedSubjectInput[];
  errors: string[];
}

/** Parses and validates an already-`JSON.parse`d value against the subject-import schema. */
export function parseSubjectsJson(raw: unknown): SubjectImportParseResult {
  const rows = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>)?.['subjects'])
      ? (raw as Record<string, unknown>)['subjects'] as unknown[]
      : null;

  if (rows === null) {
    return { subjects: [], errors: ['The file must contain a "subjects" array (or be a JSON array of subjects).'] };
  }
  if (rows.length === 0) {
    return { subjects: [], errors: ['The file contains no subjects.'] };
  }

  const subjects: ParsedSubjectInput[] = [];
  const errors: string[] = [];

  rows.forEach((row, index) => {
    const label = `Subject ${index + 1}`;
    const rowErrors = validateRow(row, label);
    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      return;
    }
    const r = row as Record<string, unknown>;
    subjects.push({
      name: (r['name'] as string).trim(),
      color: typeof r['color'] === 'string' && r['color'].trim() ? (r['color'] as string).trim() : undefined,
      id: typeof r['id'] === 'string' && r['id'].trim() ? (r['id'] as string).trim() : undefined
    });
  });

  return { subjects, errors };
}

function validateRow(row: unknown, label: string): string[] {
  if (typeof row !== 'object' || row === null) {
    return [`${label}: must be an object.`];
  }
  const errors: string[] = [];
  const r = row as Record<string, unknown>;

  if (typeof r['name'] !== 'string' || !(r['name'] as string).trim()) {
    errors.push(`${label}: "name" is required and must be a non-empty string.`);
  }
  if (r['color'] !== undefined && typeof r['color'] !== 'string') {
    errors.push(`${label}: "color" must be a string if provided.`);
  }
  if (r['id'] !== undefined && typeof r['id'] !== 'string') {
    errors.push(`${label}: "id" must be a string if provided.`);
  }

  return errors;
}

/** Downloadable example matching the schema above; also exercised by the spec. */
export const SUBJECT_IMPORT_SAMPLE = {
  subjects: [
    { name: 'Mathematics', color: '#6366f1' },
    { name: 'Science', color: '#22c55e' },
    { name: 'Arabic' }
  ]
};
