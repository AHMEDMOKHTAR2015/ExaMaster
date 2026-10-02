import { ServiceError } from '../../services/shared/service-error';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseComponent } from '../../shared/base/base.component';
import { NotificationService } from '../../services/notification.service';
import {
  CreateTenantResult,
  PlatformTenantService
} from '../../services/tenant/platform-tenant.service';
import { Tenant } from '../../models';
import { MIN_PASSWORD_LENGTH } from '../../shared/password-policy';

type TenantPlan = NonNullable<Tenant['plan']>;

/**
 * The vendor's console: onboard client organizations, suspend them, and see
 * what each one is on.
 *
 * Deliberately not part of the admin dashboard shell. That shell is built for
 * someone working *inside* an organization, and every tile on it would be
 * empty here — the vendor belongs to none.
 */
@Component({
    selector: 'app-platform-admin',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule, FormsModule],
    templateUrl: './platform-admin.component.html'
})
export class PlatformAdminComponent extends BaseComponent implements OnInit {
  private readonly tenantService = inject(PlatformTenantService);
  private readonly notification = inject(NotificationService);

  readonly tenants = signal<Tenant[]>([]);
  readonly search = signal<string>('');

  readonly plans: TenantPlan[] = ['trial', 'standard', 'enterprise'];

  // --- create form ---------------------------------------------------------
  readonly showCreate = signal<boolean>(false);
  readonly newId = signal<string>('');
  readonly newName = signal<string>('');
  readonly newPlan = signal<TenantPlan>('standard');
  readonly newAdminEmail = signal<string>('');
  readonly isCreating = signal<boolean>(false);

  /**
   * Shown once, immediately after onboarding. The generated password is never
   * stored anywhere — if the vendor closes this without copying it, the
   * administrator has to go through a password reset.
   */
  readonly lastCreated = signal<CreateTenantResult | null>(null);

  // --- edit form -----------------------------------------------------------
  readonly editing = signal<Tenant | null>(null);
  readonly editName = signal<string>('');
  readonly editPlan = signal<TenantPlan>('standard');
  readonly isSaving = signal<boolean>(false);

  // An administrator's password, for a school with no working administrator login.
  readonly passwordFor = signal<Tenant | null>(null);
  readonly adminEmail = signal<string>('');
  readonly adminPassword = signal<string>('');
  readonly isSettingPassword = signal<boolean>(false);

  readonly filteredTenants = computed(() => {
    const q = this.search().trim().toLowerCase();
    const all = this.tenants();
    if (!q) return all;
    return all.filter(t =>
      t.id.toLowerCase().includes(q) || (t.name ?? '').toLowerCase().includes(q)
    );
  });

  readonly activeCount = computed(() => this.tenants().filter(t => t.active).length);
  readonly suspendedCount = computed(() => this.tenants().filter(t => !t.active).length);

  /**
   * A suggested id derived from the name, so the vendor rarely types one by
   * hand. Only ever a default — the field stays editable, because the id is
   * permanent and worth deliberate choice.
   */
  readonly suggestedId = computed(() =>
    this.newName().trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
  );

  ngOnInit(): void {
    this.loadTenants();
  }

  async loadTenants(): Promise<void> {
    this.setLoading(true);
    try {
      const result = await this.tenantService.listTenants(100);
      this.tenants.set(result.items);
    } catch {
      this.setError('Could not load organizations.');
    } finally {
      this.setLoading(false);
    }
  }

  openCreate(): void {
    this.newId.set('');
    this.newName.set('');
    this.newPlan.set('standard');
    this.newAdminEmail.set('');
    this.lastCreated.set(null);
    this.showCreate.set(true);
  }

  closeCreate(): void {
    this.showCreate.set(false);
    this.lastCreated.set(null);
  }

  /** Fill the id from the name unless the vendor has already typed one. */
  onNameChange(name: string): void {
    const wasSuggested = this.newId() === this.suggestedId();
    this.newName.set(name);
    if (!this.newId() || wasSuggested) this.newId.set(this.suggestedId());
  }

  async createTenant(): Promise<void> {
    const tenantId = this.newId().trim();
    const name = this.newName().trim();
    const adminEmail = this.newAdminEmail().trim();

    if (!name) { this.notification.warning('Enter a name for the organization.'); return; }
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(tenantId)) {
      this.notification.warning("The id may use lowercase letters, digits, '-' and '_' only.");
      return;
    }
    if (!adminEmail.includes('@')) {
      this.notification.warning('Enter the administrator\'s email address.');
      return;
    }

    this.isCreating.set(true);
    try {
      const created = await this.tenantService.createTenant({
        tenantId, name, plan: this.newPlan(), adminEmail
      });
      // Kept on screen rather than toasted away: the generated password cannot
      // be recovered once this is dismissed.
      this.lastCreated.set(created);
      this.notification.success(`${name} is ready.`);
      await this.loadTenants();
    } catch (error: unknown) {
      this.notification.error(
        error instanceof Error ? error.message : 'Could not create the organization.'
      );
    } finally {
      this.isCreating.set(false);
    }
  }

  openEdit(tenant: Tenant): void {
    this.editing.set(tenant);
    this.editName.set(tenant.name ?? '');
    this.editPlan.set(tenant.plan ?? 'standard');
  }

  closeEdit(): void {
    this.editing.set(null);
  }

  openAdminPassword(tenant: Tenant): void {
    this.adminEmail.set('');
    this.adminPassword.set('');
    this.passwordFor.set(tenant);
  }

  closeAdminPassword(): void {
    if (!this.isSettingPassword()) this.passwordFor.set(null);
  }

  async setAdminPassword(): Promise<void> {
    const tenant = this.passwordFor();
    const email = this.adminEmail().trim();
    const password = this.adminPassword();
    if (!tenant || !email || password.length < MIN_PASSWORD_LENGTH) {
      this.notification.warning(`Give the administrator's email and a password of at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    this.isSettingPassword.set(true);
    try {
      await this.tenantService.setAdministratorPassword(tenant.id, email, password);
      this.notification.success(`Password set for ${email}. Tell them the new one.`);
      this.passwordFor.set(null);
    } catch (error) {
      this.notification.error(error instanceof ServiceError ? error.message : 'Could not set the password.');
    } finally {
      this.isSettingPassword.set(false);
    }
  }

  async saveEdit(): Promise<void> {
    const tenant = this.editing();
    if (!tenant) return;
    const name = this.editName().trim();
    if (!name) { this.notification.warning('An organization needs a name.'); return; }

    this.isSaving.set(true);
    try {
      await this.tenantService.saveTenant({ ...tenant, name, plan: this.editPlan() });
      this.notification.success('Saved.');
      this.closeEdit();
      await this.loadTenants();
    } catch {
      this.notification.error('Could not save the organization.');
    } finally {
      this.isSaving.set(false);
    }
  }

  /**
   * Suspend or restore an organization.
   *
   * The API refuses a suspended organization's requests from the next one on;
   * `/me` still answers, so the app can say why.
   */
  async toggleActive(tenant: Tenant): Promise<void> {
    const next = !tenant.active;
    try {
      await this.tenantService.saveTenant({ ...tenant, active: next });
      this.notification.success(next ? `${tenant.name} restored.` : `${tenant.name} suspended.`);
      await this.loadTenants();
    } catch {
      this.notification.error('Could not change the organization\'s status.');
    }
  }

  async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.notification.success('Copied.');
    } catch {
      this.notification.warning('Could not copy — select the text manually.');
    }
  }

  formatDate(epochMs: number | undefined): string {
    if (!epochMs) return '—';
    return new Date(epochMs).toLocaleDateString();
  }
}
