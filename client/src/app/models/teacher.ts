/**
 * A teacher assigned to a class. Kept separate from the User entity so a
 * teacher can be listed in the admin UI before they ever sign in.
 */
export interface Teacher {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  photoURL?: string;
  /** Subjects this teacher educates. Teacher↔Subject is many-to-many. */
  subjectIds?: string[];
}
