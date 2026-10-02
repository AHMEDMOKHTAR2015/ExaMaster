/**
 * A topic inside a subject (Fractions, Photosynthesis, ...). Questions are tagged with their subject's tags so a
 * student's results can be read per topic.
 */
export interface SubjectTag {
  /** Empty for a tag the form has added but not saved yet: the API assigns the id. */
  id: string;
  name: string;
}

/**
 * A subject a class is taught in (Math, Science, English, ...).
 */
export interface Subject {
  id: string;
  name: string;
  color?: string;
  /** Its tags, by name. Left out of an update, the API keeps the subject's tags as they are. */
  tags?: SubjectTag[];
}
