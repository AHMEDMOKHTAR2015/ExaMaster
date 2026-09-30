import { Directive, ElementRef, EventEmitter, HostListener, Output, inject } from '@angular/core';

/**
 * Emits `appClickOutside` when a document click lands outside the host element.
 * Intended for the popup/dropdown-dismiss idiom used across the admin screens
 * (replaces the paired overlay-click + inner stopPropagation() wiring).
 */
@Directive({
  selector: '[appClickOutside]',
  standalone: true
})
export class ClickOutsideDirective {
  @Output() readonly appClickOutside = new EventEmitter<void>();

  private readonly elementRef = inject(ElementRef<HTMLElement>);

  /**
   * The click that reveals the host (e.g. an "Edit"/"Assign" trigger outside
   * it) is still bubbling to `document` when this directive is created, so an
   * unguarded listener catches that same click and closes the host the
   * instant it opens. Arm the listener on the next macrotask so it only ever
   * reacts to clicks that happen after this one has fully dispatched.
   */
  private armed = false;

  constructor() {
    setTimeout(() => { this.armed = true; });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.armed && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.appClickOutside.emit();
    }
  }
}
