import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { TranslateService, TranslateStore, TranslationObject } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../auth';
import { ApiClient } from '../api/api-client.service';
import { AppLanguage } from '../language.service';
import { flattenTranslations, sanitizeOverrides, unflattenOverrides } from './translation-keys';

/** Both languages are loaded up front, so switching never waits on the server. */
const LANGUAGES: AppLanguage[] = ['en', 'ar'];

/** Never let an unreachable server hold the boot screen open. */
const SETTLE_TIMEOUT_MS = 1500;

/**
 * Merges a school's customised labels over the shipped `assets/i18n/{lang}.json`.
 *
 * The JSON assets remain the base and the source of truth for which keys exist;
 * the API holds only what a school changed. That layering is what makes the
 * feature safe: if the server is unreachable the app renders on the shipped
 * labels, uncustomised but complete, with no cache to invalidate.
 *
 * `LanguageService` is untouched and remains the only caller of
 * `translate.use()` — this service only ever calls `setTranslation`.
 *
 * Two properties of ngx-translate's store shape everything here, both verified
 * against @ngx-translate/core 18:
 *
 *  1. `setTranslations(lang, x, extend)` is
 *     `extend && hasTranslationFor(lang) ? mergeDeep(...) : x`. Merging into a
 *     language that has NOT loaded stores the overrides *as the whole language*
 *     and makes `hasTranslationFor` true forever, so the real file is never
 *     fetched — Arabic would show a handful of custom labels and a thousand raw
 *     keys. Hence the `hasTranslationFor` guard on every apply.
 *  2. `reloadLang()` deletes the language before refetching, blanking the UI for
 *     a round-trip. So reverting on sign-out restores a pristine snapshot taken
 *     before the first merge, which is synchronous and invisible.
 */
@Injectable({ providedIn: 'root' })
export class TranslationOverridesService {
  private readonly api = inject(ApiClient);
  private readonly authService = inject(AuthService);
  private readonly translate = inject(TranslateService);
  private readonly store = inject(TranslateStore);

  /** Raw override maps as the API returned them, keyed by language. */
  private overrides: Partial<Record<AppLanguage, Record<string, unknown>>> = {};

  /**
   * Each language's translations as they were before we first merged into them,
   * so sign-out can restore them without a refetch.
   */
  private pristine: Partial<Record<AppLanguage, TranslationObject>> = {};

  private unsubscribes: (() => void)[] = [];

  /**
   * The tenant the current listeners belong to. Makes the effect idempotent:
   * even if something re-triggers it, identical work is skipped rather than
   * reloading.
   */
  private watchedTenantId: string | null = null;

  /**
   * Bumped on every load, so the editor can react to its own save. A counter
   * rather than exposing the map as a signal: `apply()` runs inside the tenant
   * effect, and reading a signal there would make an override change re-run it.
   */
  private readonly _version = signal(0);
  readonly version = this._version.asReadonly();

  private readonly firstSnapshot = signal<Record<string, boolean>>({});
  private readonly watchdogFired = signal(false);
  private readonly tenantId = computed(() => this.authService.user()?.tenantId ?? null);

  /**
   * Whether the app may render without risking a flash of un-customised labels.
   *
   * True immediately when there is no tenant — a signed-out visitor has no
   * overrides to wait for, and the login screen must not sit behind this.
   */
  readonly settled = computed(() => {
    if (!this.tenantId()) return true;
    if (this.watchdogFired()) return true;
    const seen = this.firstSnapshot();
    return LANGUAGES.every(lang => seen[lang]);
  });

  constructor() {
    // Re-point at the new school whenever the signed-in user changes, and give
    // the previous one's labels back on the way out. Reads the auth signal
    // rather than TenantContextService so this re-runs on sign-out too.
    effect(() => {
      const tenantId = this.tenantId();

      // Everything below must be untracked. `TranslateStore.setTranslations`
      // READS the translations signal while writing it (it builds its change
      // event from `getTranslations(lang)`), so a bare call to
      // `revertToPristine()` here would make this effect depend on a signal it
      // then invalidates — re-running forever, and reloading on every pass. `allowSignalWrites`
      // permits the write but does not stop the re-trigger. The tenant is the
      // only thing this effect should react to.
      untracked(() => {
        if (tenantId === this.watchedTenantId) return;
        this.watchedTenantId = tenantId;
        this.stop();
        this.revertToPristine();
        this.overrides = {};
        this.firstSnapshot.set({});
        this.watchdogFired.set(false);
        if (!tenantId) return;

        const timer = setTimeout(() => this.watchdogFired.set(true), SETTLE_TIMEOUT_MS);
        this.unsubscribes.push(() => clearTimeout(timer));

        void this.load(tenantId);
      });
    }, { allowSignalWrites: true });

    // The moment a language's base lands in the store. Fires synchronously
    // after the loader replaced it, in the same tick as the currentLang signal
    // write, so the signal-backed pipe recomputes once with overrides already
    // applied and no un-customised frame is painted.
    //
    // Deliberately NOT `onTranslationChange`: our own `setTranslation` raises
    // that, which would re-enter this handler.
    this.translate.onLangChange
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.applyAll());

    // A language may already be in the store by the time this service is first
    // injected, in which case the event above has been and gone.
    this.applyAll();

    inject(DestroyRef).onDestroy(() => this.stop());
  }

  /** The saved overrides for one language, for the editor to show and diff against. */
  overridesFor(lang: AppLanguage): Record<string, unknown> {
    return this.overrides[lang] ?? {};
  }

  /** Read the school's overrides again — after the editor saved, say. */
  async reload(): Promise<void> {
    if (this.watchedTenantId) await this.load(this.watchedTenantId);
  }

  /** Both languages in one request (`GET /translation-overrides`). */
  private async load(tenantId: string): Promise<void> {
    let languages: Record<string, Record<string, unknown>> = {};
    try {
      languages = (await this.api.get<{ languages: Record<string, Record<string, unknown>> }>('/translation-overrides')).languages;
    } catch {
      // Offline, or refused. Degrade to the shipped labels rather than holding
      // the boot screen or surfacing an error the user cannot act on.
    }
    if (tenantId !== this.watchedTenantId) return;       // someone else signed in meanwhile
    for (const lang of LANGUAGES) {
      this.overrides[lang] = languages[lang] ?? {};
      this.markSeen(lang);
    }
    this._version.update(v => v + 1);
    this.applyAll();
  }

  private markSeen(lang: AppLanguage): void {
    this.firstSnapshot.update(seen => ({ ...seen, [lang]: true }));
  }

  /**
   * Apply every language's overrides.
   *
   * Loops rather than handling only the language that changed: with a fallback
   * language configured, a language can be loaded without ever becoming
   * current, and it still needs customising. Idempotent, so the load and the
   * language-change handler can both call it in any order.
   */
  private applyAll(): void {
    // Untracked for the reason given in the constructor: reading and writing
    // the store's translations signal inside a reactive caller would loop.
    untracked(() => {
      for (const lang of LANGUAGES) this.apply(lang);
    });
  }

  private apply(lang: AppLanguage): void {
    // See (1) in the class comment — without this the language is poisoned.
    if (!this.store.hasTranslationFor(lang)) return;

    const current = this.translate.getTranslations(lang) as TranslationObject;
    this.pristine[lang] ??= structuredClone(current) as TranslationObject;

    const baseFlat = flattenTranslations(this.pristine[lang]);
    const clean = sanitizeOverrides(this.overrides[lang], baseFlat);

    // Always re-apply from pristine rather than layering onto whatever is in
    // the store: an override that was just removed must actually disappear,
    // and merging can only ever add.
    this.translate.setTranslation(lang, this.pristine[lang]!, false);
    if (Object.keys(clean).length > 0) {
      this.translate.setTranslation(lang, unflattenOverrides(clean), true);
    }
  }

  /** Put the shipped labels back, without the refetch `reloadLang` would cost. */
  private revertToPristine(): void {
    for (const lang of LANGUAGES) {
      const snapshot = this.pristine[lang];
      if (snapshot) this.translate.setTranslation(lang, snapshot, false);
    }
    this.pristine = {};
  }

  private stop(): void {
    for (const unsubscribe of this.unsubscribes) unsubscribe();
    this.unsubscribes = [];
  }
}
