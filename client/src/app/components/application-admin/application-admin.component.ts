import { ServiceError } from '../../services/shared/service-error';
import { Component, signal, inject, computed, effect, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ClickOutsideDirective } from '../../directives';
import {
  StageService,
  GradeService,
  ClassGroupService,
  TeacherService,
  SubjectService,
  AppUserService
} from '../../services/admin';
import { NotificationService } from '../../services/notification.service';
import { Stage, Grade, ClassGroup, Teacher, Subject, User } from '../../models';
import { resolveSubjectTeaching, SubjectTeaching } from '../../shared/teaching';

@Component({
  selector: 'app-application-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, TranslatePipe, ClickOutsideDirective],
  templateUrl: './application-admin.component.html',
})
export class ApplicationAdminComponent {
  private readonly stageService = inject(StageService);
  private readonly gradeService = inject(GradeService);
  private readonly classService = inject(ClassGroupService);
  private readonly teacherService = inject(TeacherService);
  private readonly subjectService = inject(SubjectService);
  private readonly userService = inject(AppUserService);
  private readonly notification = inject(NotificationService);

  // Data signals
  readonly allStages = signal<Stage[]>([]);
  readonly allGrades = signal<Grade[]>([]);
  readonly allClasses = signal<ClassGroup[]>([]);
  readonly allTeachers = signal<Teacher[]>([]);
  readonly allSubjects = signal<Subject[]>([]);
  readonly allStudents = signal<User[]>([]);

  readonly isLoadingStages = signal(false);
  readonly isLoadingGrades = signal(false);
  readonly isLoadingClasses = signal(false);

  // Selection / drill-down state
  readonly selectedStageId = signal<string | null>(null);
  readonly selectedGradeId = signal<string | null>(null);
  readonly classSearchQuery = signal('');

  // Inline form toggles
  readonly showStageForm = signal(false);
  readonly showGradeForm = signal(false);
  readonly showClassForm = signal(false);

  // Stage form fields
  readonly stageId = signal('');
  readonly stageName = signal('');
  readonly stageOrder = signal(1);
  readonly editingStage = signal(false);

  // Grade form fields
  readonly gradeId = signal('');
  readonly gradeName = signal('');
  readonly gradeOrder = signal(1);
  readonly gradeStageId = signal('');
  readonly editingGrade = signal(false);

  // Class form fields
  readonly classId = signal('');
  readonly className = signal('');
  readonly classStageId = signal('');
  readonly classGradeId = signal('');
  readonly classTeacherIds = signal<string[]>([]);
  readonly classSubjectIds = signal<string[]>([]);
  readonly editingClass = signal(false);

  // Teacher chips picker state (inside the class form)
  readonly teacherPickerOpen = signal(false);
  readonly teacherPickerQuery = signal('');

  readonly availableTeachersForPicker = computed(() => {
    const selected = new Set(this.classTeacherIds());
    const q = this.teacherPickerQuery().toLowerCase().trim();
    return this.allTeachers().filter(t => {
      if (selected.has(t.id)) return false;
      if (!q) return true;
      const name = `${t.firstName} ${t.lastName}`.toLowerCase();
      return name.includes(q) || (t.email ?? '').toLowerCase().includes(q);
    });
  });

  readonly selectedTeachersForClassForm = computed(() => {
    const ids = this.classTeacherIds();
    return ids
      .map(id => this.allTeachers().find(t => t.id === id))
      .filter((t): t is Teacher => !!t);
  });

  // Subject chips picker state (inside the class form)
  readonly subjectPickerOpen = signal(false);
  readonly subjectPickerQuery = signal('');

  readonly availableSubjectsForPicker = computed(() => {
    const selected = new Set(this.classSubjectIds());
    const q = this.subjectPickerQuery().toLowerCase().trim();
    return this.allSubjects().filter(s => {
      if (selected.has(s.id)) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q);
    });
  });

  readonly selectedSubjectsForClassForm = computed(() => {
    const ids = this.classSubjectIds();
    return ids
      .map(id => this.allSubjects().find(s => s.id === id))
      .filter((s): s is Subject => !!s);
  });

  // Details drawer state
  readonly detailsClassId = signal<string | null>(null);
  readonly detailsClass = computed(() =>
    this.allClasses().find(c => c.id === this.detailsClassId()) ?? null
  );
  readonly detailsTeachers = computed(() => {
    const cls = this.detailsClass();
    if (!cls?.teacherIds?.length) return [] as Teacher[];
    return cls.teacherIds
      .map(id => this.allTeachers().find(t => t.id === id))
      .filter((t): t is Teacher => !!t);
  });
  readonly detailsSubjects = computed(() => {
    const cls = this.detailsClass();
    if (!cls?.subjectIds?.length) return [] as Subject[];
    return cls.subjectIds
      .map(id => this.allSubjects().find(s => s.id === id))
      .filter((s): s is Subject => !!s);
  });
  readonly detailsStudents = computed(() => {
    const cls = this.detailsClass();
    if (!cls) return [] as User[];
    return this.allStudents().filter(u => u.classId === cls.id);
  });
  // Per-subject teacher coverage for the class: which assigned teacher educates each subject.
  readonly detailsTeaching = computed<SubjectTeaching[]>(() =>
    resolveSubjectTeaching(this.detailsClass(), this.allTeachers())
  );
  // How many of the class's subjects actually have a teacher assigned.
  readonly detailsCoverage = computed(() => {
    const teaching = this.detailsTeaching();
    const covered = teaching.filter(r => r.teacherIds.length > 0).length;
    return { covered, total: teaching.length };
  });

  readonly stagesSortedByOrder = computed(() =>
    [...this.allStages()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  );

  readonly selectedStage = computed(() =>
    this.allStages().find(s => s.id === this.selectedStageId()) ?? null
  );

  readonly gradesForSelectedStage = computed(() => {
    const stageId = this.selectedStageId();
    if (!stageId) return [];
    return this.allGrades()
      .filter(g => g.stageId === stageId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  });

  readonly gradesForClassForm = computed(() => {
    const stageId = this.classStageId();
    if (!stageId) return [];
    return this.allGrades()
      .filter(g => g.stageId === stageId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  });

  readonly classesForSelectedStage = computed(() => {
    const stageId = this.selectedStageId();
    const gradeId = this.selectedGradeId();
    let list = stageId
      ? this.allClasses().filter(c => c.stageId === stageId)
      : this.allClasses();
    if (gradeId) {
      list = list.filter(c => c.gradeId === gradeId);
    }
    const q = this.classSearchQuery().toLowerCase().trim();
    if (q) {
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.teacherIds ?? []).some(id => this.getTeacherName(id).toLowerCase().includes(q)) ||
        (c.subjectIds ?? []).some(id => this.getSubjectName(id).toLowerCase().includes(q))
      );
    }
    return list;
  });

  constructor() {
    this.loadAllStages();
    this.loadAllGrades();
    this.loadAllClasses();
    this.loadAllTeachers();
    this.loadAllSubjects();
    this.loadAllStudents();

    // Auto-select the first stage so the user always sees a populated detail section.
    effect(() => {
      const stages = this.stagesSortedByOrder();
      if (!this.selectedStageId() && stages.length > 0) {
        this.selectedStageId.set(stages[0].id);
      }
    });
  }

  // ------------------------- Loaders -------------------------

  async loadAllStages(): Promise<void> {
    this.isLoadingStages.set(true);
    try {
      let cursor: string | undefined;
      const items: Stage[] = [];
      do {
        const result = await this.stageService.listStages(50, cursor);
        items.push(...result.items);
        cursor = result.nextCursor;
      } while (cursor);
      this.allStages.set(items);
      if (!this.editingStage()) this.stageId.set(this.getNextStageId());
    } finally {
      this.isLoadingStages.set(false);
    }
  }

  async loadAllGrades(): Promise<void> {
    this.isLoadingGrades.set(true);
    try {
      let cursor: string | undefined;
      const items: Grade[] = [];
      do {
        const result = await this.gradeService.listGrades(50, cursor);
        items.push(...result.items);
        cursor = result.nextCursor;
      } while (cursor);
      this.allGrades.set(items);
      if (!this.editingGrade()) this.gradeId.set(this.getNextGradeId());
    } finally {
      this.isLoadingGrades.set(false);
    }
  }

  async loadAllClasses(): Promise<void> {
    this.isLoadingClasses.set(true);
    try {
      let cursor: string | undefined;
      const items: ClassGroup[] = [];
      do {
        const result = await this.classService.listClasses(50, cursor);
        items.push(...result.items);
        cursor = result.nextCursor;
      } while (cursor);
      this.allClasses.set(items);
      if (!this.editingClass()) this.classId.set(this.getNextClassId());
    } finally {
      this.isLoadingClasses.set(false);
    }
  }

  async loadAllTeachers(): Promise<void> {
    let cursor: string | undefined;
    const items: Teacher[] = [];
    do {
      const result = await this.teacherService.listTeachers(50, cursor);
      items.push(...result.items);
      cursor = result.nextCursor;
    } while (cursor);
    this.allTeachers.set(items);
  }

  async loadAllSubjects(): Promise<void> {
    let cursor: string | undefined;
    const items: Subject[] = [];
    do {
      const result = await this.subjectService.listSubjects(50, cursor);
      items.push(...result.items);
      cursor = result.nextCursor;
    } while (cursor);
    this.allSubjects.set(items);
  }

  async loadAllStudents(): Promise<void> {
    let cursor: string | undefined;
    const all: User[] = [];
    do {
      const result = await this.userService.listUsers(100, cursor);
      all.push(...result.items);
      cursor = result.nextCursor;
    } while (cursor);
    this.allStudents.set(all.filter(u => u.accountType === 'child'));
  }

  // ------------------------- Helpers -------------------------

  getStageVariant(index: number): 'mint' | 'sky' | 'brand' | 'amber' {
    const variants: ('mint' | 'sky' | 'brand' | 'amber')[] = ['mint', 'sky', 'brand', 'amber'];
    return variants[index % variants.length];
  }

  getGradeCountForStage(stageId: string): number {
    return this.allGrades().filter(g => g.stageId === stageId).length;
  }

  getClassCountForStage(stageId: string): number {
    return this.allClasses().filter(c => c.stageId === stageId).length;
  }

  getClassCountForGrade(gradeId: string): number {
    return this.allClasses().filter(c => c.gradeId === gradeId).length;
  }

  getStudentCountForStage(stageId: string): number {
    return this.allStudents().filter(u => u.stageId === stageId).length;
  }

  getStudentCountForGrade(gradeId: string): number {
    return this.allStudents().filter(u => u.gradeId === gradeId).length;
  }

  getStudentCountForClass(classId: string): number {
    return this.allStudents().filter(u => u.classId === classId).length;
  }

  getStageName(stageId: string | undefined): string {
    if (!stageId) return '—';
    return this.allStages().find(s => s.id === stageId)?.name ?? stageId;
  }

  getGradeName(gradeId: string | undefined): string {
    if (!gradeId) return '—';
    return this.allGrades().find(g => g.id === gradeId)?.name ?? gradeId;
  }

  getTeacherName(teacherId: string | undefined): string {
    if (!teacherId) return '';
    const t = this.allTeachers().find(t => t.id === teacherId);
    return t ? `${t.firstName} ${t.lastName}`.trim() : '';
  }

  getTeacherInitials(teacherId: string | undefined): string {
    if (!teacherId) return '?';
    const t = this.allTeachers().find(t => t.id === teacherId);
    if (!t) return '?';
    const f = (t.firstName?.[0] ?? '').toUpperCase();
    const l = (t.lastName?.[0] ?? '').toUpperCase();
    return (f + l) || '?';
  }

  getSubjectName(subjectId: string | undefined): string {
    if (!subjectId) return '';
    return this.allSubjects().find(s => s.id === subjectId)?.name ?? '';
  }

  getSubjectColor(subjectId: string | undefined): string | undefined {
    if (!subjectId) return undefined;
    return this.allSubjects().find(s => s.id === subjectId)?.color;
  }

  /** Subjects this teacher educates within the currently-open class. */
  getClassSubjectsForTeacher(teacherId: string): Subject[] {
    const cls = this.detailsClass();
    if (!cls?.subjectIds?.length) return [];
    const teacher = this.allTeachers().find(t => t.id === teacherId);
    if (!teacher) return [];
    const teaches = new Set(teacher.subjectIds ?? []);
    return cls.subjectIds
      .filter(id => teaches.has(id))
      .map(id => this.allSubjects().find(s => s.id === id))
      .filter((s): s is Subject => !!s);
  }

  /** Close whichever popup/modal is open on Escape. */
  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.detailsClassId()) { this.closeDetails(); return; }
    if (this.showClassForm()) { this.closeClassForm(); return; }
    if (this.showGradeForm()) { this.closeGradeForm(); return; }
    if (this.showStageForm()) { this.closeStageForm(); return; }
  }

  onClassSearchChange(query: string): void {
    this.classSearchQuery.set(query);
  }

  // ------------------------- Selection -------------------------

  selectStage(stageId: string): void {
    this.selectedStageId.set(stageId);
    this.selectedGradeId.set(null);
    if (this.editingClass()) this.clearClassForm();
    if (this.editingGrade()) this.clearGradeForm();
  }

  selectGrade(gradeId: string | null): void {
    this.selectedGradeId.set(this.selectedGradeId() === gradeId ? null : gradeId);
  }

  // ------------------------- Stage CRUD -------------------------

  openStageForm(): void {
    this.clearStageForm();
    this.showStageForm.set(true);
  }
  closeStageForm(): void {
    this.clearStageForm();
    this.showStageForm.set(false);
  }
  clearStageForm(): void {
    this.stageId.set(this.getNextStageId());
    this.stageName.set('');
    this.stageOrder.set(1);
    this.editingStage.set(false);
  }
  editStage(stage: Stage): void {
    this.stageId.set(stage.id);
    this.stageName.set(stage.name);
    this.stageOrder.set(stage.order);
    this.editingStage.set(true);
    this.showStageForm.set(true);
  }
  async saveStage(): Promise<void> {
    const stage: Stage = {
      id: this.stageId().trim(),
      name: this.stageName().trim(),
      order: Number(this.stageOrder()) || 1
    };
    if (!stage.id || !stage.name) {
      this.notification.warning('Stage name is required.');
      return;
    }
    try {
      const wasEditing = this.editingStage();
      if (wasEditing) await this.stageService.updateStage(stage);
      else await this.stageService.createStage(stage);
      this.notification.success(wasEditing ? 'Stage updated.' : 'Stage created.');
      this.closeStageForm();
      await this.loadAllStages();
      if (!wasEditing) this.selectedStageId.set(stage.id);
    } catch (e) {
      this.notification.error('Failed to save stage.');
      console.error(e);
    }
  }
  async deleteStage(stageId: string): Promise<void> {
    if (!confirm('Delete this stage? A stage that still has grades or classes cannot be deleted.')) return;
    try {
      await this.stageService.deleteStage(stageId);
      this.notification.success('Stage deleted.');
      if (this.selectedStageId() === stageId) this.selectedStageId.set(null);
      await this.loadAllStages();
    } catch (e) {
      this.notification.error(e instanceof ServiceError ? e.message : 'Failed to delete stage.');
      console.error(e);
    }
  }
  private getNextStageId(): string {
    const ids = this.allStages().map(s => parseInt(s.id, 10)).filter(n => !isNaN(n));
    return String((ids.length ? Math.max(...ids) : 0) + 1);
  }

  // ------------------------- Grade CRUD -------------------------

  openGradeForm(stageId?: string): void {
    this.clearGradeForm();
    if (stageId) this.gradeStageId.set(stageId);
    else if (this.selectedStageId()) this.gradeStageId.set(this.selectedStageId()!);
    this.showGradeForm.set(true);
  }
  closeGradeForm(): void {
    this.clearGradeForm();
    this.showGradeForm.set(false);
  }
  clearGradeForm(): void {
    this.gradeId.set(this.getNextGradeId());
    this.gradeName.set('');
    this.gradeOrder.set(1);
    this.gradeStageId.set('');
    this.editingGrade.set(false);
  }
  editGrade(grade: Grade): void {
    this.gradeId.set(grade.id);
    this.gradeName.set(grade.name);
    this.gradeOrder.set(grade.order ?? 1);
    this.gradeStageId.set(grade.stageId);
    this.editingGrade.set(true);
    this.showGradeForm.set(true);
  }
  async saveGrade(): Promise<void> {
    const grade: Grade = {
      id: this.gradeId().trim(),
      stageId: this.gradeStageId().trim(),
      name: this.gradeName().trim(),
      order: Number(this.gradeOrder()) || 1
    };
    if (!grade.id || !grade.name || !grade.stageId) {
      this.notification.warning('Grade name and stage are required.');
      return;
    }
    try {
      if (this.editingGrade()) await this.gradeService.updateGrade(grade);
      else await this.gradeService.createGrade(grade);
      this.notification.success(this.editingGrade() ? 'Grade updated.' : 'Grade created.');
      this.closeGradeForm();
      await this.loadAllGrades();
    } catch (e) {
      this.notification.error('Failed to save grade.');
      console.error(e);
    }
  }
  async deleteGrade(gradeId: string): Promise<void> {
    if (!confirm('Delete this grade? A grade that still has classes cannot be deleted.')) return;
    try {
      await this.gradeService.deleteGrade(gradeId);
      this.notification.success('Grade deleted.');
      if (this.selectedGradeId() === gradeId) this.selectedGradeId.set(null);
      await this.loadAllGrades();
    } catch (e) {
      this.notification.error(e instanceof ServiceError ? e.message : 'Failed to delete grade.');
      console.error(e);
    }
  }
  private getNextGradeId(): string {
    const ids = this.allGrades().map(g => parseInt(g.id, 10)).filter(n => !isNaN(n));
    return String((ids.length ? Math.max(...ids) : 0) + 1);
  }

  // ------------------------- Class CRUD -------------------------

  openClassForm(stageId?: string, gradeId?: string): void {
    this.clearClassForm();
    if (stageId) this.classStageId.set(stageId);
    else if (this.selectedStageId()) this.classStageId.set(this.selectedStageId()!);
    if (gradeId) this.classGradeId.set(gradeId);
    else if (this.selectedGradeId()) this.classGradeId.set(this.selectedGradeId()!);
    this.showClassForm.set(true);
  }
  closeClassForm(): void {
    this.clearClassForm();
    this.showClassForm.set(false);
  }
  clearClassForm(): void {
    this.classId.set(this.getNextClassId());
    this.className.set('');
    this.classStageId.set('');
    this.classGradeId.set('');
    this.classTeacherIds.set([]);
    this.classSubjectIds.set([]);
    this.editingClass.set(false);
    this.teacherPickerOpen.set(false);
    this.teacherPickerQuery.set('');
    this.subjectPickerOpen.set(false);
    this.subjectPickerQuery.set('');
  }
  editClass(cls: ClassGroup): void {
    this.classId.set(cls.id);
    this.className.set(cls.name);
    this.classStageId.set(cls.stageId);
    this.classGradeId.set(cls.gradeId);
    this.classTeacherIds.set([...(cls.teacherIds ?? [])]);
    this.classSubjectIds.set([...(cls.subjectIds ?? [])]);
    this.editingClass.set(true);
    this.showClassForm.set(true);
    this.teacherPickerOpen.set(false);
    this.teacherPickerQuery.set('');
    this.subjectPickerOpen.set(false);
    this.subjectPickerQuery.set('');
  }

  toggleTeacherPicker(): void {
    this.teacherPickerOpen.update(v => !v);
    if (!this.teacherPickerOpen()) this.teacherPickerQuery.set('');
  }
  addTeacherToClass(teacherId: string): void {
    if (!teacherId) return;
    this.classTeacherIds.update(ids => ids.includes(teacherId) ? ids : [...ids, teacherId]);
    this.teacherPickerQuery.set('');
  }
  removeTeacherFromClass(teacherId: string): void {
    this.classTeacherIds.update(ids => ids.filter(id => id !== teacherId));
  }

  toggleSubjectPicker(): void {
    this.subjectPickerOpen.update(v => !v);
    if (!this.subjectPickerOpen()) this.subjectPickerQuery.set('');
  }
  addSubjectToClass(subjectId: string): void {
    if (!subjectId) return;
    this.classSubjectIds.update(ids => ids.includes(subjectId) ? ids : [...ids, subjectId]);
    this.subjectPickerQuery.set('');
  }
  removeSubjectFromClass(subjectId: string): void {
    this.classSubjectIds.update(ids => ids.filter(id => id !== subjectId));
  }

  // Details drawer
  openDetails(classId: string): void {
    this.detailsClassId.set(classId);
  }
  closeDetails(): void {
    this.detailsClassId.set(null);
  }
  editFromDetails(): void {
    const cls = this.detailsClass();
    if (!cls) return;
    this.closeDetails();
    this.editClass(cls);
  }
  onClassStageChange(stageId: string): void {
    this.classStageId.set(stageId);
    // Reset grade selection when stage changes — old gradeId likely doesn't belong to the new stage.
    if (!this.allGrades().some(g => g.id === this.classGradeId() && g.stageId === stageId)) {
      this.classGradeId.set('');
    }
  }
  async saveClass(): Promise<void> {
    const teacherIds = this.classTeacherIds().filter(Boolean);
    const subjectIds = this.classSubjectIds().filter(Boolean);
    const group: ClassGroup = {
      id: this.classId().trim(),
      name: this.className().trim(),
      stageId: this.classStageId().trim(),
      gradeId: this.classGradeId().trim(),
      teacherIds: teacherIds.length > 0 ? teacherIds : undefined,
      subjectIds: subjectIds.length > 0 ? subjectIds : undefined
    };
    if (!group.id || !group.name || !group.stageId || !group.gradeId) {
      this.notification.warning('Class name, stage, and grade are required.');
      return;
    }
    try {
      if (this.editingClass()) await this.classService.updateClass(group);
      else await this.classService.createClass(group);
      this.notification.success(this.editingClass() ? 'Class updated.' : 'Class created.');
      this.closeClassForm();
      await this.loadAllClasses();
    } catch (e) {
      this.notification.error('Failed to save class.');
      console.error(e);
    }
  }
  async deleteClass(classId: string): Promise<void> {
    if (!confirm('Delete this class?')) return;
    try {
      await this.classService.deleteClass(classId);
      this.notification.success('Class deleted.');
      await this.loadAllClasses();
    } catch (e) {
      this.notification.error(e instanceof ServiceError ? e.message : 'Failed to delete class.');
      console.error(e);
    }
  }
  private getNextClassId(): string {
    const ids = this.allClasses().map(c => parseInt(c.id, 10)).filter(n => !isNaN(n));
    return String((ids.length ? Math.max(...ids) : 0) + 1);
  }
}
