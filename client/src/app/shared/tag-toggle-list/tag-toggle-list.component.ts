import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SubjectTag } from '../../models';

/**
 * A subject's tags as toggle chips: pressing one adds it to, or takes it out of, `selected`.
 * Used wherever a question is tagged (bank question form, bulk edit, teacher quiz editor).
 */
@Component({
    selector: 'app-tag-toggle-list',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [TranslatePipe],
    template: `
    <div class="tag-toggle-list" role="group" [attr.aria-label]="label()">
      @for (tag of tags(); track tag.id) {
        <button type="button" class="tag-toggle" [class.is-on]="selected().includes(tag.id)"
                [attr.aria-pressed]="selected().includes(tag.id)" (click)="toggle(tag.id)">
          {{ tag.name }}
        </button>
      } @empty {
        <span class="tag-toggle-list__empty">{{ emptyText() | translate }}</span>
      }
    </div>
  `
})
export class TagToggleListComponent {
  readonly tags = input.required<readonly SubjectTag[]>();
  readonly selected = input.required<readonly string[]>();
  /** Names the group for assistive technology. */
  readonly label = input<string>('');
  /** i18n key shown when the subject has no tags. */
  readonly emptyText = input<string>('tags.noneInSubject');
  readonly selectedChange = output<string[]>();

  toggle(tagId: string): void {
    const current = this.selected();
    this.selectedChange.emit(current.includes(tagId) ? current.filter(id => id !== tagId) : [...current, tagId]);
  }
}
