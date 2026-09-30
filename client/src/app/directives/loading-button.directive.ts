import { Directive, ElementRef, Renderer2, effect, inject, input } from '@angular/core';

/**
 * Disables the host button and injects the shared `.spinner-inline` element
 * (styles.css) while `appLoadingButton()` is true, replacing the
 * `[disabled]="loading()"` + `@if (loading()) { <span class="spinner-inline">... }`
 * pairing duplicated across the admin save/submit buttons. Only handles the
 * disable+spinner pairing — the label text swap stays in the template since
 * it varies per button.
 */
@Directive({
  selector: '[appLoadingButton]',
  standalone: true
})
export class LoadingButtonDirective {
  readonly appLoadingButton = input<boolean>(false);

  private readonly elementRef = inject(ElementRef<HTMLButtonElement>);
  private readonly renderer = inject(Renderer2);
  private spinner: HTMLSpanElement | null = null;

  constructor() {
    effect(() => {
      const loading = this.appLoadingButton();
      const button = this.elementRef.nativeElement;
      this.renderer.setProperty(button, 'disabled', loading);

      if (loading && !this.spinner) {
        this.spinner = this.renderer.createElement('span');
        this.renderer.addClass(this.spinner, 'spinner-inline');
        this.renderer.setAttribute(this.spinner, 'aria-hidden', 'true');
        this.renderer.insertBefore(button, this.spinner, button.firstChild);
      } else if (!loading && this.spinner) {
        this.renderer.removeChild(button, this.spinner);
        this.spinner = null;
      }
    });
  }
}
