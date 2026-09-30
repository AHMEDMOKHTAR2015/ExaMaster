/**
 * The Stage → Grade → Group quiz-count tree behind the application admin's
 * "Quizzes by Grade & Group" popup.
 *
 * Pure functions only — no Angular, no Firebase — so the placement rules can be
 * tested directly rather than through a component with a dozen injected
 * services.
 */

import { ClassGroup, Grade, HomeworkAssignment, Stage, TeacherQuiz } from '../models';

/** Bucket key for a level a quiz does not specify. */
export const UNASSIGNED = '__unassigned';

/** Bucket for content naming neither a class nor a stage. Mirrors NO_PLACEMENT server-side. */
export const NO_PLACEMENT = '_none';

/** The two counters held per bucket. */
export interface QuizCountBucket {
  quizzes: number;
  assignments: number;
}

/**
 * The counts behind the tree, as {@link countQuizzes} builds them.
 */
export interface StoredQuizCounts {
  updatedAt: number;
  groups: Record<string, QuizCountBucket>;
  unplaced: Record<string, QuizCountBucket>;
  stages: Record<string, { name: string; order: number }>;
  grades: Record<string, { name: string; order: number; stageId: string }>;
  classes: Record<string, { name: string; stageId: string; gradeId: string }>;
  /** Bucket keys each teacher quiz contributes to; server-side bookkeeping. */
  teacherPlacements: Record<string, string[]>;
}

/** One Group leaf in the breakdown. */
export interface QuizCountGroup {
  id: string;
  name: string;
  /** Quizzes — kept as `count` so it still reconciles with the QUIZZES tile. */
  count: number;
  assignmentCount: number;
}

/** One Grade branch, holding its Groups. */
export interface QuizCountGrade {
  id: string;
  name: string;
  count: number;
  assignmentCount: number;
  groups: QuizCountGroup[];
}

/** One Stage branch, holding its Grades. */
export interface QuizCountStage {
  id: string;
  name: string;
  count: number;
  assignmentCount: number;
  grades: QuizCountGrade[];
}

/**
 * What the tree needs from a quiz-like record. Satisfied directly by the admin
 * bank's `QuizAdminItem`; teacher-authored quizzes are resolved into this shape
 * by {@link placeTeacherQuizzes}.
 */
export interface QuizBreakdownSource {
  stageId?: string;
  gradeId?: string;
  classId?: string;
}

/**
 * Locate each teacher-authored quiz in the tree.
 *
 * A `TeacherQuiz` carries only `stageId` and `subjectId` — the builder never
 * asks for a grade or a group, because a teacher authors a quiz once and then
 * assigns it. The grade and group therefore live on the `homeworkAssignment`
 * that uses it (`quizSource === 'custom'`, with `customQuizId` pointing back at
 * the quiz), which is what this resolves. Reading only the quiz put every
 * teacher quiz under "Unassigned Grade → No group" however it was assigned.
 *
 * A quiz assigned to several groups is counted once in each: the tree answers
 * "what does this group have?", so a quiz set for three classes genuinely
 * belongs under all three. A quiz with no assignment keeps its stage and falls
 * into the unassigned buckets beneath it — which is then an accurate statement
 * rather than a gap.
 */
export function placeTeacherQuizzes(
  teacherQuizzes: TeacherQuiz[],
  assignments: HomeworkAssignment[]
): QuizBreakdownSource[] {
  const assignmentsByQuiz = new Map<string, HomeworkAssignment[]>();
  for (const assignment of assignments) {
    if (assignment.quizSource !== 'custom' || !assignment.customQuizId) continue;
    const list = assignmentsByQuiz.get(assignment.customQuizId) ?? [];
    list.push(assignment);
    assignmentsByQuiz.set(assignment.customQuizId, list);
  }

  return teacherQuizzes.flatMap(quiz => {
    const placements = assignmentsByQuiz.get(quiz.id) ?? [];
    if (placements.length === 0) return [{ stageId: quiz.stageId }];

    // The same quiz assigned twice to one group is still one placement.
    const seen = new Set<string>();
    return placements
      .filter(a => {
        const key = `${a.stageId}|${a.gradeId ?? ''}|${a.classId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(a => ({
        // The assignment wins over the quiz's own stage: it is the more
        // specific statement of where the quiz is actually being used.
        stageId: a.stageId ?? quiz.stageId,
        gradeId: a.gradeId,
        classId: a.classId
      }));
  });
}

/** Everything {@link countQuizzes} reads: the whole school, as the API returns it. */
export interface QuizCountInput {
  stages: Stage[];
  grades: Grade[];
  classes: ClassGroup[];
  bankQuizzes: QuizBreakdownSource[];
  teacherQuizzes: TeacherQuiz[];
  assignments: HomeworkAssignment[];
}

/**
 * Count the school's quizzes and assignments into Group buckets (content with
 * a class) and unplaced buckets (a stage but no class, or neither).
 *
 * Every group appears, including those with no content, so an admin can see
 * which groups have nothing yet. A teacher quiz is placed by its assignments
 * ({@link placeTeacherQuizzes}): counted in every group it is set for, or under
 * its stage when it is set for none.
 */
export function countQuizzes(input: QuizCountInput, now = Date.now()): StoredQuizCounts {
  const counts: StoredQuizCounts = {
    updatedAt: now, groups: {}, unplaced: {}, stages: {}, grades: {}, classes: {}, teacherPlacements: {}
  };
  for (const stage of input.stages) counts.stages[stage.id] = { name: stage.name ?? stage.id, order: stage.order ?? 0 };
  for (const grade of input.grades) {
    counts.grades[grade.id] = { name: grade.name ?? grade.id, order: grade.order ?? 0, stageId: grade.stageId ?? '' };
  }
  for (const cls of input.classes) {
    counts.classes[cls.id] = { name: cls.name ?? cls.id, stageId: cls.stageId ?? '', gradeId: cls.gradeId ?? '' };
    counts.groups[cls.id] = { quizzes: 0, assignments: 0 };
  }

  const bucketFor = (placement: QuizBreakdownSource): QuizCountBucket => placement.classId
    ? (counts.groups[placement.classId] ??= { quizzes: 0, assignments: 0 })
    : (counts.unplaced[placement.stageId || NO_PLACEMENT] ??= { quizzes: 0, assignments: 0 });

  for (const quiz of input.bankQuizzes) bucketFor(quiz).quizzes++;
  for (const assignment of input.assignments) bucketFor(assignment).assignments++;
  for (const placed of placeTeacherQuizzes(input.teacherQuizzes, input.assignments)) bucketFor(placed).quizzes++;
  return counts;
}

/** The roll-up shown above the tree, so the popup opens on an answer. */
export interface QuizCountSummary {
  quizzes: number;
  assignments: number;
  /** Real stages/grades/groups — the unassigned buckets are not places. */
  stages: number;
  grades: number;
  groups: number;
  /** Groups holding at least one quiz; the rest render as visibly empty. */
  groupsWithContent: number;
}

/** Real levels only: the unassigned buckets carry counts but aren't places. */
const isPlace = (id: string) => id !== UNASSIGNED;

/** Groups of a grade that name an actual class. */
export function realGroups(groups: QuizCountGroup[]): QuizCountGroup[] {
  return groups.filter(group => isPlace(group.id));
}

/**
 * Totals across the whole tree.
 *
 * Quizzes and assignments include the unassigned buckets — they are real
 * content, and hiding them here would make the strip disagree with the QUIZZES
 * tile. The structural counts exclude them, because "5 groups" should mean five
 * groups an admin can actually open.
 */
export function summarizeQuizCounts(stages: QuizCountStage[]): QuizCountSummary {
  const summary: QuizCountSummary = {
    quizzes: 0,
    assignments: 0,
    stages: 0,
    grades: 0,
    groups: 0,
    groupsWithContent: 0
  };

  for (const stage of stages) {
    summary.quizzes += stage.count;
    summary.assignments += stage.assignmentCount;
    if (isPlace(stage.id)) summary.stages++;

    for (const grade of stage.grades) {
      if (isPlace(grade.id)) summary.grades++;
      for (const group of realGroups(grade.groups)) {
        summary.groups++;
        if (group.count > 0) summary.groupsWithContent++;
      }
    }
  }

  return summary;
}

/**
 * Turn the stored aggregate into the Stage → Grade → Group tree the popup
 * renders.
 *
 * Reads from the label maps rather than from the counts, so every stage, grade
 * and group appears even with nothing assigned to it — an admin can see which
 * groups are still empty, which the old client-side tree hid by building itself
 * out of the quiz list.
 *
 * Anything whose parent is missing — a class pointing at a stage that has since
 * been deleted, for instance — falls into the unassigned bucket for that level
 * rather than disappearing. Those buckets always sort last.
 */
export function assembleQuizCounts(counts: StoredQuizCounts): QuizCountStage[] {
  const stages = counts.stages ?? {};
  const grades = counts.grades ?? {};
  const classes = counts.classes ?? {};
  const groups = counts.groups ?? {};
  const unplaced = counts.unplaced ?? {};

  const zero = (): QuizCountBucket => ({ quizzes: 0, assignments: 0 });
  const tree = new Map<string, Map<string, Map<string, QuizCountBucket>>>();

  const gradeMapFor = (stageId: string) => {
    const existing = tree.get(stageId);
    if (existing) return existing;
    const fresh = new Map<string, Map<string, QuizCountBucket>>();
    tree.set(stageId, fresh);
    return fresh;
  };
  const classMapFor = (stageId: string, gradeId: string) => {
    const gradeMap = gradeMapFor(stageId);
    const existing = gradeMap.get(gradeId);
    if (existing) return existing;
    const fresh = new Map<string, QuizCountBucket>();
    gradeMap.set(gradeId, fresh);
    return fresh;
  };

  // Empty branches first, so a stage or grade with nothing under it still shows.
  for (const stageId of Object.keys(stages)) gradeMapFor(stageId);
  for (const [gradeId, grade] of Object.entries(grades)) {
    classMapFor(stages[grade.stageId] ? grade.stageId : UNASSIGNED, gradeId);
  }

  for (const [classId, cls] of Object.entries(classes)) {
    const stageId = stages[cls.stageId] ? cls.stageId : UNASSIGNED;
    const gradeId = grades[cls.gradeId] ? cls.gradeId : UNASSIGNED;
    classMapFor(stageId, gradeId).set(classId, groups[classId] ?? zero());
  }

  // Content with a stage but no group, plus anything with neither.
  for (const [key, bucket] of Object.entries(unplaced)) {
    const stageId = key !== NO_PLACEMENT && stages[key] ? key : UNASSIGNED;
    classMapFor(stageId, UNASSIGNED).set(UNASSIGNED, bucket);
  }

  const byOrder = (keys: string[], order: Map<string, number>) =>
    [...keys].sort((a, b) => {
      if (a === UNASSIGNED) return 1;
      if (b === UNASSIGNED) return -1;
      return (order.get(a) ?? 0) - (order.get(b) ?? 0);
    });

  const stageOrder = new Map(Object.entries(stages).map(([id, s]) => [id, s.order ?? 0]));
  const gradeOrder = new Map(Object.entries(grades).map(([id, g]) => [id, g.order ?? 0]));

  const sum = (buckets: QuizCountBucket[], field: keyof QuizCountBucket) =>
    buckets.reduce((total, b) => total + (b[field] ?? 0), 0);

  return byOrder([...tree.keys()], stageOrder).map(stageId => {
    const gradeMap = tree.get(stageId)!;

    const gradesOut: QuizCountGrade[] = byOrder([...gradeMap.keys()], gradeOrder).map(gradeId => {
      const classMap = gradeMap.get(gradeId)!;
      const groupsOut: QuizCountGroup[] = [...classMap.keys()]
        .sort((a, b) => {
          if (a === UNASSIGNED) return 1;
          if (b === UNASSIGNED) return -1;
          return (classes[a]?.name ?? a).localeCompare(classes[b]?.name ?? b);
        })
        .map(classId => {
          const bucket = classMap.get(classId)!;
          return {
            id: classId,
            name: classId === UNASSIGNED ? '' : (classes[classId]?.name ?? classId),
            count: bucket.quizzes ?? 0,
            assignmentCount: bucket.assignments ?? 0
          };
        });

      const buckets = [...classMap.values()];
      return {
        id: gradeId,
        name: gradeId === UNASSIGNED ? '' : (grades[gradeId]?.name ?? gradeId),
        count: sum(buckets, 'quizzes'),
        assignmentCount: sum(buckets, 'assignments'),
        groups: groupsOut
      };
    });

    return {
      id: stageId,
      name: stageId === UNASSIGNED ? '' : (stages[stageId]?.name ?? stageId),
      count: gradesOut.reduce((t, g) => t + g.count, 0),
      assignmentCount: gradesOut.reduce((t, g) => t + g.assignmentCount, 0),
      grades: gradesOut
    };
  });
}
