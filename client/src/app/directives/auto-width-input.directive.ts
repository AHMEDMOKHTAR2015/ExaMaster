import { Directive, ElementRef, HostListener, afterNextRender, inject } from '@angular/core';

/**
 * Grows a text input to fit what has been typed, so a student can read their whole answer (a Complete blank).
 *
 * The text is measured with the input's own font, which is exact for any script — counting characters (`ch`) is
 * not: Arabic letters are much narrower or wider than a "0". Never narrower than the element's CSS `min-width`, and
 * capped by its `max-width` (beyond that the input scrolls, as any input does).
 */
@Directive({
  selector: 'input[appAutoWidth]',
  standalone: true
})
export class AutoWidthInputDirective {
  private static measuring?: CanvasRenderingContext2D | null;

  private readonly input = inject(ElementRef<HTMLInputElement>).nativeElement as HTMLInputElement;

  constructor() {
    // after the first render the bound value is in place (a question revisited with an answer already typed);
    // once web fonts have loaded the text measures differently, so fit again then
    afterNextRender(() => {
      this.fit();
      void document.fonts?.ready.then(() => this.fit());
    });
  }

  @HostListener('input')
  fit(): void {
    const context = AutoWidthInputDirective.measuring ??= document.createElement('canvas').getContext('2d');
    if (!context) return;

    const style = getComputedStyle(this.input);
    context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const textWidth = context.measureText(this.input.value || this.input.placeholder).width;

    const px = (value: string) => parseFloat(value) || 0;
    const frame = style.boxSizing === 'border-box'
      ? px(style.paddingLeft) + px(style.paddingRight) + px(style.borderLeftWidth) + px(style.borderRightWidth)
      : 0;
    const caret = px(style.fontSize) * 0.5;                // room for the caret, so the last letter is never clipped
    this.input.style.width = `${Math.ceil(textWidth + frame + caret)}px`;
  }
}
