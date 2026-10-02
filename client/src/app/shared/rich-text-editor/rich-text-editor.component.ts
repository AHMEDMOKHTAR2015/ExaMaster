import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  SecurityContext,
  effect,
  inject,
  input,
  output,
  viewChild
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { TranslatePipe } from '@ngx-translate/core';

/** One toolbar button: the `execCommand` it runs and its i18n label key. */
interface ToolbarAction {
  command: string;
  labelKey: string;
  icon: string;
}

/**
 * A small rich-text editor built on `contenteditable`.
 *
 * Deliberately hand-rolled rather than pulled from a library: this repo carries
 * no UI dependencies at all (no Material, no CDK, no editor), and the Explain
 * question type needs only basic emphasis and lists. Everything here is plain
 * HTML plus `document.execCommand`, which — while formally deprecated — is
 * still the only universally supported way to apply formatting inside a
 * `contenteditable` without shipping a full editing engine.
 *
 * The value is HTML. Every consumer renders it through Angular's `[innerHTML]`,
 * which sanitizes by default (scripts, event handlers and `javascript:` URLs are
 * stripped) — student-written HTML ends up in a teacher's review screen, so
 * nothing on this path may ever call `bypassSecurityTrustHtml`. The one place
 * HTML is written straight into the DOM — this editor's own surface, filled
 * when a stored question or answer is opened for editing — runs it through the
 * same sanitizer first (the server also cleans it on save).
 */
@Component({
    selector: 'rich-text-editor',
    templateUrl: './rich-text-editor.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [TranslatePipe]
})
export class RichTextEditorComponent {
  readonly value = input<string>('');
  readonly placeholder = input<string>('');
  readonly disabled = input<boolean>(false);
  readonly ariaLabel = input<string>('');
  readonly valueChange = output<string>();
  /** Fires when the field loses focus — a good moment to act on a finished answer. */
  readonly editingFinished = output<string>();

  private readonly surface = viewChild.required<ElementRef<HTMLElement>>('surface');
  private readonly sanitizer = inject(DomSanitizer);

  /** Last value this component emitted, so incoming echoes don't reset the caret. */
  private lastEmitted = '';

  readonly actions: ToolbarAction[] = [
    { command: 'bold', labelKey: 'richText.bold', icon: 'B' },
    { command: 'italic', labelKey: 'richText.italic', icon: 'I' },
    { command: 'underline', labelKey: 'richText.underline', icon: 'U' },
    { command: 'insertUnorderedList', labelKey: 'richText.bulletList', icon: '•' },
    { command: 'insertOrderedList', labelKey: 'richText.numberedList', icon: '1.' }
  ];

  constructor() {
    // Write the incoming value into the DOM only when it genuinely differs from
    // what the surface already holds. Re-assigning `innerHTML` while the user is
    // typing would collapse the selection to the start of the field.
    effect(() => {
      const incoming = this.value() ?? '';
      const element = this.surface().nativeElement;
      if (incoming === this.lastEmitted || incoming === element.innerHTML) return;
      // a live contenteditable runs an <img onerror> the moment it is assigned: never write unsanitized HTML here
      element.innerHTML = this.sanitizer.sanitize(SecurityContext.HTML, incoming) ?? '';
    });
  }

  /** Whether the surface is visually empty, so the placeholder can show through. */
  get isEmpty(): boolean {
    return (this.value() ?? '').replace(/<[^>]*>|&nbsp;|\s/g, '').length === 0;
  }

  run(command: string, event: Event): void {
    // Keep focus on the surface: a mousedown on the button would otherwise blur
    // it first and execCommand would have no selection to act on.
    event.preventDefault();
    if (this.disabled()) return;
    this.surface().nativeElement.focus();
    document.execCommand(command, false);
    this.emit();
  }

  onInput(): void {
    this.emit();
  }

  onBlur(): void {
    this.emit();
    this.editingFinished.emit(this.lastEmitted);
  }

  private emit(): void {
    const html = this.surface().nativeElement.innerHTML;
    if (html === this.lastEmitted) return;
    this.lastEmitted = html;
    this.valueChange.emit(html);
  }
}
