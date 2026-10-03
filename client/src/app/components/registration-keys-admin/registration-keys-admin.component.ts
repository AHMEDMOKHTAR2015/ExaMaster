import { ServiceError } from '../../services/shared/service-error';
import { Component, DestroyRef, signal, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ClickOutsideDirective } from '../../directives';
import { RegistrationKeyAdminService } from '../../services/admin';
import { NotificationService } from '../../services/notification.service';
import { resolveKeyStatus } from '../../shared/registration-key-status';
import { PagedList } from '../../shared/paged-list';
import { debounced } from '../../shared/debounce';
import { RegistrationKey } from '../../models';

type KeyTab = 'all' | 'userAdmin' | 'applicationAdmin';
type DerivedStatus = 'active' | 'used' | 'expired' | 'inactive';

@Component({
    selector: 'app-registration-keys-admin',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, FormsModule, TranslatePipe, ClickOutsideDirective],
    templateUrl: './registration-keys-admin.component.html'
})
export class RegistrationKeysAdminComponent {
  private readonly keyService = inject(RegistrationKeyAdminService);
  private readonly notification = inject(NotificationService);

  // Data
  /** The current page of keys. No longer every key in the organization. */
  readonly allKeys = signal<RegistrationKey[]>([]);

  /** The table: paged, filtered by status and role tab, and searched by code — all by the API, across every page. */
  readonly keyList = PagedList.from<RegistrationKey>(
    () => {
      const status = this.statusFilter();
      const tab = this.activeTab();
      return this.keyService.pagedSource(
        status === 'all' ? undefined : status,
        tab === 'all' ? undefined : tab,
        this.searchQuery()
      );
    },
    20,
    () => this.notification.error('Failed to load registration keys.')
  );

  /** Server counts for the status badges. */
  readonly statusCounts = signal<Record<'active' | 'inactive' | 'expired' | 'used', number>>({
    active: 0, inactive: 0, expired: 0, used: 0
  });
  readonly isLoading = signal(false);

  // Filters / state
  readonly activeTab = signal<KeyTab>('all');
  readonly searchQuery = signal('');
  readonly statusFilter = signal<'all' | DerivedStatus>('all');

  // Inline create form
  readonly showCreateForm = signal(false);
  readonly newRole = signal<'userAdmin' | 'applicationAdmin'>('userAdmin');
  readonly newExpiresAt = signal<string>('');
  readonly newMaxChildren = signal<number | null>(null);

  // Inline edit form
  readonly editingKey = signal<RegistrationKey | null>(null);
  readonly editExpiresAt = signal<string>('');
  readonly editMaxChildren = signal<number | null>(null);
  readonly editActive = signal(true);

  // Pagination
  readonly pageSize = 10;
  readonly currentPage = signal(1);

  // ---------- Derivations ----------

  isExpired(key: RegistrationKey): boolean {
    return !!key.expiresAt && key.expiresAt < Date.now();
  }

  /**
   * The key's status.
   *
   * Prefers the stored field, which is what the query filtered on — so a badge
   * can never contradict the filter that produced the row. Falls back to
   * computing it for keys written before the field existed, and for the window
   * between a key expiring and the nightly sweep noticing: the rule is the same
   * shared function the server persists, so the fallback agrees with what will
   * eventually be stored.
   */
  getStatus(key: RegistrationKey): DerivedStatus {
    return (key.status as DerivedStatus | undefined) ?? resolveKeyStatus(key);
  }

  /** Total seats consumed across all userAdmin keys. */
  readonly seatsUsed = computed(() => {
    return this.allKeys()
      .filter(k => k.role === 'userAdmin')
      .reduce((sum, k) => sum + (k.childUseCount ?? 0), 0);
  });

  /**
   * Badge counts.
   *
   * The status counts are the server's, so they describe the whole organization.
   * The role counts are of the current page only — `role` is not part of the
   * query (see {@link keyList}), so counting it across everything would mean
   * downloading everything, which is what this change removed.
   */
  /** Server counts for the role tabs: every key of that role, not the rows on screen. */
  readonly roleCounts = signal<Record<KeyTab, number>>({ all: 0, userAdmin: 0, applicationAdmin: 0 });

  readonly counts = computed(() => {
    const roles = this.roleCounts();
    const status = this.statusCounts();
    return {
      all: roles.all,
      userAdmin: roles.userAdmin,
      applicationAdmin: roles.applicationAdmin,
      active: status.active,
      expired: status.expired,
      used: status.used,
    };
  });

  /** The page on screen; the API has already applied the role tab, status and search. */
  readonly filteredKeys = computed(() => this.keyList.items());

  readonly totalPages = computed(() => this.keyList.totalPages());
  /** The page the server returned. */
  readonly paginatedKeys = computed(() => this.filteredKeys());

  readonly pageRangeLabel = computed(() => {
    const total = this.keyList.total();
    if (total === 0) return '0 of 0';
    return `Showing ${this.keyList.rangeStart()}–${this.keyList.rangeEnd()} of ${total} keys`;
  });

  // ---------- Lifecycle ----------

  constructor() {
    this.loadAllKeys();
  }

  /**
   * Load a page of keys and refresh the status counts.
   *
   * Was a drain of every key in the organization.
   */
  async loadAllKeys(): Promise<void> {
    await Promise.all([this.keyList.reload(), this.refreshStatusCounts()]);
    this.allKeys.set(this.keyList.items());
  }

  /** Four aggregation queries; no documents read. */
  private async refreshStatusCounts(): Promise<void> {
    try {
      const [active, inactive, expired, used, all, userAdmin, applicationAdmin] = await Promise.all([
        this.keyService.countByStatus('active'),
        this.keyService.countByStatus('inactive'),
        this.keyService.countByStatus('expired'),
        this.keyService.countByStatus('used'),
        this.keyService.countKeys(),
        this.keyService.countByRole('userAdmin'),
        this.keyService.countByRole('applicationAdmin')
      ]);
      this.statusCounts.set({ active, inactive, expired, used });
      this.roleCounts.set({ all, userAdmin, applicationAdmin });
    } catch {
      this.statusCounts.set({ active: 0, inactive: 0, expired: 0, used: 0 });
      this.roleCounts.set({ all: 0, userAdmin: 0, applicationAdmin: 0 });
    }
  }

  // ---------- UI handlers ----------

  /** Waits for typing to pause, so a code is one request rather than one per keystroke. */
  private readonly reloadSoon = debounced(inject(DestroyRef));

  /** The tab, status and search are part of the query, so changing any of them reloads from page 1. */
  private async reloadKeys(): Promise<void> {
    this.currentPage.set(1);
    await this.keyList.reload();
    this.allKeys.set(this.keyList.items());
  }

  setTab(tab: KeyTab): void {
    if (this.activeTab() === tab) return;
    this.activeTab.set(tab);
    void this.reloadKeys();
  }
  onSearchChange(q: string): void {
    this.searchQuery.set(q);
    this.reloadSoon(() => void this.reloadKeys());
  }
  async onStatusFilterChange(s: 'all' | DerivedStatus): Promise<void> {
    this.statusFilter.set(s);
    await this.reloadKeys();
  }
  async previousPage(): Promise<void> {
    await this.keyList.previous();
    this.allKeys.set(this.keyList.items());
    this.currentPage.set(this.keyList.currentPage());
  }

  async nextPage(): Promise<void> {
    await this.keyList.next();
    this.allKeys.set(this.keyList.items());
    this.currentPage.set(this.keyList.currentPage());
  }

  // ---------- Create ----------

  openCreateForm(): void {
    this.cancelEdit();
    this.newRole.set('userAdmin');
    this.newExpiresAt.set('');
    this.newMaxChildren.set(null);
    this.showCreateForm.set(true);
  }
  closeCreateForm(): void {
    this.showCreateForm.set(false);
  }
  isApplicationAdmin(): boolean {
    return this.newRole() === 'applicationAdmin';
  }

  async createKey(): Promise<void> {
    const role = this.newRole();
    const expiresAt = role === 'applicationAdmin' ? undefined : Date.parse(this.newExpiresAt());
    if (role !== 'applicationAdmin' && !expiresAt) {
      this.notification.warning('Expiry date is required for user keys.');
      return;
    }

    try {
      // the server generates the code families will type, and returns the key as stored
      await this.keyService.createKey({ role, expiresAt, maxChildUses: this.newMaxChildren() ?? undefined });
      await this.loadAllKeys();                            // the table is the server's page: reload it (and the counts) to show the new key
      this.notification.success(role === 'applicationAdmin' ? 'Application admin key created.' : 'User key created.');
      this.closeCreateForm();
    } catch (e) {
      this.notification.error(e instanceof ServiceError ? e.message : 'Failed to create key.');
    }
  }

  // ---------- Edit ----------

  editKey(key: RegistrationKey): void {
    this.closeCreateForm();
    this.editingKey.set(key);
    this.editActive.set(key.active);
    this.editExpiresAt.set(key.expiresAt ? new Date(key.expiresAt).toISOString().split('T')[0] : '');
    this.editMaxChildren.set(key.maxChildUses ?? null);
  }
  cancelEdit(): void {
    this.editingKey.set(null);
    this.editExpiresAt.set('');
    this.editMaxChildren.set(null);
    this.editActive.set(true);
  }
  async saveEdit(): Promise<void> {
    const key = this.editingKey();
    if (!key) return;

    const updatedKey: RegistrationKey = { ...key, active: this.editActive() };
    if (key.role !== 'applicationAdmin') {
      const expiresAt = Date.parse(this.editExpiresAt());
      if (expiresAt) updatedKey.expiresAt = expiresAt;
      updatedKey.maxChildUses = this.editMaxChildren() ?? undefined;
    }
    try {
      await this.keyService.updateKey(updatedKey);
      await this.loadAllKeys();
      this.notification.success('Key updated.');
      this.cancelEdit();
    } catch (e) {
      // e.g. an allowance lowered below the children already enrolled
      this.notification.error(e instanceof ServiceError ? e.message : 'Failed to update key.');
    }
  }

  async renewKey(key: RegistrationKey): Promise<void> {
    if (key.role === 'applicationAdmin') return;
    const newExpiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);
    const updatedKey: RegistrationKey = { ...key, expiresAt: newExpiresAt, active: true };
    try {
      await this.keyService.updateKey(updatedKey);
      await this.loadAllKeys();
      this.notification.success('Key renewed for 30 days.');
    } catch (e) {
      this.notification.error(e instanceof ServiceError ? e.message : 'Failed to renew key.');
    }
  }

  async copyKey(key: RegistrationKey): Promise<void> {
    try {
      await navigator.clipboard.writeText(key.code ?? key.id);   // the code a family types
      this.notification.success('Key copied to clipboard.');
    } catch {
      this.notification.error('Could not copy to clipboard.');
    }
  }

  // ---------- Display helpers ----------

  shortId(id: string): string {
    if (id.length <= 14) return id;
    return `${id.slice(0, 8)}…${id.slice(-4)}`;
  }
  formatExpiry(key: RegistrationKey): string {
    if (key.role === 'applicationAdmin' || !key.expiresAt) return 'Never';
    return new Date(key.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  formatChildrenUsage(key: RegistrationKey): string {
    if (key.role === 'applicationAdmin') return '—';
    const used = key.childUseCount ?? 0;
    const max = key.maxChildUses;
    return max != null ? `${used} / ${max}` : `${used} / ∞`;
  }
  getRoleLabel(role: string | undefined): string {
    if (role === 'applicationAdmin') return 'App Admin';
    if (role === 'userAdmin') return 'Parent';
    return role ?? '—';
  }

}
