/** The term a material covers, as the app spells semesters (`semester.*` labels). */
export type MaterialSemester = 'first' | 'second' | 'full';

/**
 * One block of a lesson, in the order the book gives them. The shapes are the
 * teaching-summary document's own (validated by the API on upload).
 */
export type MaterialBlock =
  | { type: 'heading' | 'paragraph' | 'note' | 'formula'; text: string }
  | { type: 'example'; label: string; text: string }
  | { type: 'list'; ordered: boolean; items: string[]; title?: string }
  | { type: 'terms'; items: MaterialTerm[] }
  | { type: 'table'; columns: string[]; rows: string[][]; title?: string }
  | { type: 'code'; language: string; code: string };

export interface MaterialTerm {
  term: string;
  termAr: string;
  definition: string;
}

/** The lesson's Arabic explanation box: paragraphs, bullets and highlighted examples. */
export interface ArabicExplanation {
  title: string;
  items: { type: 'paragraph' | 'bullet' | 'example'; text: string }[];
}

export interface MaterialLesson {
  id: string;
  order: number;
  /** As printed in the book: "1-1", "13-4 – 13-6". */
  code: string;
  title: string;
  content: MaterialBlock[];
  arabicExplanation: ArabicExplanation;
}

export interface MaterialUnit {
  id: string;
  number: number;
  /** "Chapter" or "Unit", as the book names them. */
  kind: string;
  title: string;
  bookPageFrom?: number;
  bookPageTo?: number;
  bigIdeaEnglish: string;
  bigIdeaArabic: string;
  keyTakeaways: string[];
  lessons: MaterialLesson[];
}

/** The document's front matter, shown before the first unit. Every part is optional: a document may leave any out. */
export interface MaterialOverview {
  label?: string;
  guide?: string;
  howToReadBoxes?: { box: string; label: string; meaning: string }[];
  arabicGuide?: { title: string; text: string };
  arc?: { title: string; intro: string; stages: { order: number; name: string; unitsLabel: string; summary: string }[] };
  sourceNotes?: { title: string; intro: string; items: string[] };
}

/** A material as the list shows it: no lessons. */
export interface TeachingMaterialSummary {
  id: string;
  sourceKey: string;
  title: string;
  subtitle?: string;
  subjectId: string;
  gradeId: string;
  semester?: MaterialSemester;
  unitCount: number;
  lessonCount: number;
  /** The uploader's API user id. */
  createdBy: string;
  uploadedByName?: string;
  createdAt: number;
}

export interface TeachingMaterial {
  id: string;
  sourceKey: string;
  title: string;
  subtitle?: string;
  forLabel?: string;
  subjectId: string;
  gradeId: string;
  semester?: MaterialSemester;
  createdBy: string;
  createdAt: number;
  overview: MaterialOverview;
  units: MaterialUnit[];
}
