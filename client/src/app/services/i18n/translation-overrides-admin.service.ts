import { Injectable, inject } from '@angular/core';
import { AppLanguage } from '../language.service';
import { ApiClient } from '../api/api-client.service';
import { TranslationOverridesService } from './translation-overrides.service';

/**
 * Writes to a school's label overrides (`/translation-overrides/{lang}`). Read
 * side lives in `TranslationOverridesService`, which every session runs; this
 * is only pulled in by the editor route.
 *
 * A save names only the labels that changed, so two admins editing different
 * labels at the same time both land. After each write the read side reloads,
 * which is what the editor watches (`version`).
 */
@Injectable({ providedIn: 'root' })
export class TranslationOverridesAdminService {
  private readonly api = inject(ApiClient);
  private readonly overrides = inject(TranslationOverridesService);

  /** Apply an edit session: `changed` keys are set, `removed` keys go back to the shipped wording. */
  async saveChanges(lang: AppLanguage, changed: Record<string, string>, removed: string[]): Promise<void> {
    await this.api.put(`/translation-overrides/${lang}`, { changed, removed });
    await this.overrides.reload();
  }

  /** Drop every customisation for one language and fall back to the shipped labels. */
  async resetAll(lang: AppLanguage): Promise<void> {
    await this.api.delete(`/translation-overrides/${lang}`);
    await this.overrides.reload();
  }
}
