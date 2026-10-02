import { ServiceError } from '../../services/shared/service-error';
import { UserAdminService } from '../../services/admin';
import { Component, signal, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ClickOutsideDirective, LoadingButtonDirective } from '../../directives';
import { AppUserService, StageService, GradeService, ClassGroupService } from '../../services/admin';
import { ChildAccountService } from '../../services/auth/child-account.service';
import { NotificationService } from '../../services/notification.service';
import { PagedList } from '../../shared/paged-list';
import { AdminRole, Stage, Grade, ClassGroup, User } from '../../models';
import { MIN_PASSWORD_LENGTH } from '../../shared/password-policy';

type UserTab = 'all' | 'admins' | 'parents' | 'children';
type DerivedStatus = 'active' | 'pending' | 'inactive' | 'suspended';
type DerivedRole = 'Admin' | 'Parent' | 'Child' | 'User';
type NewUserRole = 'admin' | 'parent' | 'child';

@Component({
    selector: 'app-users-admin',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, FormsModule, TranslatePipe, ClickOutsideDirective, LoadingButtonDirective],
    templateUrl: './users-admin.component.html'
})
export class UsersAdminComponent {
  /** The API's minimum for a new password (shared/password-policy). */
  readonly minPasswordLength = MIN_PASSWORD_LENGTH;

  private readonly appUserService = inject(AppUserService);
  private readonly stageService = inject(StageService);
  private readonly gradeService = inject(GradeService);
  private readonly classService = inject(ClassGroupService);
  private readonly childAccountService = inject(ChildAccountService);
  private readonly userAdminService = inject(UserAdminService);
  private readonly notification = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  // Data
  /**
   * The rows currently loaded.
   *
   * For the Parents/Children/All tabs this is one page from
   * {@link userList}; for the Admins tab it is every admin account, which is
   * bounded and cannot be paged (see `AppUserService.listAdminAccounts`).
   * Either way it is no longer every user in the school.
   */
  readonly allUsers = signal<User[]>([]);

  /**
   * The table, paged on the server for the tabs a query can express.
   *
   * `accountType` is a real stored field, so Parents and Children are `where`
   * clauses. "All" is unfiltered. Admins is the exception — it means *no*
   * `accountType` plus a non-empty `roles`, and Firestore cannot match an absent
   * field — so that tab loads whole instead; see {@link loadUsers}.
   */
  readonly userList = PagedList.from<User>(
    () => {
      const tab = this.activeTab();
      return this.appUserService.pagedSource(
        tab === 'parents' ? 'parent' : tab === 'children' ? 'child' : undefined
      );
    },
    13,
    () => this.notification.error('Failed to load users.')
  );

  /** Server counts behind the tab badges, refreshed with the list. */
  readonly countAll = signal(0);
  readonly countParents = signal(0);
  readonly countChildren = signal(0);

  /** Parent accounts for the "assign a parent" picker; loaded when the form opens. */
  private parentsLoaded = false;
  readonly stages = signal<Stage[]>([]);
  readonly grades = signal<Grade[]>([]);
  readonly classes = signal<ClassGroup[]>([]);
  readonly isLoading = signal(false);

  // Filters / state
  readonly activeTab = signal<UserTab>('all');
  readonly searchQuery = signal('');
  readonly statusFilter = signal<'all' | DerivedStatus>('all');
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly expandedParentIds = signal<Set<string>>(new Set());

  // Pagination
  readonly pageSize = 13;
  readonly currentPage = signal(1);

  // ---------- Derivations ----------

  /**
   * A user is classified as Admin only when they have admin roles AND no parent/child
   * accountType. Parents carry the 'userAdmin' role too (it grants management of their
   * own children), so accountType has to take precedence over the roles array.
   */
  private isAdmin(u: User): boolean {
    return !u.accountType && !!u.roles && u.roles.length > 0;
  }

  getRole(u: User): DerivedRole {
    if (u.accountType === 'parent') return 'Parent';
    if (u.accountType === 'child') return 'Child';
    if (this.isAdmin(u)) return 'Admin';
    return 'User';
  }

  /** Derive a status from the active flag + recency of last login. */
  getStatus(u: User): DerivedStatus {
    if (u.active === false) return 'suspended';
    const last = this.toMs(u.lastLoginAt);
    const created = this.toMs(u.createdAt);
    // Never logged in (or only stamped at signup) → pending invite.
    if (!last || (created && last && last - created < 1000)) return 'pending';
    const days = (Date.now() - last) / (1000 * 60 * 60 * 24);
    if (days > 14) return 'inactive';
    return 'active';
  }

  /** Counts shown next to each tab. */
  readonly counts = computed(() => {
    const list = this.allUsers();
    return {
      all: list.length,
      admins: list.filter(u => this.isAdmin(u)).length,
      parents: list.filter(u => u.accountType === 'parent').length,
      children: list.filter(u => u.accountType === 'child').length,
    };
  });

  /** Apply tab + search + status filters. */
  readonly filteredUsers = computed(() => {
    let list = this.allUsers();
    const tab = this.activeTab();
    if (tab === 'admins')   list = list.filter(u => this.isAdmin(u));
    if (tab === 'parents')  list = list.filter(u => u.accountType === 'parent');
    if (tab === 'children') list = list.filter(u => u.accountType === 'child');

    const status = this.statusFilter();
    if (status !== 'all') list = list.filter(u => this.getStatus(u) === status);

    const q = this.searchQuery().toLowerCase().trim();
    if (q) {
      list = list.filter(u =>
        (u.displayName ?? '').toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q) ||
        (u.mobileNumber ?? '').includes(q) ||
        (u.firstName ?? '').toLowerCase().includes(q) ||
        (u.lastName ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  });

  /**
   * Filtered list minus children whose parent is currently expanded — those children
   * are already shown nested under the parent row, so we hide them at the top level
   * to avoid duplicates.
   */
  readonly visibleUsers = computed(() => {
    const expanded = this.expandedParentIds();
    if (expanded.size === 0) return this.filteredUsers();
    return this.filteredUsers().filter(u =>
      !(u.accountType === 'child' && u.parentId && expanded.has(u.parentId))
    );
  });

  /**
   * Pages of the CURRENT tab.
   *
   * The Admins tab is loaded whole (it cannot be queried — see `userList`), so
   * it keeps the in-memory slice. Every other tab is paged by the server.
   */
  readonly totalPages = computed(() =>
    this.activeTab() === 'admins'
      ? Math.ceil(this.visibleUsers().length / this.pageSize) || 1
      : this.userList.totalPages()
  );

  readonly paginatedUsers = computed(() => {
    if (this.activeTab() !== 'admins') return this.visibleUsers();
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.visibleUsers().slice(start, start + this.pageSize);
  });

  readonly pageRangeLabel = computed(() => {
    const total = this.visibleUsers().length;
    if (total === 0) return '0 of 0';
    const start = (this.currentPage() - 1) * this.pageSize + 1;
    const end = Math.min(start + this.pageSize - 1, total);
    return `Showing ${start}–${end} of ${total} users`;
  });

  readonly headerCountLabel = computed(() => {
    const shown = this.visibleUsers().length;
    // The whole matching set, from the server's count — the browser holds one
    // page and could not tell you this itself.
    const all = this.activeTab() === 'admins' ? this.allUsers().length : this.userList.total();
    return `${shown} of ${all}`;
  });

  // ---------- Lifecycle ----------

  constructor() {
    this.loadAll();
  }

  async loadAll(): Promise<void> {
    this.isLoading.set(true);
    try {
      await Promise.all([
        this.loadUsers(), this.refreshUserCounts(),
        this.loadStages(), this.loadGrades(), this.loadClasses()
      ]);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Load the rows for the active tab.
   *
   * Was a drain of every account in the school on every visit — the single
   * heaviest read in the admin area, and the one that grows fastest.
   */
  private async loadUsers(): Promise<void> {
    if (this.activeTab() === 'admins') {
      // Not pageable: see `userList`'s note. Bounded, so loading it whole is
      // honest rather than a compromise.
      this.allUsers.set(await this.appUserService.listAdminAccounts());
      return;
    }
    await this.userList.reload();
    this.allUsers.set(this.userList.items());
  }

  /** Refresh the three server-counted tab badges. Aggregations, no document reads. */
  private async refreshUserCounts(): Promise<void> {
    try {
      const [all, parents, children] = await Promise.all([
        this.appUserService.countUsers(),
        this.appUserService.countByAccountType('parent'),
        this.appUserService.countByAccountType('child')
      ]);
      this.countAll.set(all);
      this.countParents.set(parents);
      this.countChildren.set(children);
    } catch {
      this.countAll.set(0); this.countParents.set(0); this.countChildren.set(0);
    }
  }

  /** Fetch the parent accounts the create form's picker offers, once. */
  async ensureParentsLoaded(): Promise<void> {
    if (this.parentsLoaded) return;
    try {
      this.parents.set(await this.appUserService.listParents());
      this.parentsLoaded = true;
    } catch {
      this.notification.error('Failed to load the parent list.');
    }
  }
  private async loadStages(): Promise<void> {
    let cursor: string | undefined;
    const items: Stage[] = [];
    do {
      const r = await this.stageService.listStages(50, cursor);
      items.push(...r.items);
      cursor = r.nextCursor;
    } while (cursor);
    this.stages.set(items);
  }
  private async loadGrades(): Promise<void> {
    let cursor: string | undefined;
    const items: Grade[] = [];
    do {
      const r = await this.gradeService.listGrades(50, cursor);
      items.push(...r.items);
      cursor = r.nextCursor;
    } while (cursor);
    this.grades.set(items);
  }
  private async loadClasses(): Promise<void> {
    let cursor: string | undefined;
    const items: ClassGroup[] = [];
    do {
      const r = await this.classService.listClasses(50, cursor);
      items.push(...r.items);
      cursor = r.nextCursor;
    } while (cursor);
    this.classes.set(items);
  }

  // ---------- UI handlers ----------

  /**
   * Switch tab and re-query.
   *
   * The tab is now part of the Firestore query, not a filter over a downloaded
   * list, so changing it must reload — and reloading is also what drops the
   * cached cursors, which belong to the previous tab's result set.
   */
  setTab(tab: UserTab): void {
    if (this.activeTab() === tab) return;
    this.activeTab.set(tab);
    this.currentPage.set(1);
    void this.loadUsers();
  }

  onSearchChange(q: string): void {
    this.searchQuery.set(q);
    this.currentPage.set(1);
  }

  onStatusFilterChange(s: 'all' | DerivedStatus): void {
    this.statusFilter.set(s);
    this.currentPage.set(1);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) this.currentPage.set(page);
  }
  /** Step back a page — the server list, or the Admins tab's in-memory slice. */
  previousPage(): void {
    if (this.activeTab() !== 'admins') {
      // Both writes go inside `then`: the list's page number only advances once
      // the fetch resolves, so reading it earlier records the page we left.
      void this.userList.previous().then(() => {
        this.allUsers.set(this.userList.items());
        this.currentPage.set(this.userList.currentPage());
      });
      return;
    }
    if (this.currentPage() > 1) this.currentPage.update(p => p - 1);
  }
  /** Step forward a page — the server list, or the Admins tab's in-memory slice. */
  nextPage(): void {
    if (this.activeTab() !== 'admins') {
      void this.userList.next().then(() => {
        this.allUsers.set(this.userList.items());
        this.currentPage.set(this.userList.currentPage());
      });
      return;
    }
    if (this.currentPage() < this.totalPages()) this.currentPage.update(p => p + 1);
  }

  // ---------- Selection ----------

  isSelected(uid: string): boolean { return this.selectedIds().has(uid); }
  toggleSelect(uid: string): void {
    const next = new Set(this.selectedIds());
    if (next.has(uid)) next.delete(uid); else next.add(uid);
    this.selectedIds.set(next);
  }
  isAllOnPageSelected(): boolean {
    const page = this.paginatedUsers();
    if (page.length === 0) return false;
    const sel = this.selectedIds();
    return page.every(u => sel.has(u.uid));
  }
  toggleSelectAllOnPage(): void {
    const page = this.paginatedUsers();
    const next = new Set(this.selectedIds());
    const allSelected = this.isAllOnPageSelected();
    page.forEach(u => allSelected ? next.delete(u.uid) : next.add(u.uid));
    this.selectedIds.set(next);
  }

  // ---------- Actions ----------

  async toggleUserActive(user: User): Promise<void> {
    const next = !(user.active ?? true);
    try {
      await this.appUserService.updateUserActive(user.id!, next);
      this.allUsers.update(list => list.map(u => u.uid === user.uid ? { ...u, active: next } : u));
      this.notification.success(next ? 'User activated.' : 'User suspended.');
    } catch {
      this.notification.error('Failed to update user.');
    }
  }

  exportCsv(): void {
    const rows = this.filteredUsers();
    const header = ['Name', 'Email', 'Mobile', 'Role', 'Status', 'Linked', 'Last Active', 'Joined'];
    const escape = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;
    const lines = [header.map(escape).join(',')];
    for (const u of rows) {
      lines.push([
        u.displayName ?? '',
        u.email ?? '',
        u.mobileNumber ?? '',
        this.getRole(u),
        this.getStatus(u),
        this.getLinkedSummary(u),
        this.formatRelative(u.lastLoginAt),
        this.formatJoined(u.createdAt)
      ].map(escape).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------- Add user drawer ----------

  readonly showAddDrawer = signal(false);
  readonly drawerMode = signal<'add' | 'edit'>('add');
  readonly editingUserId = signal<string | null>(null);
  readonly newRole = signal<NewUserRole>('parent');
  readonly newFirstName = signal('');
  readonly newLastName = signal('');
  readonly newMobile = signal('');
  readonly newEmail = signal('');
  readonly newPassword = signal('');
  readonly isSettingPassword = signal(false);
  readonly newAdminRole = signal<AdminRole>('userAdmin');
  readonly newRegistrationKeyId = signal<string>('');
  readonly newParentId = signal<string>('');
  readonly newStageId = signal<string>('');
  readonly newGradeId = signal<string>('');
  readonly newClassId = signal<string>('');
  readonly newActive = signal<boolean>(true);
  readonly isSavingUser = signal(false);

  /** Parent accounts offered by the create form's picker — see {@link ensureParentsLoaded}. */
  readonly parents = signal<User[]>([]);
  readonly parentOptions = computed(() => this.parents());
  readonly gradesForNewStage = computed(() => {
    const sid = this.newStageId();
    return this.grades().filter(g => !sid || g.stageId === sid);
  });
  readonly classesForNewGrade = computed(() => {
    const sid = this.newStageId();
    const gid = this.newGradeId();
    return this.classes().filter(c =>
      (!sid || c.stageId === sid) &&
      (!gid || c.gradeId === gid)
    );
  });

  openAddUser(): void {
    this.drawerMode.set('add');
    this.editingUserId.set(null);
    this.resetAddForm();
    this.showAddDrawer.set(true);
    // The "assign a parent" picker needs every parent, and the table only holds
    // a page — fetched here so the cost falls on opening the form, not on
    // viewing the list.
    void this.ensureParentsLoaded();
  }

  /** Set the edited account's password now (it signs that person out everywhere). */
  async setUserPassword(): Promise<void> {
    const id = this.editingUserId();
    const password = this.newPassword();
    if (!id || password.length < MIN_PASSWORD_LENGTH || this.isSettingPassword()) return;
    this.isSettingPassword.set(true);
    try {
      await this.appUserService.setPassword(id, password);
      this.newPassword.set('');
      this.notification.success(this.translate.instant('usersAdmin.drawer.passwordSet'));
    } catch (error) {
      this.notification.error(error instanceof ServiceError ? error.message : 'Could not set the password.');
    } finally {
      this.isSettingPassword.set(false);
    }
  }

  /** Open the drawer in edit mode, pre-filled from the given user. */
  openEditUser(u: User): void {
    this.drawerMode.set('edit');
    this.editingUserId.set(u.id ?? '');
    this.resetAddForm();

    const role = this.getRole(u);
    if (role === 'Admin')      this.newRole.set('admin');
    else if (role === 'Parent') this.newRole.set('parent');
    else if (role === 'Child')  this.newRole.set('child');

    this.newFirstName.set(u.firstName ?? '');
    this.newLastName.set(u.lastName ?? '');
    this.newMobile.set(u.mobileNumber ?? '');
    this.newEmail.set(u.email ?? '');
    this.newRegistrationKeyId.set(u.registrationKeyId ?? '');
    this.newActive.set(u.active ?? true);

    if (role === 'Admin') {
      const adminRole = (u.roles?.[0] as AdminRole) ?? 'userAdmin';
      this.newAdminRole.set(adminRole);
    }
    if (role === 'Child') {
      this.newParentId.set(u.parentId ?? '');
      this.newStageId.set(u.stageId ?? '');
      this.newGradeId.set(u.gradeId ?? '');
      this.newClassId.set(u.classId ?? '');
    }

    this.showAddDrawer.set(true);
    // The "assign a parent" picker needs every parent, and the table only holds
    // a page — fetched here so the cost falls on opening the form, not on
    // viewing the list.
    void this.ensureParentsLoaded();
  }

  closeAddUser(): void {
    this.showAddDrawer.set(false);
  }
  setNewRole(role: NewUserRole): void {
    // Changing the user's role at edit time would require recreating the auth account
    // (admins have no accountType, children have parent linkage etc.) — keep it locked.
    if (this.drawerMode() === 'edit') return;
    this.newRole.set(role);
  }
  onNewStageChange(stageId: string): void {
    this.newStageId.set(stageId);
    if (!this.grades().some(g => g.id === this.newGradeId() && g.stageId === stageId)) {
      this.newGradeId.set('');
    }
    if (!this.classes().some(c => c.id === this.newClassId() && c.stageId === stageId)) {
      this.newClassId.set('');
    }
  }
  onNewGradeChange(gradeId: string): void {
    this.newGradeId.set(gradeId);
    if (!this.classes().some(c => c.id === this.newClassId() && c.gradeId === gradeId)) {
      this.newClassId.set('');
    }
  }
  private resetAddForm(): void {
    this.newRole.set('parent');
    this.newFirstName.set('');
    this.newLastName.set('');
    this.newMobile.set('');
    this.newEmail.set('');
    this.newPassword.set('');
    this.newAdminRole.set('userAdmin');
    this.newRegistrationKeyId.set('');
    this.newParentId.set('');
    this.newStageId.set('');
    this.newGradeId.set('');
    this.newClassId.set('');
    this.newActive.set(true);
  }

  async saveNewUser(): Promise<void> {
    if (this.drawerMode() === 'edit') {
      await this.saveEditedUser();
      return;
    }

    const role = this.newRole();
    const firstName = this.newFirstName().trim();
    const lastName = this.newLastName().trim();
    const mobile = this.newMobile().trim();
    const password = this.newPassword();
    const registrationKeyId = this.newRegistrationKeyId().trim();

    if (!firstName || !lastName) { this.notification.warning('First and last name are required.'); return; }
    if (!mobile) { this.notification.warning('Mobile number is required.'); return; }
    if (!password || password.length < MIN_PASSWORD_LENGTH) { this.notification.warning(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`); return; }
    // A parent claims the key they are created with; a child is always charged to their parent's key, and staff need none.
    if (role === 'parent' && !registrationKeyId) { this.notification.warning('Registration key is required.'); return; }

    if (role === 'child') {
      if (!this.newParentId()) { this.notification.warning('Please select a parent.'); return; }
      if (!this.newStageId()) { this.notification.warning('Please select a stage.'); return; }
      if (this.gradesForNewStage().length > 0 && !this.newGradeId()) {
        this.notification.warning('Please select a grade.'); return;
      }
      if (!this.newClassId()) { this.notification.warning('Please select a class.'); return; }
    }

    this.isSavingUser.set(true);
    try {
      // The API checks the key (and the child's family key) before it creates any sign-in.
      if (role === 'admin') {
        await this.childAccountService.createAdminAccount({
          firstName, lastName, mobileNumber: mobile, password,
          registrationKeyId: registrationKeyId || undefined,
          email: this.newEmail().trim() || undefined,
          roles: [this.newAdminRole()]
        });
        this.notification.success('Admin account created.');
      } else if (role === 'parent') {
        await this.childAccountService.createParentAccount({
          firstName, lastName, mobileNumber: mobile, password,
          registrationKeyId,
          email: this.newEmail().trim() || undefined
        });
        this.notification.success('Parent account created.');
        this.parentsLoaded = false;                          // so the "assign a parent" picker includes them next time
      } else {
        await this.childAccountService.createChildAccount({
          parentId: this.newParentId(),
          firstName, lastName, mobileNumber: mobile, password,
          classId: this.newClassId()
        });
        this.notification.success('Child account created.');
      }
      this.closeAddUser();
      await this.loadAll();
    } catch (err: unknown) {
      this.notification.error(err instanceof Error ? err.message : 'Failed to create user.');
      console.error(err);
    } finally {
      this.isSavingUser.set(false);
    }
  }

  /**
   * Save changes to an existing user. Identity fields (uid, mobile, email, password,
   * registrationKeyId, role) are immutable in this flow — the form only sends the
   * mutable profile fields and role-specific linkage.
   */
  async saveEditedUser(): Promise<void> {
    const id = this.editingUserId();
    if (!id) return;

    const role = this.newRole();
    const firstName = this.newFirstName().trim();
    const lastName = this.newLastName().trim();

    if (!firstName || !lastName) {
      this.notification.warning('First and last name are required.');
      return;
    }

    const patch: Parameters<typeof this.appUserService.updateUserProfile>[1] = {
      firstName,
      lastName,
      active: this.newActive()
    };

    if (role === 'admin') {
      patch.roles = [this.newAdminRole()];
    }

    if (role === 'child') {
      if (!this.newParentId()) { this.notification.warning('Please select a parent.'); return; }
      if (!this.newStageId()) { this.notification.warning('Please select a stage.'); return; }
      if (this.gradesForNewStage().length > 0 && !this.newGradeId()) {
        this.notification.warning('Please select a grade.'); return;
      }
      if (!this.newClassId()) { this.notification.warning('Please select a class.'); return; }
      // The stage and grade follow from the class, and the family's slot moves with the child, on the server.
      patch.parentId = this.newParentId();
      patch.classId = this.newClassId();
    }

    this.isSavingUser.set(true);
    try {
      await this.appUserService.updateUserProfile(id, patch);
      // Reflect in the local list without a full reload so the row updates instantly.
      this.allUsers.update(list => list.map(u => u.id === id
        ? { ...u, ...patch, displayName: `${firstName} ${lastName}` } as User
        : u));
      this.notification.success('User updated.');
      this.closeAddUser();
    } catch (err: unknown) {
      this.notification.error(err instanceof Error ? err.message : 'Failed to update user.');
      console.error(err);
    } finally {
      this.isSavingUser.set(false);
    }
  }

  // ---------- Display helpers ----------

  /** Plain-text summary of the "Linked to" cell — used for CSV export. */
  getLinkedSummary(u: User): string {
    if (this.isAdmin(u)) return '';
    if (u.accountType === 'parent') {
      const n = u.childIds?.length ?? 0;
      return n === 1 ? '1 child' : `${n} children`;
    }
    if (u.accountType === 'child') {
      const cls = this.classes().find(c => c.id === u.classId);
      const grade = this.grades().find(g => g.id === (u.gradeId ?? cls?.gradeId));
      const stage = this.stages().find(s => s.id === (u.stageId ?? cls?.stageId));
      const parts: string[] = [];
      if (cls?.name) parts.push(cls.name);
      const tail: string[] = [];
      if (grade?.name) tail.push(grade.name);
      if (stage?.name) tail.push(stage.name);
      if (tail.length) parts.push(tail.join(' · '));
      return parts.join(' / ');
    }
    return '';
  }

  /** Compact class name (top line in the Linked to cell for children). */
  getChildClassName(u: User): string {
    const cls = this.classes().find(c => c.id === u.classId);
    return cls?.name ?? '—';
  }
  /** "Grade · Stage" subline. */
  getChildGradeStage(u: User): string {
    const cls = this.classes().find(c => c.id === u.classId);
    const grade = this.grades().find(g => g.id === (u.gradeId ?? cls?.gradeId));
    const stage = this.stages().find(s => s.id === (u.stageId ?? cls?.stageId));
    const parts: string[] = [];
    if (grade?.name) parts.push(grade.name);
    if (stage?.name) parts.push(stage.name);
    return parts.join(' · ');
  }

  getChildCount(u: User): number {
    return u.childCount ?? 0;
  }

  // ---------- Parent → children expansion ----------

  isExpanded(uid: string): boolean {
    return this.expandedParentIds().has(uid);
  }

  /**
   * Expand or collapse a parent row, fetching its children on the way open.
   *
   * The children used to be found in the full user list. With the table paged
   * they may be on another page or none at all, so they are read by id — a
   * handful of documents, and only for the row actually opened.
   */
  async toggleParentExpand(uid: string): Promise<void> {
    const parent = this.allUsers().find(u => u.uid === uid);
    const known = this.childrenByParent();
    if (!known.has(uid) && parent?.id && (parent.childCount ?? 0) > 0) {
      try {
        const children = await this.userAdminService.listChildrenOf(parent.id);
        this.childrenByParent.update(map => new Map(map).set(uid, children));
      } catch {
        this.childrenByParent.update(map => new Map(map).set(uid, []));
      }
    }
    this.toggleExpandedId(uid);
  }

  /** Children fetched per expanded parent, keyed by parent uid. */
  readonly childrenByParent = signal<Map<string, User[]>>(new Map());

  private toggleExpandedId(uid: string): void {
    const next = new Set(this.expandedParentIds());
    if (next.has(uid)) next.delete(uid); else next.add(uid);
    this.expandedParentIds.set(next);
  }

  /** Resolve a parent's children from the loaded user list using childIds. */
  /** Children of an expanded parent — fetched by {@link toggleParentExpand}. */
  getChildrenOfParent(parent: User): User[] {
    return this.childrenByParent().get(parent.uid) ?? [];
  }

  getInitials(u: User): string {
    const src = (u.displayName ?? `${u.firstName ?? ''} ${u.lastName ?? ''}`).trim();
    if (!src) return '?';
    const parts = src.split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /** Stable color variant for the avatar (rotates by initial char). */
  getAvatarVariant(u: User): 'brand' | 'mint' | 'sky' | 'amber' | 'rose' {
    const seed = (u.uid || u.displayName || '?').charCodeAt(0);
    const variants: ('brand' | 'mint' | 'sky' | 'amber' | 'rose')[] = ['brand', 'mint', 'sky', 'amber', 'rose'];
    return variants[seed % variants.length];
  }

  /** Coerce Date / ISO string / epoch into a number of ms (or undefined). */
  private toMs(v: unknown): number | undefined {
    if (!v) return undefined;
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const n = Date.parse(v);
      return isNaN(n) ? undefined : n;
    }
    return undefined;
  }

  formatRelative(v: unknown): string {
    const ms = this.toMs(v);
    if (!ms) return '—';
    const diff = Date.now() - ms;
    if (diff < 60_000) return 'just now';
    const min = Math.floor(diff / 60_000);
    if (min < 60) return `${min} min ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} hr ago`;
    const days = Math.floor(hr / 24);
    if (days === 0) return 'today';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} wk ago`;
    return this.formatJoined(v);
  }

  formatJoined(v: unknown): string {
    const ms = this.toMs(v);
    if (!ms) return '—';
    return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}
