import { MaterialSemester } from '../models';

/** What a picked file holds, shown before it is uploaded. */
export interface MaterialFilePreview {
  sourceKey: string;
  title: string;
  subtitle?: string;
  forLabel?: string;
  semester?: MaterialSemester;
  unitCount: number;
  lessonCount: number;
}

export type MaterialFileReading =
  | { document: Record<string, unknown>; preview: MaterialFilePreview }
  | { error: 'notJson' | 'notMaterial' };

/**
 * A quick look at a picked file before it is sent: is it a teaching-summary
 * document at all, and what is in it. Only the outline is checked here; the API
 * checks every unit, lesson and block, and names each problem it finds.
 */
export function readMaterialFile(text: string): MaterialFileReading {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: 'notJson' };
  }

  if (!isObject(raw) || typeof raw['id'] !== 'string' || typeof raw['title'] !== 'string' || !Array.isArray(raw['units'])) {
    return { error: 'notMaterial' };
  }

  const units = raw['units'] as unknown[];
  const lessonCount = units.reduce<number>(
    (total, unit) => total + (isObject(unit) && Array.isArray(unit['lessons']) ? unit['lessons'].length : 0), 0);
  const audience = isObject(raw['audience']) ? raw['audience'] : {};
  const semester = typeof audience['semester'] === 'string' ? audience['semester'].toLowerCase() : undefined;

  return {
    document: raw,
    preview: {
      sourceKey: raw['id'],
      title: raw['title'],
      subtitle: typeof raw['subtitle'] === 'string' ? raw['subtitle'] : undefined,
      forLabel: typeof raw['forLabel'] === 'string' ? raw['forLabel'] : undefined,
      semester: semester === 'first' || semester === 'second' || semester === 'full' ? semester : undefined,
      unitCount: units.length,
      lessonCount
    }
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
