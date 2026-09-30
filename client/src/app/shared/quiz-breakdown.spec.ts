import { HomeworkAssignment, TeacherQuiz } from '../models';
import { assembleQuizCounts, placeTeacherQuizzes, StoredQuizCounts, summarizeQuizCounts } from './quiz-breakdown';

function teacherQuiz(overrides: Partial<TeacherQuiz> = {}): TeacherQuiz {
  return {
    id: 'tq1', name: 'Full Year Arabic Quiz', description: '',
    config: {} as TeacherQuiz['config'], subjectId: 'sub1', stageId: 's1',
    questions: [], createdBy: 'teacher-1', createdAt: 1,
    ...overrides
  };
}

function assignment(overrides: Partial<HomeworkAssignment> = {}): HomeworkAssignment {
  return {
    id: 'hw1', title: 'Full Year Arabic Quiz', quizId: 0, stageId: 's1', gradeId: 'g1',
    classId: 'c1', dueAt: 1, createdBy: 'teacher-1', createdAt: 1, active: true,
    quizSource: 'custom', customQuizId: 'tq1',
    ...overrides
  } as HomeworkAssignment;
}

/** The aggregate as the triggers maintain it, with sensible defaults. */
function counts(overrides: Partial<StoredQuizCounts> = {}): StoredQuizCounts {
  return {
    updatedAt: 1,
    groups: {},
    unplaced: {},
    stages: { s1: { name: 'Primary', order: 1 } },
    grades: { g1: { name: 'Grade 1', order: 1, stageId: 's1' } },
    classes: {
      c1: { name: 'Class 1-A', stageId: 's1', gradeId: 'g1' },
      c2: { name: 'Class 1-B', stageId: 's1', gradeId: 'g1' }
    },
    teacherPlacements: {},
    ...overrides
  };
}

describe('placeTeacherQuizzes', () => {
  it('places a quiz under the grade and group of the assignment that uses it', () => {
    // A TeacherQuiz carries only `stageId`, so reading the quiz alone would put
    // every one of them under Unassigned Grade → No group.
    const placed = placeTeacherQuizzes([teacherQuiz()], [assignment()]);

    expect(placed).toEqual([{ stageId: 's1', gradeId: 'g1', classId: 'c1' }]);
  });

  it('counts a quiz once per distinct group it is assigned to', () => {
    const placed = placeTeacherQuizzes([teacherQuiz()], [
      assignment({ id: 'hw1', classId: 'c1' }),
      assignment({ id: 'hw2', classId: 'c2' })
    ]);

    expect(placed.map(p => p.classId)).toEqual(['c1', 'c2']);
  });

  it('does not double count two assignments to the same group', () => {
    const placed = placeTeacherQuizzes([teacherQuiz()], [
      assignment({ id: 'hw1', classId: 'c1' }),
      assignment({ id: 'hw2', classId: 'c1' })
    ]);

    expect(placed.length).toBe(1);
  });

  it('keeps an unassigned quiz under its own stage', () => {
    expect(placeTeacherQuizzes([teacherQuiz()], [])).toEqual([{ stageId: 's1' }]);
  });

  it('ignores assignments that use a bank quiz rather than this one', () => {
    const placed = placeTeacherQuizzes([teacherQuiz()], [
      assignment({ quizSource: 'bank', customQuizId: undefined, quizId: 5 }),
      assignment({ id: 'hw2', customQuizId: 'some-other-quiz' })
    ]);

    expect(placed).toEqual([{ stageId: 's1' }]);
  });
});

describe('assembleQuizCounts', () => {
  it('nests groups under their grade and stage, with both counters', () => {
    const tree = assembleQuizCounts(counts({
      groups: { c1: { quizzes: 3, assignments: 2 }, c2: { quizzes: 1, assignments: 0 } }
    }));

    expect(tree.length).toBe(1);
    expect(tree[0].name).toBe('Primary');
    expect(tree[0].count).toBe(4);
    expect(tree[0].assignmentCount).toBe(2);
    expect(tree[0].grades[0].name).toBe('Grade 1');
    expect(tree[0].grades[0].groups.map(g => g.name)).toEqual(['Class 1-A', 'Class 1-B']);
    expect(tree[0].grades[0].groups[0].count).toBe(3);
    expect(tree[0].grades[0].groups[0].assignmentCount).toBe(2);
  });

  it('shows every group, including those with nothing assigned', () => {
    // The old client-side tree built itself from the quiz list, so an empty
    // group simply did not appear — hiding exactly what an admin wants to spot.
    const tree = assembleQuizCounts(counts({ groups: { c1: { quizzes: 1, assignments: 0 } } }));

    const groups = tree[0].grades[0].groups;
    expect(groups.map(g => g.name)).toEqual(['Class 1-A', 'Class 1-B']);
    expect(groups.find(g => g.name === 'Class 1-B')!.count).toBe(0);
  });

  it('shows a stage and grade that have no groups at all', () => {
    const tree = assembleQuizCounts(counts({ classes: {} }));

    expect(tree[0].name).toBe('Primary');
    expect(tree[0].grades[0].name).toBe('Grade 1');
    expect(tree[0].grades[0].groups).toEqual([]);
  });

  it('files a quiz with a stage but no group under that stage, sorted last', () => {
    const tree = assembleQuizCounts(counts({
      groups: { c1: { quizzes: 1, assignments: 0 } },
      unplaced: { s1: { quizzes: 2, assignments: 0 } }
    }));

    const gradeNames = tree[0].grades.map(g => g.name);
    expect(gradeNames).toEqual(['Grade 1', '']);
    expect(tree[0].count).toBe(3);
  });

  it('rescues a class whose stage no longer exists into the unassigned branch', () => {
    // Real case in this project: classes left over from the RTDB migration
    // point at slug stage ids ("stage-primary") that no longer exist. They must
    // surface rather than vanish.
    const tree = assembleQuizCounts(counts({
      classes: { orphan: { name: 'Class 5-A', stageId: 'gone', gradeId: 'also-gone' } },
      groups: { orphan: { quizzes: 4, assignments: 1 } }
    }));

    const unassignedStage = tree.find(s => s.name === '');
    expect(unassignedStage).toBeDefined();
    expect(unassignedStage!.count).toBe(4);
    expect(unassignedStage!.grades[0].groups[0].name).toBe('Class 5-A');
    // And it sorts after the real stage.
    expect(tree[tree.length - 1].name).toBe('');
  });

  it('orders stages and grades by their order field, groups by name', () => {
    const tree = assembleQuizCounts(counts({
      stages: { s1: { name: 'Primary', order: 2 }, s0: { name: 'Nursery', order: 1 } },
      grades: {
        g1: { name: 'Grade 1', order: 2, stageId: 's1' },
        g0: { name: 'Reception', order: 1, stageId: 's1' }
      },
      classes: {
        cB: { name: 'Zebra', stageId: 's1', gradeId: 'g1' },
        cA: { name: 'Alpha', stageId: 's1', gradeId: 'g1' }
      }
    }));

    expect(tree.map(s => s.name)).toEqual(['Nursery', 'Primary']);
    const primary = tree.find(s => s.name === 'Primary')!;
    expect(primary.grades.map(g => g.name)).toEqual(['Reception', 'Grade 1']);
    expect(primary.grades[1].groups.map(g => g.name)).toEqual(['Alpha', 'Zebra']);
  });

  it('returns an empty tree for an empty aggregate rather than throwing', () => {
    expect(assembleQuizCounts({} as StoredQuizCounts)).toEqual([]);
  });
});

describe('summarizeQuizCounts', () => {
  it('totals both counters and reports how many groups hold a quiz', () => {
    const summary = summarizeQuizCounts(assembleQuizCounts(counts({
      groups: { c1: { quizzes: 3, assignments: 2 }, c2: { quizzes: 0, assignments: 0 } }
    })));

    expect(summary.quizzes).toBe(3);
    expect(summary.assignments).toBe(2);
    expect(summary.stages).toBe(1);
    expect(summary.grades).toBe(1);
    expect(summary.groups).toBe(2);
    expect(summary.groupsWithContent).toBe(1);
  });

  it('counts unplaced quizzes in the totals but not as places', () => {
    // The strip has to reconcile with the QUIZZES tile, so a quiz with no group
    // still counts; "1 group" must still mean one group an admin can open.
    const summary = summarizeQuizCounts(assembleQuizCounts(counts({
      classes: { c1: { name: 'Class 1-A', stageId: 's1', gradeId: 'g1' } },
      groups: { c1: { quizzes: 1, assignments: 1 } },
      unplaced: { s1: { quizzes: 4, assignments: 0 } }
    })));

    expect(summary.quizzes).toBe(5);
    expect(summary.assignments).toBe(1);
    expect(summary.grades).toBe(1);
    expect(summary.groups).toBe(1);
    expect(summary.groupsWithContent).toBe(1);
  });

  it('reports zeros for an empty aggregate', () => {
    expect(summarizeQuizCounts([])).toEqual({
      quizzes: 0, assignments: 0, stages: 0, grades: 0, groups: 0, groupsWithContent: 0
    });
  });
});
