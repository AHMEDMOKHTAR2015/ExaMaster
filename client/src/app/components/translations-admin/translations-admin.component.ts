import { ServiceError } from '../../services/shared/service-error';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { BaseComponent } from '../../shared/base/base.component';
import { NotificationService } from '../../services/notification.service';
import { AppLanguage, LanguageService } from '../../services/language.service';
import { TranslationCatalogService } from '../../services/i18n/translation-catalog.service';
import { TranslationOverridesService } from '../../services/i18n/translation-overrides.service';
import { TranslationOverridesAdminService } from '../../services/i18n/translation-overrides-admin.service';
import { OverrideIssue, validateOverride } from '../../services/i18n/translation-keys';

const PAGE_SIZE = 50;

type RowFilter = 'all' | 'customised' | 'unsaved' | 'invalid';

interface LabelRow {
  key: string;
  namespace: string;
  base: string;
  /** What is currently in the box: the draft if touched, else what is saved. */
  value: string;
  /** Saved on the server right now. */
  saved: string;
  /** Touched in this session and not yet written. */
  dirty: boolean;
  issue: OverrideIssue | null;
}

/**
 * Lets a school reword the UI without a redeploy.
 *
 * Edits only *this* school's labels — the overrides live under its own tenant,
 * so one customer's wording never reaches another's screens.
 */
@Component({
    selector: 'app-translations-admin',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, TranslatePipe],
    templateUrl: './translations-admin.component.html'
})
export class TranslationsAdminComponent extends BaseComponent implements OnInit {
  private readonly catalog = inject(TranslationCatalogService);
  private readonly overrides = inject(TranslationOverridesService);
  private readonly writer = inject(TranslationOverridesAdminService);
  private readonly notification = inject(NotificationService);
  private readonly languageService = inject(LanguageService);

  /**
   * Which language is being edited — independent of the language the app is
   * displayed in. Changing it must never call `languageService.switchTo()`:
   * an admin editing Arabic labels from an English UI is the normal case.
   */
  readonly editLang = signal<AppLanguage>(this.languageService.currentLang());
  readonly languages: AppLanguage[] = ['en', 'ar'];

  /** Flat shipped labels for {@link editLang}. */
  private readonly base = signal<Record<string, string>>({});
  readonly namespaces = this.catalog.namespaces;

  /** Only the keys touched this session. `null` means "queued for reset". */
  private readonly draft = signal<Record<string, string | null>>({});

  readonly search = signal('');
  readonly namespace = signal('');
  readonly filter = signal<RowFilter>('all');
  readonly page = signal(0);
  readonly isSaving = signal(false);

  private saved(): Record<string, string> {
    // Depend on the service's snapshot counter so the rows refresh when this
    // admin saves, and when a colleague editing in another window does.
    this.overrides.version();
    return this.overrides.overridesFor(this.editLang()) as Record<string, string>;
  }

  /** Every key, with its base, its current value and any validation problem. */
  readonly allRows = computed<LabelRow[]>(() => {
    const base = this.base();
    const saved = this.saved();
    const draft = this.draft();

    return Object.keys(base).sort().map(key => {
      const dirty = key in draft;
      const savedValue = saved[key] ?? '';
      const value = dirty ? (draft[key] ?? '') : savedValue;
      return {
        key,
        namespace: key.split('.')[0],
        base: base[key],
        value,
        saved: savedValue,
        dirty,
        issue: value ? validateOverride(base[key], value) : null
      };
    });
  });

  readonly customisedCount = computed(() => this.allRows().filter(r => r.saved).length);
  readonly unsavedCount = computed(() => this.allRows().filter(r => r.dirty).length);
  readonly invalidCount = computed(() => this.allRows().filter(r => r.issue).length);
  readonly canSave = computed(() => this.unsavedCount() > 0 && this.invalidCount() === 0);

  readonly filteredRows = computed(() => {
    const q = this.search().trim().toLowerCase();
    const ns = this.namespace();
    const filter = this.filter();

    return this.allRows().filter(row => {
      if (ns && row.namespace !== ns) return false;
      if (filter === 'customised' && !row.saved) return false;
      if (filter === 'unsaved' && !row.dirty) return false;
      if (filter === 'invalid' && !row.issue) return false;
      if (!q) return true;
      return row.key.toLowerCase().includes(q)
        || row.base.toLowerCase().includes(q)
        || row.value.toLowerCase().includes(q);
    });
  });

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredRows().length / PAGE_SIZE))
  );

  readonly pagedRows = computed(() => {
    const start = Math.min(this.page(), this.totalPages() - 1) * PAGE_SIZE;
    return this.filteredRows().slice(start, start + PAGE_SIZE);
  });

  readonly pageLabel = computed(() => {
    const total = this.filteredRows().length;
    if (total === 0) return '0';
    const start = Math.min(this.page(), this.totalPages() - 1) * PAGE_SIZE;
    return `${start + 1}–${Math.min(start + PAGE_SIZE, total)} of ${total}`;
  });

  ngOnInit(): void {
    this.loadCatalog();
  }

  private async loadCatalog(): Promise<void> {
    this.setLoading(true);
    try {
      this.base.set(await this.catalog.load(this.editLang()));
    } catch {
      this.setError('Could not load the shipped labels.');
    } finally {
      this.setLoading(false);
    }
  }

  async switchEditLang(lang: AppLanguage): Promise<void> {
    if (lang === this.editLang()) return;
    if (this.unsavedCount() > 0
        && !confirm('You have unsaved changes. Switch language and lose them?')) {
      return;
    }
    this.editLang.set(lang);
    this.draft.set({});
    this.page.set(0);
    await this.loadCatalog();
  }

  /**
   * An override identical to the shipped label is recorded as a reset, not
   * stored. Keeping it would freeze that label: when a developer later fixes a
   * typo in the JSON, this school would silently keep the old wording with
   * nothing on screen to explain why.
   */
  edit(row: LabelRow, value: string): void {
    this.draft.update(d => ({ ...d, [row.key]: value.trim() === row.base ? null : value }));
  }

  reset(row: LabelRow): void {
    this.draft.update(d => ({ ...d, [row.key]: null }));
  }

  /** Drop an unsaved edit and go back to what is stored. */
  revert(row: LabelRow): void {
    this.draft.update(d => {
      const next = { ...d };
      delete next[row.key];
      return next;
    });
  }

  setFilter(filter: RowFilter): void {
    this.filter.set(filter);
    this.page.set(0);
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.page.set(0);
  }

  onNamespace(value: string): void {
    this.namespace.set(value);
    this.page.set(0);
  }

  prevPage(): void { this.page.update(p => Math.max(0, p - 1)); }
  nextPage(): void { this.page.update(p => Math.min(this.totalPages() - 1, p + 1)); }

  async save(): Promise<void> {
    if (!this.canSave()) return;

    const draft = this.draft();
    const changed: Record<string, string> = {};
    const removed: string[] = [];
    for (const [key, value] of Object.entries(draft)) {
      if (value === null) removed.push(key);
      else changed[key] = value;
    }

    this.isSaving.set(true);
    try {
      await this.writer.saveChanges(this.editLang(), changed, removed);
      this.draft.set({});
      this.notification.success('Labels saved.');
    } catch (error) {
      this.notification.error(error instanceof ServiceError ? error.message : 'Could not save the labels.');
    } finally {
      this.isSaving.set(false);
    }
  }

  async resetAll(): Promise<void> {
    if (!confirm(`Remove every customised label for "${this.editLang()}" and use the shipped wording?`)) {
      return;
    }
    this.isSaving.set(true);
    try {
      await this.writer.resetAll(this.editLang());
      this.draft.set({});
      this.notification.success('Reset to the shipped labels.');
    } catch {
      this.notification.error('Could not reset the labels.');
    } finally {
      this.isSaving.set(false);
    }
  }

  /** Human-readable reason a row is rejected. */
  issueText(issue: OverrideIssue): string {
    switch (issue.kind) {
      case 'empty': return 'Empty — use Reset instead';
      case 'tooLong': return 'Too long';
      case 'missingParams': return `Missing ${issue.params?.map(p => `{{ ${p} }}`).join(', ')}`;
      case 'unknownParams': return `Unknown ${issue.params?.map(p => `{{ ${p} }}`).join(', ')}`;
    }
  }

  trackKey = (_: number, row: LabelRow): string => row.key;
}
