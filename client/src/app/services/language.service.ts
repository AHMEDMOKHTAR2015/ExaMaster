import { Injectable, signal, computed, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export type AppLanguage = 'en' | 'ar';

const STORAGE_KEY = 'qm_lang';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);

  readonly currentLang = signal<AppLanguage>(this.resolveInitialLang());
  readonly isRtl = computed(() => this.currentLang() === 'ar');
  readonly dir = computed(() => this.isRtl() ? 'rtl' : 'ltr');

  constructor() {
    this.applyLang(this.currentLang());
  }

  switchTo(lang: AppLanguage): void {
    if (lang === this.currentLang()) return;
    this.currentLang.set(lang);
    localStorage.setItem(STORAGE_KEY, lang);
    this.applyLang(lang);
  }

  toggle(): void {
    this.switchTo(this.currentLang() === 'en' ? 'ar' : 'en');
  }

  /**
   * The single place the app's language changes.
   *
   * Keep this the only caller of `translate.use()`. A school's customised
   * labels are layered on top afterwards by `TranslationOverridesService`,
   * which listens to `onLangChange` and calls `setTranslation` — it never
   * touches `use()`, so the two cannot fight over the store.
   */
  private applyLang(lang: AppLanguage): void {
    this.translate.use(lang);
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  }

  private resolveInitialLang(): AppLanguage {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'ar') return stored;
    const browser = navigator.language.split('-')[0];
    return browser === 'ar' ? 'ar' : 'en';
  }
}
