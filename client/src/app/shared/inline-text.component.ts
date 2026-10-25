import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { inlineSegments } from './inline-text';

/** Text with `**bold**` / `*italic*` rendered as elements, never as HTML (see {@link inlineSegments}). */
@Component({
  selector: 'app-inline-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@for (segment of segments(); track $index) {@if (segment.bold) {<strong>{{ segment.text }}</strong>} @else if (segment.italic) {<em>{{ segment.text }}</em>} @else {<span>{{ segment.text }}</span>}}`
})
export class InlineTextComponent {
  readonly text = input.required<string>();
  readonly segments = computed(() => inlineSegments(this.text()));
}
