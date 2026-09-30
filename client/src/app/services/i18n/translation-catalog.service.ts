import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AppLanguage } from '../language.service';
import { flattenTranslations } from './translation-keys';

/**
 * The shipped labels, flat and uncustomised — the left-hand column of the
 * editor and the thing every override is validated against.
 *
 * Fetched from the asset rather than read out of `TranslateService`: by the
 * time the editor opens, the store already has this school's overrides merged
 * in, so it is no longer the base. Reading it there would make an override
 * validate against itself and would show a customised label in the "original"
 * column.
 *
 * The file is browser-cached, so this costs one conditional GET per language.
 */
@Injectable({ providedIn: 'root' })
export class TranslationCatalogService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<AppLanguage, Record<string, string>>();

  /** Namespaces present in the catalogue, in the order they appear in the file. */
  readonly namespaces = signal<string[]>([]);

  async load(lang: AppLanguage): Promise<Record<string, string>> {
    const cached = this.cache.get(lang);
    if (cached) {
      this.namespaces.set(this.namespacesOf(cached));
      return cached;
    }

    const raw = await firstValueFrom(this.http.get<unknown>(`assets/i18n/${lang}.json`));
    const flat = flattenTranslations(raw);
    this.cache.set(lang, flat);
    this.namespaces.set(this.namespacesOf(flat));
    return flat;
  }

  private namespacesOf(flat: Record<string, string>): string[] {
    const seen = new Set<string>();
    for (const key of Object.keys(flat)) seen.add(key.split('.')[0]);
    return [...seen].sort();
  }
}
