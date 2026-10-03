import { ServiceError } from '../../services/shared/service-error';
import { Component, DestroyRef, signal, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { debounced } from '../../shared/debounce';

import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ClickOutsideDirective } from '../../directives';
import {
  TeacherService,
  SubjectService,
  ClassGroupService,
  StageService,
  AppUserService,
  TeacherAccountService
} from '../../services/admin';
import { NotificationService } from '../../services/notification.service';
import { PagedList } from '../../shared/paged-list';
import { Teacher, Subject, ClassGroup, Stage, User } from '../../models';
import { studentsForTeacher } from '../../shared/teaching';

interface TeacherForm {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  photoURL: string;
  subjectIds: string[];
  classIds: string[];
}

@Component({
    selector: 'app-teachers-admin',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, TranslatePipe, ClickOutsideDirective],
    templateUrl: './teachers-admin.component.html'
})
export class TeachersAdminComponent {
  private readonly teacherService = inject(TeacherService);
  private readonly subjectService = inject(SubjectService);
  private readonly classService = inject(ClassGroupService);
  private readonly stageService = inject(StageService);
  private readonly userService = inject(AppUserService);
  private readonly teacherAccountService = inject(TeacherAccountService);
  private readonly notification = inject(NotificationService);

  /**
   * Every teacher — the source for id allocation, which takes the highest
   * existing id and adds one and so cannot work from a single page.
   *
   * NOT the table; that is {@link teacherList}, which pages. Loaded lazily so
   * opening this screen no longer reads the collection.
   */
  readonly teachers = signal<Teacher[]>([]);

  /** Whether {@link teachers} has been fetched this session. */
  private allTeachersLoaded = false;

  /** The table: searched by the API (name, email or subject), across every teacher. */
  readonly teacherList = PagedList.from<Teacher>(
    () => this.teacherService.pagedSource(this.searchQuery()),
    20,
    () => this.notification.error('Failed to load teachers.')
  );
  readonly subjects = signal<Subject[]>([]);
  readonly classes = signal<ClassGroup[]>([]);
  readonly stages = signal<Stage[]>([]);
  readonly students = signal<User[]>([]);
  readonly isLoading = signal(false);
  readonly searchQuery = signal('');

  readonly showForm = signal(false);
  readonly editingId = signal<string | null>(null);

  // Details popup
  readonly detailTeacher = signal<Teacher | null>(null);

  readonly detailClasses = computed(() => {
    const t = this.detailTeacher();
    return t ? this.getClassesForTeacher(t.id) : [];
  });

  readonly detailSubjects = computed(() => {
    const t = this.detailTeacher();
    return t ? this.getSubjectsForTeacher(t) : [];
  });

  readonly detailStudents = computed(() => {
    const t = this.detailTeacher();
    return t ? studentsForTeacher(t, this.classes(), this.students()) : [];
  });
  readonly form = signal<TeacherForm>({
    id: '', firstName: '', lastName: '', email: '', photoURL: '', subjectIds: [], classIds: []
  });

  // Subject chips picker state (inside the teacher form)
  readonly subjectPickerOpen = signal(false);
  readonly subjectPickerQuery = signal('');

  // Class chips picker state (inside the teacher form)
  readonly classPickerOpen = signal(false);
  readonly classPickerQuery = signal('');

  /** The rows on screen; the API has already applied the search box. */
  readonly filteredTeachers = computed(() => this.teacherList.items());

  /** Waits for typing to pause, so a name is one request rather than one per keystroke. */
  private readonly reloadSoon = debounced(inject(DestroyRef));

  onSearchChange(query: string): void {
    this.searchQuery.set(query);
    this.reloadSoon(() => void this.teacherList.reload());
  }

  readonly selectedSubjectsForForm = computed(() => {
    const ids = this.form().subjectIds;
    return ids
      .map(id => this.subjects().find(s => s.id === id))
      .filter((s): s is Subject => !!s);
  });

  readonly availableSubjectsForPicker = computed(() => {
    const selected = new Set(this.form().subjectIds);
    const q = this.subjectPickerQuery().toLowerCase().trim();
    return this.subjects().filter(s => {
      if (selected.has(s.id)) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q);
    });
  });

  readonly selectedClassesForForm = computed(() => {
    const ids = this.form().classIds;
    return ids
      .map(id => this.classes().find(c => c.id === id))
      .filter((c): c is ClassGroup => !!c);
  });

  readonly availableClassesForPicker = computed(() => {
    const selected = new Set(this.form().classIds);
    const q = this.classPickerQuery().toLowerCase().trim();
    return this.classes().filter(c => {
      if (selected.has(c.id)) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q);
    });
  });

  constructor() {
    this.loadAll();
    this.loadSubjects();
    this.loadClasses();
    this.loadStages();
    this.loadStudents();
  }

  /**
   * Refresh the table. The full list is fetched only when id allocation needs
   * it — see {@link ensureAllTeachersLoaded}.
   */
  async loadAll(): Promise<void> {
    await this.teacherList.reload();
    if (this.allTeachersLoaded) await this.loadEveryTeacher();
  }

  /** Fetch every teacher, once, so a new id cannot collide with an existing one. */
  async ensureAllTeachersLoaded(): Promise<void> {
    if (this.allTeachersLoaded) return;
    await this.loadEveryTeacher();
  }

  private async loadEveryTeacher(): Promise<void> {
    try {
      let cursor: string | undefined;
      const items: Teacher[] = [];
      do {
        const result = await this.teacherService.listTeachers(100, cursor);
        items.push(...result.items);
        cursor = result.nextCursor;
      } while (cursor);
      this.teachers.set(items);
      this.allTeachersLoaded = true;
    } catch {
      this.notification.error('Failed to load the full teacher list.');
    }
  }

  async loadSubjects(): Promise<void> {
    let cursor: string | undefined;
    const items: Subject[] = [];
    do {
      const result = await this.subjectService.listSubjects(50, cursor);
      items.push(...result.items);
      cursor = result.nextCursor;
    } while (cursor);
    this.subjects.set(items);
  }

  async loadClasses(): Promise<void> {
    let cursor: string | undefined;
    const items: ClassGroup[] = [];
    do {
      const result = await this.classService.listClasses(50, cursor);
      items.push(...result.items);
      cursor = result.nextCursor;
    } while (cursor);
    this.classes.set(items);
  }

  async loadStages(): Promise<void> {
    const result = await this.stageService.listStages(100);
    this.stages.set(result.items);
  }

  async loadStudents(): Promise<void> {
    let cursor: string | undefined;
    const all: User[] = [];
    do {
      const result = await this.userService.listUsers(100, cursor);
      all.push(...result.items);
      cursor = result.nextCursor;
    } while (cursor);
    this.students.set(all.filter(u => u.accountType === 'child'));
  }

  getClassCountForTeacher(teacherId: string): number {
    return this.classes().filter(c => (c.teacherIds ?? []).includes(teacherId)).length;
  }

  getStudentCountForTeacher(teacher: Teacher): number {
    return studentsForTeacher(teacher, this.classes(), this.students()).length;
  }

  getSubjectName(subjectId: string | undefined): string {
    if (!subjectId) return '';
    return this.subjects().find(s => s.id === subjectId)?.name ?? subjectId;
  }

  getSubjectsForTeacher(teacher: Teacher): Subject[] {
    return (teacher.subjectIds ?? [])
      .map(id => this.subjects().find(s => s.id === id))
      .filter((s): s is Subject => !!s);
  }

  getClassName(classId: string | undefined): string {
    if (!classId) return '';
    return this.classes().find(c => c.id === classId)?.name ?? classId;
  }

  getStageName(stageId: string | undefined): string {
    if (!stageId) return '—';
    return this.stages().find(s => s.id === stageId)?.name ?? stageId;
  }

  getClassesForTeacher(teacherId: string): ClassGroup[] {
    return this.classes().filter(c => (c.teacherIds ?? []).includes(teacherId));
  }

  /**
   * Open the create form.
   *
   * Async because the suggested id is the highest existing one plus one, which
   * needs every teacher — the table only holds a page. The form opens first so
   * it never feels like it stalled; the id fills in a moment later.
   */
  async openForm(): Promise<void> {
    this.editingId.set(null);
    this.form.set({ id: '', firstName: '', lastName: '', email: '', photoURL: '', subjectIds: [], classIds: [] });
    this.resetSubjectPicker();
    this.resetClassPicker();
    this.showForm.set(true);
    await this.ensureAllTeachersLoaded();
    this.form.update(f => ({ ...f, id: this.getNextId() }));
  }
  edit(t: Teacher): void {
    this.editingId.set(t.id);
    this.form.set({
      id: t.id,
      firstName: t.firstName,
      lastName: t.lastName,
      email: t.email ?? '',
      photoURL: t.photoURL ?? '',
      subjectIds: [...(t.subjectIds ?? [])],
      classIds: this.getClassesForTeacher(t.id).map(c => c.id)
    });
    this.resetSubjectPicker();
    this.resetClassPicker();
    this.showForm.set(true);
  }
  closeForm(): void {
    this.showForm.set(false);
    this.editingId.set(null);
    this.resetSubjectPicker();
    this.resetClassPicker();
  }

  openDetails(teacher: Teacher): void {
    this.detailTeacher.set(teacher);
  }

  closeDetails(): void {
    this.detailTeacher.set(null);
  }
  updateField(key: 'firstName' | 'lastName' | 'email' | 'photoURL', value: string): void {
    this.form.update(f => ({ ...f, [key]: value }));
  }

  // Subject picker
  private resetSubjectPicker(): void {
    this.subjectPickerOpen.set(false);
    this.subjectPickerQuery.set('');
  }
  toggleSubjectPicker(): void {
    this.subjectPickerOpen.update(v => !v);
    if (!this.subjectPickerOpen()) this.subjectPickerQuery.set('');
  }
  addSubjectToForm(subjectId: string): void {
    if (!subjectId) return;
    this.form.update(f => f.subjectIds.includes(subjectId) ? f : { ...f, subjectIds: [...f.subjectIds, subjectId] });
    this.subjectPickerQuery.set('');
  }
  removeSubjectFromForm(subjectId: string): void {
    this.form.update(f => ({ ...f, subjectIds: f.subjectIds.filter(id => id !== subjectId) }));
  }

  // Class picker
  private resetClassPicker(): void {
    this.classPickerOpen.set(false);
    this.classPickerQuery.set('');
  }
  toggleClassPicker(): void {
    this.classPickerOpen.update(v => !v);
    if (!this.classPickerOpen()) this.classPickerQuery.set('');
  }
  addClassToForm(classId: string): void {
    if (!classId) return;
    this.form.update(f => f.classIds.includes(classId) ? f : { ...f, classIds: [...f.classIds, classId] });
    this.classPickerQuery.set('');
  }
  removeClassFromForm(classId: string): void {
    this.form.update(f => ({ ...f, classIds: f.classIds.filter(id => id !== classId) }));
  }

  async save(): Promise<void> {
    const f = this.form();
    const teacher: Teacher = {
      id: f.id.trim(),
      firstName: f.firstName.trim(),
      lastName: f.lastName.trim(),
      email: f.email.trim() || undefined,
      photoURL: f.photoURL.trim() || undefined,
      subjectIds: f.subjectIds.filter(Boolean)
    };
    if (!teacher.id || !teacher.firstName) {
      this.notification.warning('First name is required.');
      return;
    }
    try {
      // a new teacher's id is the one the API assigns; the form's placeholder is discarded
      const id = this.editingId()
        ? (await this.teacherService.updateTeacher(teacher), teacher.id)
        : await this.teacherService.createTeacher(teacher);
      await this.syncClassMemberships(id, f.classIds);
      this.notification.success(this.editingId() ? 'Teacher updated.' : 'Teacher created.');
      await this.provisionLogin({ ...teacher, id });
      this.closeForm();
      await Promise.all([this.loadAll(), this.loadClasses()]);
    } catch (e) {
      this.notification.error('Failed to save teacher.');
      console.error(e);
    }
  }

  /**
   * Make sure a saved teacher with an email can log in to the app: creates the
   * auth account (default password) and the linked user record, or links an
   * existing login. A provisioning problem must not fail the teacher save.
   */
  private async provisionLogin(teacher: Teacher): Promise<void> {
    if (!teacher.email) return;
    try {
      const result = await this.teacherAccountService.ensureTeacherAccount(teacher);
      switch (result.status) {
        case 'created':
        case 'linked':
          this.notification.success(result.message);
          break;
        case 'exists-unmanaged':
          this.notification.warning(result.message);
          break;
      }
    } catch (e) {
      this.notification.warning('Teacher saved, but their app login could not be provisioned. Try saving again.');
      console.error(e);
    }
  }

  /**
   * Reconcile which classes list this teacher: add the id to newly-selected
   * classes and remove it from de-selected ones. class.teacherIds stays the
   * single source of truth for teacher↔class assignment.
   */
  private async syncClassMemberships(teacherId: string, selectedClassIds: string[]): Promise<void> {
    const selected = new Set(selectedClassIds);
    const updates: Promise<void>[] = [];
    for (const cls of this.classes()) {
      const has = (cls.teacherIds ?? []).includes(teacherId);
      const want = selected.has(cls.id);
      if (has === want) continue;
      const teacherIds = want
        ? [...(cls.teacherIds ?? []), teacherId]
        : (cls.teacherIds ?? []).filter(id => id !== teacherId);
      updates.push(this.classService.updateClass({
        ...cls,
        teacherIds: teacherIds.length > 0 ? teacherIds : undefined
      }));
    }
    await Promise.all(updates);
  }

  async remove(id: string): Promise<void> {
    if (!confirm('Delete this teacher? Classes assigned to them will be left unassigned.')) return;
    try {
      await this.teacherService.deleteTeacher(id);
      this.notification.success('Teacher deleted.');
      await this.loadAll();
    } catch (e) {
      this.notification.error(e instanceof ServiceError ? e.message : 'Failed to delete teacher.');
      console.error(e);
    }
  }

  private getNextId(): string {
    const ids = this.teachers().map(t => parseInt(t.id, 10)).filter(n => !isNaN(n));
    return String((ids.length ? Math.max(...ids) : 0) + 1);
  }

  initials(t: Teacher): string {
    return ((t.firstName?.[0] ?? '') + (t.lastName?.[0] ?? '')).toUpperCase() || '?';
  }
}
