import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AdminAccessService, GradeService, StageService, SubjectService, TeacherScopeService } from '../../services/admin';
import { AuthService } from '../../services/auth/auth.service';
import { TeachingMaterialService, uploadProblems } from '../../services/teaching-material.service';
import { Grade, Stage, Subject, TeachingMaterialSummary } from '../../models';
import { MaterialFilePreview, readMaterialFile } from '../../shared/teaching-material-file';
import { BaseComponent } from '../../shared/base/base.component';

/** A grade in a picker, labelled with its stage so same-named grades can be told apart. */
interface GradeOption {
  id: string;
  label: string;
}

/**
 * Teaching Materials: course content uploaded as teaching-summary JSON documents,
 * one per subject and grade, each opening a lesson-by-lesson reader.
 *
 * A teacher uploads for the subjects on their roster record and sees what they
 * uploaded; an application admin sees every teacher's and may delete any, but
 * uploads none (`canUploadTeachingMaterials()`). The API enforces all of it.
 */
@Component({
  selector: 'app-teaching-materials',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule, RouterLink, TranslatePipe],
  templateUrl: './teaching-materials.component.html'
})
export class TeachingMaterialsComponent extends BaseComponent implements OnInit {
  private readonly materialService = inject(TeachingMaterialService);
  private readonly subjectService = inject(SubjectService);
  private readonly gradeService = inject(GradeService);
  private readonly stageService = inject(StageService);
  private readonly teacherScope = inject(TeacherScopeService);
  private readonly authService = inject(AuthService);
  private readonly adminAccess = inject(AdminAccessService);
  private readonly translate = inject(TranslateService);

  readonly canUpload = computed(() => this.adminAccess.getStrategy(this.authService.getUserRoles()).canUploadTeachingMaterials());

  readonly materials = signal<TeachingMaterialSummary[]>([]);
  readonly subjects = signal<Subject[]>([]);
  readonly grades = signal<Grade[]>([]);
  readonly stages = signal<Stage[]>([]);
  /** The subjects on the signed-in teacher's roster record: the only ones they may upload for. */
  readonly mySubjectIds = signal<string[]>([]);
  /** Whether the signed-in teacher has a roster record at all (the API refuses uploads without one). */
  readonly hasTeacherRecord = signal(true);

  readonly subjectFilter = signal('');
  readonly gradeFilter = signal('');
  readonly deletingId = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);

  // ---- upload ----
  readonly uploadOpen = signal(false);
  readonly fileName = signal('');
  readonly fileError = signal<'notJson' | 'notMaterial' | null>(null);
  readonly preview = signal<MaterialFilePreview | null>(null);
  private document: Record<string, unknown> | null = null;
  readonly uploadSubjectId = signal('');
  readonly uploadGradeId = signal('');
  readonly uploading = signal(false);
  readonly problems = signal<string[]>([]);
  readonly uploadedTitle = signal<string | null>(null);

  readonly uploadSubjects = computed(() => {
    const mine = new Set(this.mySubjectIds());
    return this.subjects().filter(subject => mine.has(subject.id));
  });

  readonly gradeOptions = computed<GradeOption[]>(() => {
    const stageNames = new Map(this.stages().map(stage => [stage.id, stage.name]));
    const stageOrder = new Map(this.stages().map(stage => [stage.id, stage.order ?? 0]));
    return [...this.grades()]
      .sort((a, b) => (stageOrder.get(a.stageId) ?? 0) - (stageOrder.get(b.stageId) ?? 0) || (a.order ?? 0) - (b.order ?? 0))
      .map(grade => ({
        id: grade.id,
        label: stageNames.has(grade.stageId) ? `${grade.name} · ${stageNames.get(grade.stageId)}` : grade.name
      }));
  });

  readonly canConfirmUpload = computed(() =>
    !!this.preview() && !!this.uploadSubjectId() && !!this.uploadGradeId() && !this.uploading());

  readonly visibleMaterials = computed(() => this.materials().filter(material =>
    (!this.subjectFilter() || material.subjectId === this.subjectFilter())
    && (!this.gradeFilter() || material.gradeId === this.gradeFilter())));

  private readonly subjectNames = computed(() => new Map(this.subjects().map(subject => [subject.id, subject.name])));
  private readonly gradeLabels = computed(() => new Map(this.gradeOptions().map(grade => [grade.id, grade.label])));

  async ngOnInit(): Promise<void> {
    this.setLoading(true);
    try {
      const [materials, subjects, grades, stages] = await Promise.all([
        this.materialService.list(),
        this.subjectService.listSubjects().then(page => page.items),
        this.gradeService.listGrades().then(page => page.items),
        this.stageService.listStages().then(page => page.items)
      ]);
      this.materials.set(materials);
      this.subjects.set(subjects);
      this.grades.set(grades);
      this.stages.set(stages);
      if (this.canUpload()) await this.loadMySubjects();
      this.setLoading(false);
    } catch (error) {
      this.setError(error instanceof Error ? error.message : String(error));
    }
  }

  subjectName(id: string): string {
    return this.subjectNames().get(id) ?? this.translate.instant('common.na');
  }

  gradeLabel(id: string): string {
    return this.gradeLabels().get(id) ?? this.translate.instant('common.na');
  }

  openUpload(): void {
    this.resetUpload();
    this.uploadOpen.set(true);
  }

  closeUpload(): void {
    this.resetUpload();
    this.uploadOpen.set(false);
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';                                          // picking the same file again still fires
    if (!file) return;

    this.problems.set([]);
    this.uploadedTitle.set(null);
    this.fileName.set(file.name);
    const reading = readMaterialFile(await file.text());
    if ('error' in reading) {
      this.document = null;
      this.preview.set(null);
      this.fileError.set(reading.error);
    } else {
      this.document = reading.document;
      this.preview.set(reading.preview);
      this.fileError.set(null);
      if (this.uploadSubjects().length === 1) this.uploadSubjectId.set(this.uploadSubjects()[0].id);
    }
  }

  async confirmUpload(): Promise<void> {
    const preview = this.preview();
    if (!this.canConfirmUpload() || !this.document || !preview) return;

    this.uploading.set(true);
    this.problems.set([]);
    try {
      await this.materialService.upload(this.uploadSubjectId(), this.uploadGradeId(), this.document);
      this.materials.set(await this.materialService.list());
      this.resetUpload();
      this.uploadedTitle.set(preview.title);
    } catch (error) {
      this.problems.set(uploadProblems(error));
    } finally {
      this.uploading.set(false);
    }
  }

  async remove(material: TeachingMaterialSummary): Promise<void> {
    if (!confirm(this.translate.instant('teachingMaterials.deleteConfirm', { title: material.title }))) return;

    this.deletingId.set(material.id);
    this.actionError.set(null);
    try {
      await this.materialService.remove(material.id);
      this.materials.update(materials => materials.filter(row => row.id !== material.id));
    } catch (error) {
      this.actionError.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.deletingId.set(null);
    }
  }

  private async loadMySubjects(): Promise<void> {
    const user = this.authService.user();
    const teacher = user ? await this.teacherScope.resolveTeacher(user) : null;
    this.hasTeacherRecord.set(teacher !== null);
    this.mySubjectIds.set(teacher?.subjectIds ?? []);
  }

  private resetUpload(): void {
    this.document = null;
    this.fileName.set('');
    this.fileError.set(null);
    this.preview.set(null);
    this.uploadSubjectId.set('');
    this.uploadGradeId.set('');
    this.problems.set([]);
    this.uploadedTitle.set(null);
  }
}
