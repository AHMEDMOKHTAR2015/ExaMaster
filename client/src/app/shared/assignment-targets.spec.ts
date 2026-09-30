import { splitAssignmentTargets } from './assignment-targets';

const CLASS_9A = { id: '9a', name: '9-A' };
const CLASS_9B = { id: '9b', name: '9-B' };

/** uid → classId, standing in for the teacher's loaded roster. */
const ROSTER: Record<string, string> = {
  'ali': '9a',
  'omar': '9a',
  'yara': '9b'
};
const classOf = (uid: string) => ROSTER[uid];

describe('splitAssignmentTargets', () => {
  it('writes one whole-group assignment per selected group', () => {
    const targets = splitAssignmentTargets([CLASS_9A, CLASS_9B], [], classOf);

    expect(targets.map(t => t.cls.id)).toEqual(['9a', '9b']);
    // Empty childIds is what makes the assignment target the whole group.
    expect(targets.every(t => t.childIds.length === 0)).toBe(true);
  });

  /**
   * The rule that keeps a group from receiving an assignment naming students
   * who are not in it — `assignedChildIds` is what the student list filters on.
   */
  it('gives each group only its own picked students', () => {
    const targets = splitAssignmentTargets([CLASS_9A, CLASS_9B], ['ali', 'yara'], classOf);

    expect(targets.find(t => t.cls.id === '9a')!.childIds).toEqual(['ali']);
    expect(targets.find(t => t.cls.id === '9b')!.childIds).toEqual(['yara']);
  });

  /**
   * Writing it anyway would create an assignment targeting nobody, which a
   * student sees as work that exists and cannot be opened.
   */
  it('drops a group none of the picked students belong to', () => {
    const targets = splitAssignmentTargets([CLASS_9A, CLASS_9B], ['ali', 'omar'], classOf);

    expect(targets.map(t => t.cls.id)).toEqual(['9a']);
    expect(targets[0].childIds).toEqual(['ali', 'omar']);
  });

  it('returns nothing when no picked student is in any selected group', () => {
    const targets = splitAssignmentTargets([CLASS_9B], ['ali'], classOf);

    // The caller turns this into an error rather than writing zero records.
    expect(targets).toEqual([]);
  });

  it('ignores a picked student whose class is unknown', () => {
    const targets = splitAssignmentTargets([CLASS_9A], ['ali', 'ghost'], classOf);

    expect(targets[0].childIds).toEqual(['ali']);
  });
});
