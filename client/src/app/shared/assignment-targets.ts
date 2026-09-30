/** One assignment about to be written: the group, and who in it receives it. */
export interface AssignmentTarget<C> {
  cls: C;
  /** Empty means the whole group — matching `assignedChildIds` being absent. */
  childIds: string[];
}

/**
 * Split a multi-group assignment into the records that will actually be
 * written, one per group.
 *
 * A `HomeworkAssignment` holds a single `classId`, and that field decides
 * whether a student may submit (the server checks it), which bucket
 * the admin quiz breakdown counts it in, and which roster the teacher's
 * participation view joins against. So "assign to 9-A and 9-B" is one record
 * each rather than a widened field.
 *
 * Two rules the caller depends on:
 *
 * - **Each group gets only its own students.** A picked student is attached to
 *   the group they are actually in, so 9-B never receives an assignment naming
 *   someone from 9-A.
 * - **A group nobody was picked from is dropped** — but only when specific
 *   students were picked at all. Writing it anyway would create an assignment
 *   targeting an empty set, which reads to a student as homework that exists
 *   and cannot be opened.
 *
 * With no students picked (`selectedUids` empty) every group is kept and each
 * gets an empty `childIds`, i.e. the whole group.
 */
export function splitAssignmentTargets<C extends { id: string }>(
  classes: C[],
  selectedUids: string[],
  classIdOfStudent: (uid: string) => string | undefined
): AssignmentTarget<C>[] {
  const wholeGroup = selectedUids.length === 0;
  return classes
    .map(cls => ({
      cls,
      childIds: wholeGroup ? [] : selectedUids.filter(uid => classIdOfStudent(uid) === cls.id)
    }))
    .filter(target => wholeGroup || target.childIds.length > 0);
}
