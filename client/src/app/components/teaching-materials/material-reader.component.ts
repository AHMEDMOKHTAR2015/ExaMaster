import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { GradeService, SubjectService } from '../../services/admin';
import { TeachingMaterialService } from '../../services/teaching-material.service';
import { MaterialLesson, MaterialUnit, TeachingMaterial } from '../../models';
import { InlineTextComponent } from '../../shared/inline-text.component';
import { MaterialLessonComponent } from './material-lesson.component';
import { BaseComponent } from '../../shared/base/base.component';

/** What the reader shows: the front matter, a unit's introduction, or one lesson. */
type ReaderView =
  | { kind: 'overview' }
  | { kind: 'unit'; unit: MaterialUnit }
  | { kind: 'lesson'; unit: MaterialUnit; lesson: MaterialLesson; index: number };

/** A lesson in reading order, across units, for Previous/Next. */
interface LessonStop {
  unit: MaterialUnit;
  lesson: MaterialLesson;
}

/**
 * Reads one teaching material the way a teacher walks a class through it: the
 * front matter, then each unit's big idea and its lessons in order, every block
 * as the book gives it, with the Arabic explanation (right-to-left) beneath.
 *
 * The open view is kept in the URL (`?unit=` / `?lesson=`), so a refresh or a
 * shared link lands on the same page. Who may open which material is the API's
 * decision (the uploader, or a school administrator).
 */
@Component({
  selector: 'app-material-reader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, InlineTextComponent, MaterialLessonComponent],
  templateUrl: './material-reader.component.html'
})
export class MaterialReaderComponent extends BaseComponent implements OnInit {
  private readonly materialService = inject(TeachingMaterialService);
  private readonly subjectService = inject(SubjectService);
  private readonly gradeService = inject(GradeService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly material = signal<TeachingMaterial | null>(null);
  readonly notFound = signal(false);
  readonly subjectName = signal<string | null>(null);
  readonly gradeName = signal<string | null>(null);

  private readonly selectedUnitId = signal<string | null>(null);
  private readonly selectedLessonId = signal<string | null>(null);

  readonly stops = computed<LessonStop[]>(() =>
    (this.material()?.units ?? []).flatMap(unit => unit.lessons.map(lesson => ({ unit, lesson }))));

  readonly view = computed<ReaderView>(() => {
    const material = this.material();
    if (!material) return { kind: 'overview' };

    const lessonId = this.selectedLessonId();
    if (lessonId) {
      const index = this.stops().findIndex(stop => stop.lesson.id === lessonId);
      if (index >= 0) return { kind: 'lesson', ...this.stops()[index], index };
    }
    const unit = material.units.find(candidate => candidate.id === this.selectedUnitId());
    return unit ? { kind: 'unit', unit } : { kind: 'overview' };
  });

  readonly previous = computed<LessonStop | null>(() => {
    const view = this.view();
    return view.kind === 'lesson' && view.index > 0 ? this.stops()[view.index - 1] : null;
  });

  readonly next = computed<LessonStop | null>(() => {
    const view = this.view();
    if (view.kind === 'lesson') return this.stops()[view.index + 1] ?? null;
    if (view.kind === 'unit') return view.unit.lessons[0] ? { unit: view.unit, lesson: view.unit.lessons[0] } : null;
    return this.stops()[0] ?? null;
  });

  /** The last lesson of its unit closes with the unit's key takeaways, as the book does. */
  readonly closesUnit = computed(() => {
    const view = this.view();
    return view.kind === 'lesson' && view.unit.lessons[view.unit.lessons.length - 1]?.id === view.lesson.id;
  });

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    const query = this.route.snapshot.queryParamMap;
    this.selectedUnitId.set(query.get('unit'));
    this.selectedLessonId.set(query.get('lesson'));

    this.setLoading(true);
    try {
      const material = await this.materialService.getById(id);
      if (!material) {
        this.notFound.set(true);
        this.setLoading(false);
        return;
      }
      this.material.set(material);
      // names are labels only: a missing subject or grade still leaves the material readable
      const [subject, grade] = await Promise.all([
        this.subjectService.fetchSubject(material.subjectId).catch(() => null),
        this.gradeService.fetchGrade(material.gradeId).catch(() => null)
      ]);
      this.subjectName.set(subject?.name ?? null);
      this.gradeName.set(grade?.name ?? null);
      this.setLoading(false);
    } catch (error) {
      this.setError(error instanceof Error ? error.message : String(error));
    }
  }

  showOverview(): void {
    this.go(null, null);
  }

  showUnit(unit: MaterialUnit): void {
    this.go(unit.id, null);
  }

  showLesson(stop: LessonStop): void {
    this.go(stop.unit.id, stop.lesson.id);
  }

  isUnitOpen(unit: MaterialUnit): boolean {
    const view = this.view();
    return view.kind !== 'overview' && view.unit.id === unit.id;
  }

  isLessonOpen(lesson: MaterialLesson): boolean {
    const view = this.view();
    return view.kind === 'lesson' && view.lesson.id === lesson.id;
  }

  pages(unit: MaterialUnit): string | null {
    if (unit.bookPageFrom == null) return null;
    return unit.bookPageTo != null && unit.bookPageTo !== unit.bookPageFrom
      ? `${unit.bookPageFrom}–${unit.bookPageTo}`
      : String(unit.bookPageFrom);
  }

  private go(unitId: string | null, lessonId: string | null): void {
    this.selectedUnitId.set(unitId);
    this.selectedLessonId.set(lessonId);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { unit: unitId, lesson: lessonId },
      replaceUrl: true
    });
    // a new page starts at its top, not where the previous one was scrolled to
    document.getElementById('tm-reader-content')?.scrollIntoView({ block: 'start' });
  }
}
