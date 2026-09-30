/**
 * A grade level inside a stage (e.g. "Grade 1" inside "Primary").
 * Sits between Stage and ClassGroup in the school hierarchy.
 */
export interface Grade {
  id: string;
  stageId: string;
  name: string;
  order?: number;
}
