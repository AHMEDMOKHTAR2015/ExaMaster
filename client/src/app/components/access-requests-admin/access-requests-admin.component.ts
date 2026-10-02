import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { BaseComponent } from '../../shared/base/base.component';
import { NotificationService } from '../../services/notification.service';
import { AccessRequestService } from '../../services/access-requests/access-request.service';
import { ServiceError } from '../../services/shared/service-error';
import {
  AccessRequest,
  AccessRequestClassOption,
  AccessRequestKind,
  AccessRequestParentOption,
  AccessRequestStatus,
  AccessRequestTenantOption
} from '../../models';

type StatusTab = AccessRequestStatus | 'all';

/** A new parent's children allowance unless the reviewer changes it. */
const DEFAULT_MAX_CHILDREN = 3;
const SEARCH_DEBOUNCE_MS = 300;

interface ClassGroupOption {
  label: string;
  classes: AccessRequestClassOption[];
}

/**
 * The platform administrator's review of access requests: visitors with no
 * registration key asking to join as a parent or a child.
 *
 * Approving is where the request gets its organization — the visitor's own
 * words about their school are only a hint. A parent gets a family key of
 * their own with the allowance chosen here; a child is placed in a class and
 * linked to a parent of that organization, on one of that parent's slots.
 * Rejecting can give a reason, which the visitor sees when they try to sign in.
 */
@Component({
    selector: 'app-access-requests-admin',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, DatePipe, RouterLink, TranslatePipe],
    templateUrl: './access-requests-admin.component.html'
})
export class AccessRequestsAdminComponent extends BaseComponent implements OnInit {
  private readonly service = inject(AccessRequestService);
  private readonly notification = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly pageSize = 20;
  readonly tabs: StatusTab[] = ['pending', 'approved', 'rejected', 'all'];

  readonly tab = signal<StatusTab>('pending');
  readonly kindFilter = signal<AccessRequestKind | 'all'>('all');
  readonly search = signal<string>('');
  readonly page = signal<number>(1);

  readonly requests = signal<AccessRequest[]>([]);
  readonly totalCount = signal<number>(0);
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize)));
  readonly pendingCount = this.service.pendingCount;

  // --- review dialog ---------------------------------------------------------
  readonly reviewing = signal<AccessRequest | null>(null);
  readonly tenants = signal<AccessRequestTenantOption[]>([]);
  readonly tenantId = signal<number | null>(null);
  readonly maxChildren = signal<number | null>(DEFAULT_MAX_CHILDREN);
  readonly classes = signal<AccessRequestClassOption[]>([]);
  readonly classId = signal<number | null>(null);
  readonly parentSearch = signal<string>('');
  readonly parents = signal<AccessRequestParentOption[]>([]);
  readonly parentId = signal<number | null>(null);
  readonly isLoadingOptions = signal<boolean>(false);
  readonly isSearchingParents = signal<boolean>(false);
  readonly isRejecting = signal<boolean>(false);
  readonly rejectReason = signal<string>('');
  readonly isDeciding = signal<boolean>(false);
  readonly decisionError = signal<string | null>(null);

  /** Classes under "Stage › Grade" headings, the order the API returns them in. */
  readonly classGroups = computed<ClassGroupOption[]>(() => {
    const groups = new Map<string, AccessRequestClassOption[]>();
    for (const option of this.classes()) {
      const label = `${option.stageName} › ${option.gradeName}`;
      groups.set(label, [...(groups.get(label) ?? []), option]);
    }
    return [...groups].map(([label, classes]) => ({ label, classes }));
  });

  readonly canApprove = computed(() => {
    const request = this.reviewing();
    if (!request || this.tenantId() === null || this.isDeciding()) return false;
    if (request.kind === 'parent') return this.maxChildren() === null || this.maxChildren()! >= 0;
    const parent = this.parents().find(p => p.id === this.parentId());
    return this.classId() !== null && !!parent && this.parentSelectable(parent);
  });

  private listGeneration = 0;
  private parentGeneration = 0;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private parentSearchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    inject(DestroyRef).onDestroy(() => {
      if (this.searchTimer) clearTimeout(this.searchTimer);
      if (this.parentSearchTimer) clearTimeout(this.parentSearchTimer);
    });
  }

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    const generation = ++this.listGeneration;
    this.setLoading(true);
    this.clearError();
    try {
      const tab = this.tab();
      const kind = this.kindFilter();
      const result = await this.service.list({
        status: tab === 'all' ? undefined : tab,
        kind: kind === 'all' ? undefined : kind,
        search: this.search(),
        page: this.page(),
        pageSize: this.pageSize
      });
      if (generation !== this.listGeneration) return;
      this.requests.set(result.items);
      this.totalCount.set(result.totalCount);
      // a decision on another device can leave this page past the end
      if (result.items.length === 0 && this.page() > 1) {
        this.page.set(this.totalPages());
        void this.load();
      }
    } catch (error) {
      if (generation === this.listGeneration) this.setError(this.messageOf(error, 'accessRequests.errors.load'));
    } finally {
      if (generation === this.listGeneration) this.setLoading(false);
    }
  }

  refresh(): void {
    void this.load();
    void this.service.refreshPendingCount();
  }

  selectTab(tab: StatusTab): void {
    if (this.tab() === tab) return;
    this.tab.set(tab);
    this.page.set(1);
    void this.load();
  }

  selectKind(kind: AccessRequestKind | 'all'): void {
    this.kindFilter.set(kind);
    this.page.set(1);
    void this.load();
  }

  onSearch(value: string): void {
    this.search.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page.set(1);
      void this.load();
    }, SEARCH_DEBOUNCE_MS);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.page()) return;
    this.page.set(page);
    void this.load();
  }

  // --- review ----------------------------------------------------------------

  async openReview(request: AccessRequest): Promise<void> {
    this.reviewing.set(request);
    this.decisionError.set(null);
    this.isRejecting.set(false);
    this.rejectReason.set('');
    this.tenantId.set(null);
    this.maxChildren.set(DEFAULT_MAX_CHILDREN);
    this.classes.set([]);
    this.classId.set(null);
    this.parents.set([]);
    this.parentId.set(null);
    // the visitor's own words about their parent are the best first search
    this.parentSearch.set(request.parentMobileNumber?.replace(/\D/g, '') || request.parentName || '');

    if (request.status !== 'pending' || this.tenants().length > 0) return;
    try {
      this.tenants.set(await this.service.listTenants());
    } catch (error) {
      this.decisionError.set(this.messageOf(error, 'accessRequests.errors.options'));
    }
  }

  closeReview(): void {
    if (this.isDeciding()) return;
    this.reviewing.set(null);
  }

  async onTenantChange(tenantId: number | null): Promise<void> {
    this.tenantId.set(tenantId);
    this.classes.set([]);
    this.classId.set(null);
    this.parents.set([]);
    this.parentId.set(null);
    this.decisionError.set(null);
    if (tenantId === null || this.reviewing()?.kind !== 'child') return;

    this.isLoadingOptions.set(true);
    try {
      const [classes] = await Promise.all([this.service.listClasses(tenantId), this.searchParents()]);
      if (this.tenantId() === tenantId) this.classes.set(classes);
    } catch (error) {
      this.decisionError.set(this.messageOf(error, 'accessRequests.errors.options'));
    } finally {
      this.isLoadingOptions.set(false);
    }
  }

  onParentSearch(value: string): void {
    this.parentSearch.set(value);
    if (this.parentSearchTimer) clearTimeout(this.parentSearchTimer);
    this.parentSearchTimer = setTimeout(() => void this.searchParents(), SEARCH_DEBOUNCE_MS);
  }

  /** A child can only join a family whose key is usable and has a slot left. */
  parentSelectable(parent: AccessRequestParentOption): boolean {
    return parent.hasUsableKey && (parent.maxChildren === undefined || parent.childCount < parent.maxChildren);
  }

  onMaxChildrenChange(value: number | string | null): void {
    const text = value === null ? '' : String(value).trim();
    this.maxChildren.set(text === '' ? null : Math.max(0, Math.floor(Number(text))));
  }

  async approve(): Promise<void> {
    const request = this.reviewing();
    const tenantId = this.tenantId();
    if (!request || tenantId === null || !this.canApprove()) return;

    this.isDeciding.set(true);
    this.decisionError.set(null);
    try {
      await this.service.approve(request.id, request.kind === 'parent'
        ? { tenantId, maxChildren: this.maxChildren() }
        : { tenantId, classId: this.classId()!, parentId: this.parentId()! });
      this.notification.success(this.translate.instant('accessRequests.toasts.approved', { name: `${request.firstName} ${request.lastName}` }));
      this.isDeciding.set(false);
      this.closeReview();
      void this.load();
    } catch (error) {
      this.decisionError.set(this.messageOf(error, 'accessRequests.errors.decide'));
      this.isDeciding.set(false);
    }
  }

  async reject(): Promise<void> {
    const request = this.reviewing();
    if (!request || this.isDeciding()) return;

    this.isDeciding.set(true);
    this.decisionError.set(null);
    try {
      await this.service.reject(request.id, this.rejectReason());
      this.notification.success(this.translate.instant('accessRequests.toasts.rejected'));
      this.isDeciding.set(false);
      this.closeReview();
      void this.load();
    } catch (error) {
      this.decisionError.set(this.messageOf(error, 'accessRequests.errors.decide'));
      this.isDeciding.set(false);
    }
  }

  private async searchParents(): Promise<void> {
    const tenantId = this.tenantId();
    if (tenantId === null) return;
    const generation = ++this.parentGeneration;
    this.isSearchingParents.set(true);
    try {
      const parents = await this.service.searchParents(tenantId, this.parentSearch());
      if (generation !== this.parentGeneration || this.tenantId() !== tenantId) return;
      this.parents.set(parents);
      // keep the choice only while it is still on the list
      if (!parents.some(p => p.id === this.parentId())) this.parentId.set(null);
    } catch (error) {
      if (generation === this.parentGeneration) this.decisionError.set(this.messageOf(error, 'accessRequests.errors.options'));
    } finally {
      if (generation === this.parentGeneration) this.isSearchingParents.set(false);
    }
  }

  /** The API words its refusals for people (a full family key, a number already in use); otherwise a generic line. */
  private messageOf(error: unknown, fallbackKey: string): string {
    return error instanceof ServiceError && error.code !== 'unknown' && error.code !== '500'
      ? error.message
      : this.translate.instant(fallbackKey);
  }
}
