import { ServiceError } from '../../services/shared/service-error';
import { Component, signal, inject, computed, ChangeDetectionStrategy } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ClickOutsideDirective } from '../../directives';
import {
  SubjectService,
  ClassGroupService,
  TeacherService,
  StageService,
  AppUserService
} from '../../services/admin';
import { NotificationService } from '../../services/notification.service';
import { PagedList } from '../../shared/paged-list';
import { Subject, ClassGroup, Teacher, Stage, User } from '../../models';
import { parseSubjectsJson, SUBJECT_IMPORT_SAMPLE, ParsedSubjectInput } from '../../shared/subject-import';

@Component({
  selector: 'app-subjects-admin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslatePipe, ClickOutsideDirective],
  templateUrl: './subjects-admin.component.html',
})
export class SubjectsAdminComponent {
  private readonly subjectService = inject(SubjectService);
  private readonly classService = inject(ClassGroupService);
  private readonly teacherService = inject(TeacherService);
  private readonly stageService = inject(StageService);
  private readonly userService = inject(AppUserService);
  private readonly notification = inject(NotificationService);

  /**
   * Every subject — the source for id allocation and the JSON import, both of
   * which need the highest existing id and so cannot work from one page.
   *
   * NOT the table any more; that is {@link subjectList}, which pages. Loaded
   * lazily (see {@link ensureAllSubjectsLoaded}) so opening this screen no
   * longer reads the collection — only creating or importing does.
   */
  readonly subjects = signal<Subject[]>([]);

  /** Whether {@link subjects} has been fetched this session. */
  private allSubjectsLoaded = false;

  /**
   * The table, paged on the server.
   *
   * Sorted by name, which is the order the list shows. Uses the service's paged source, so the rows and the
   * page count are provably the same filtered set.
   */
  readonly subjectList = PagedList.from<Subject>(
    () => this.subjectService.pagedSource(),
    20,
    () => this.notification.error('Failed to load subjects.')
  );
  readonly classes = signal<ClassGroup[]>([]);
  readonly teachers = signal<Teacher[]>([]);
  readonly stages = signal<Stage[]>([]);
  readonly students = signal<User[]>([]);
  readonly isLoading = signal(false);
  readonly searchQuery = signal('');

  readonly showForm = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly form = signal<{ id: string; name: string; color: string }>({ id: '', name: '', color: '' });
  readonly detailsSubject = signal<Subject | null>(null);

  // ---- Import JSON ------------------------------------------------------
  readonly showImportForm = signal(false);
  readonly importFileName = signal('');
  readonly importParsedSubjects = signal<ParsedSubjectInput[]>([]);
  readonly importErrors = signal<string[]>([]);
  readonly isImporting = signal(false);

  readonly importCanConfirm = computed(() =>
    this.importParsedSubjects().length > 0 && this.importErrors().length === 0
  );

  readonly detailTeachers = computed(() => {
    const ds = this.detailsSubject();
    return ds ? this.getTeachersForSubject(ds.id) : [];
  });

  readonly detailClasses = computed(() => {
    const ds = this.detailsSubject();
    return ds ? this.getClassesForSubject(ds.id) : [];
  });

  readonly detailStudents = computed(() => {
    const classIds = new Set(this.detailClasses().map(c => c.id));
    return this.students().filter(s => !!s.classId && classIds.has(s.classId!));
  });

  /**
   * The rows on screen, narrowed by the search box — page-scoped, because
   * Firestore has no substring search and the collection is no longer held.
   */
  readonly filteredSubjects = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const list = this.subjectList.items();
    if (!q) return list;
    return list.filter(s => s.name.toLowerCase().includes(q));
  });

  constructor() {
    this.loadAll();
    this.loadClasses();
    this.loadTeachers();
    this.loadStages();
    this.loadStudents();
  }

  /**
   * Refresh the table.
   *
   * Was a drain of every subject on screen open. The full list is fetched only
   * when something needs all of it — see {@link ensureAllSubjectsLoaded}.
   */
  async loadAll(): Promise<void> {
    await this.subjectList.reload();
    // Keep the id allocator honest when it has already been built.
    if (this.allSubjectsLoaded) await this.loadEverySubject();
  }

  /**
   * Fetch every subject, once, for id allocation and the JSON import.
   *
   * Both take the highest existing numeric id and add one, so a single page
   * would hand out ids that already exist. Called before those actions rather
   * than on load, so the cost falls on the rare path.
   */
  async ensureAllSubjectsLoaded(): Promise<void> {
    if (this.allSubjectsLoaded) return;
    await this.loadEverySubject();
  }

  private async loadEverySubject(): Promise<void> {
    try {
      let cursor: string | undefined;
      const items: Subject[] = [];
      do {
        const result = await this.subjectService.listSubjects(100, cursor);
        items.push(...result.items);
        cursor = result.nextCursor;
      } while (cursor);
      this.subjects.set(items);
      this.allSubjectsLoaded = true;
    } catch {
      this.notification.error('Failed to load the full subject list.');
    }
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

  async loadTeachers(): Promise<void> {
    let cursor: string | undefined;
    const items: Teacher[] = [];
    do {
      const result = await this.teacherService.listTeachers(50, cursor);
      items.push(...result.items);
      cursor = result.nextCursor;
    } while (cursor);
    this.teachers.set(items);
  }

  async loadStages(): Promise<void> {
    const result = await this.stageService.listStages(100);
    this.stages.set(result.items);
  }

  async loadStudents(): Promise<void> {
    let cursor: string | undefined;
    const items: User[] = [];
    do {
      const result = await this.userService.listUsers(100, cursor);
      items.push(...result.items);
      cursor = result.nextCursor;
    } while (cursor);
    this.students.set(items.filter(u => u.accountType === 'child'));
  }

  getClassesForSubject(id: string): ClassGroup[] {
    return this.classes().filter(c => (c.subjectIds ?? []).includes(id));
  }

  getClassCountForSubject(id: string): number {
    return this.getClassesForSubject(id).length;
  }

  getStudentCountForSubject(id: string): number {
    const classIds = new Set(this.getClassesForSubject(id).map(c => c.id));
    return this.students().filter(s => !!s.classId && classIds.has(s.classId)).length;
  }

  getStudentCountForClass(classId: string): number {
    return this.students().filter(s => s.classId === classId).length;
  }

  getClassName(classId: string | undefined): string {
    if (!classId) return '';
    return this.classes().find(c => c.id === classId)?.name ?? classId;
  }

  getStageName(stageId: string | undefined): string {
    if (!stageId) return '—';
    return this.stages().find(s => s.id === stageId)?.name ?? stageId;
  }

  subjectInitial(s: Subject): string {
    return (s.name?.[0] ?? '?').toUpperCase();
  }

  getTeachersForSubject(id: string): Teacher[] {
    return this.teachers().filter(t => (t.subjectIds ?? []).includes(id));
  }

  teacherInitials(t: Teacher): string {
    return ((t.firstName?.[0] ?? '') + (t.lastName?.[0] ?? '')).toUpperCase() || '?';
  }

  /**
   * Open the create form.
   *
   * Async because the suggested id is the highest existing one plus one, which
   * needs every subject — the table only holds a page. The form opens first so
   * it never feels like it stalled; the id fills in a moment later.
   */
  async openForm(): Promise<void> {
    this.editingId.set(null);
    this.form.set({ id: '', name: '', color: '' });
    this.showForm.set(true);
    await this.ensureAllSubjectsLoaded();
    this.form.update(f => ({ ...f, id: this.getNextId() }));
  }
  edit(s: Subject): void {
    this.editingId.set(s.id);
    this.form.set({ id: s.id, name: s.name, color: s.color ?? '' });
    this.showForm.set(true);
  }
  closeForm(): void {
    this.showForm.set(false);
    this.editingId.set(null);
  }
  openDetails(s: Subject): void {
    this.detailsSubject.set(s);
  }
  closeDetails(): void {
    this.detailsSubject.set(null);
  }
  updateField(key: 'name' | 'color', value: string): void {
    this.form.update(f => ({ ...f, [key]: value }));
  }

  async save(): Promise<void> {
    const f = this.form();
    const subject: Subject = {
      id: f.id.trim(),
      name: f.name.trim(),
      color: f.color.trim() || undefined
    };
    if (!subject.id || !subject.name) {
      this.notification.warning('Subject name is required.');
      return;
    }
    try {
      if (this.editingId()) await this.subjectService.updateSubject(subject);
      else await this.subjectService.createSubject(subject);
      this.notification.success(this.editingId() ? 'Subject updated.' : 'Subject created.');
      this.closeForm();
      await this.loadAll();
    } catch (e) {
      this.notification.error('Failed to save subject.');
      console.error(e);
    }
  }

  async remove(id: string): Promise<void> {
    if (!confirm('Delete this subject? Classes using it will be left without a subject.')) return;
    try {
      await this.subjectService.deleteSubject(id);
      this.notification.success('Subject deleted.');
      await this.loadAll();
    } catch (e) {
      this.notification.error(e instanceof ServiceError ? e.message : 'Failed to delete subject.');
      console.error(e);
    }
  }

  private getNextId(): string {
    const ids = this.subjects().map(s => parseInt(s.id, 10)).filter(n => !isNaN(n));
    return String((ids.length ? Math.max(...ids) : 0) + 1);
  }

  // ---- Import JSON --------------------------------------------------------

  /** Reads the chosen file, parses + validates it, and opens the confirmation popup. */
  onImportFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // allow re-selecting the same file after fixing it
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json')) {
      this.notification.error('Please choose a .json file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      let parsedRaw: unknown;
      try {
        parsedRaw = JSON.parse(String(reader.result));
      } catch {
        this.notification.error('That file is not valid JSON.');
        return;
      }
      const { subjects, errors } = parseSubjectsJson(parsedRaw);
      this.importFileName.set(file.name);
      this.importParsedSubjects.set(subjects);
      this.importErrors.set(errors);
      this.showImportForm.set(true);
    };
    reader.onerror = () => this.notification.error('Could not read that file.');
    reader.readAsText(file);
  }

  cancelImport(): void {
    this.showImportForm.set(false);
    this.importFileName.set('');
    this.importParsedSubjects.set([]);
    this.importErrors.set([]);
  }

  /** Lets the admin grab a starting point matching the expected schema. */
  downloadImportSample(): void {
    const blob = new Blob([JSON.stringify(SUBJECT_IMPORT_SAMPLE, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'subjects-sample.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Allocates an id for every parsed subject missing one (continuing the
   * catalog's current numeric scheme), then writes them all. Subjects that
   * already specify an id overwrite the existing record at that id.
   */
  async confirmImport(): Promise<void> {
    if (!this.importCanConfirm() || this.isImporting()) return;

    // Allocating ids for the imported rows needs every existing id, not a page.
    await this.ensureAllSubjectsLoaded();

    // A row naming an existing subject's id updates it; every other row is a new subject, whose id the API assigns.
    const existingIds = new Set(this.subjects().map(s => s.id));
    const rows = this.importParsedSubjects();

    this.isImporting.set(true);
    try {
      await Promise.all(rows.map(row => row.id && existingIds.has(row.id)
        ? this.subjectService.updateSubject({ id: row.id, name: row.name, color: row.color })
        : this.subjectService.createSubject({ name: row.name, color: row.color })));
      this.notification.success(`Imported ${rows.length} subject${rows.length === 1 ? '' : 's'}.`);
      this.cancelImport();
      await this.loadAll();
    } catch (e) {
      this.notification.error('Failed to import subjects. Please try again.');
      console.error(e);
    } finally {
      this.isImporting.set(false);
    }
  }
}
