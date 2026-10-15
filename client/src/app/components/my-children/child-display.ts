import { Injectable, inject, signal } from '@angular/core';
import { ClassGroupService, GradeService, StageService, SubjectService, TeacherService } from '../../services/admin';
import { ClassGroup, Grade, PagedResult, Stage, Subject, Teacher, User } from '../../models';

/** Where a child sits in the school, by name; `undefined` where the school has no such level (a stage without grades). */
export interface ChildPlacement {
  stage?: string;
  grade?: string;
  group?: string;
}

/**
 * The school's structure, loaded once per page, for turning a child's ids into
 * names. Provided by each My Children page rather than in root: nothing in the
 * read path caches, and a page that is left is loaded afresh when it returns.
 */
@Injectable()
export class SchoolStructureLookup {
  private readonly stageService = inject(StageService);
  private readonly gradeService = inject(GradeService);
  private readonly classService = inject(ClassGroupService);
  private readonly teacherService = inject(TeacherService);
  private readonly subjectService = inject(SubjectService);

  readonly stages = signal<Stage[]>([]);
  readonly grades = signal<Grade[]>([]);
  readonly classes = signal<ClassGroup[]>([]);
  readonly teachers = signal<Teacher[]>([]);
  readonly subjects = signal<Subject[]>([]);

  /** Stages, grades and groups; with `teaching`, the teachers and subjects too (the child profile's Teachers card). */
  async load(teaching = false): Promise<void> {
    const [stages, grades, classes, teachers, subjects] = await Promise.all([
      allPages(cursor => this.stageService.listStages(50, cursor)),
      allPages(cursor => this.gradeService.listGrades(50, cursor)),
      allPages(cursor => this.classService.listClasses(50, cursor)),
      teaching ? allPages(cursor => this.teacherService.listTeachers(50, cursor)) : Promise.resolve([]),
      teaching ? allPages(cursor => this.subjectService.listSubjects(50, cursor)) : Promise.resolve([])
    ]);
    this.stages.set(stages);
    this.grades.set(grades);
    this.classes.set(classes);
    this.teachers.set(teachers);
    this.subjects.set(subjects);
  }

  placementOf(child: User): ChildPlacement {
    return {
      stage: this.stages().find(stage => stage.id === child.stageId)?.name,
      grade: this.grades().find(grade => grade.id === child.gradeId)?.name,
      group: this.classes().find(group => group.id === child.classId)?.name
    };
  }

  classOf(child: User): ClassGroup | undefined {
    return this.classes().find(group => group.id === child.classId);
  }

  subject(subjectId: string | undefined): Subject | undefined {
    return subjectId ? this.subjects().find(subject => subject.id === subjectId) : undefined;
  }
}

async function allPages<T>(fetch: (cursor?: string) => Promise<PagedResult<T>>): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  do {
    const page = await fetch(cursor);
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return items;
}

/** A colour per child, steady across visits: the same child keeps the same avatar. */
export function avatarVariant(id: string | undefined): 'brand' | 'mint' | 'sky' | 'amber' {
  const variants = ['brand', 'mint', 'sky', 'amber'] as const;
  return variants[Number(id ?? 0) % variants.length] ?? 'brand';
}

export function initials(name: string | undefined): string {
  return (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?';
}
