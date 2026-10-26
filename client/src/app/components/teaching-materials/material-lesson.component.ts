import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { MaterialLesson, MaterialUnit } from '../../models';
import { InlineTextComponent } from '../../shared/inline-text.component';

/** What a lesson page shows of its unit: its heading, and the takeaways its last lesson closes with. */
export type LessonUnit = Pick<MaterialUnit, 'kind' | 'number' | 'title' | 'keyTakeaways'>;

/**
 * One lesson, every block as the book gives it, with the Arabic explanation
 * (right-to-left) beneath and, on a unit's last lesson, its key takeaways.
 * Shared by the material reader and the Teaching Room board, so a lesson looks
 * the same wherever it is read.
 */
@Component({
  selector: 'app-material-lesson',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, InlineTextComponent],
  templateUrl: './material-lesson.component.html'
})
export class MaterialLessonComponent {
  readonly unit = input.required<LessonUnit>();
  readonly lesson = input.required<MaterialLesson>();
  readonly closesUnit = input(false);
}
