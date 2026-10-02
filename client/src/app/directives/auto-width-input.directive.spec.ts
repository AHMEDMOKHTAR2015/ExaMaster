import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AutoWidthInputDirective } from './auto-width-input.directive';

@Component({
    imports: [AutoWidthInputDirective],
    template: `<div style="width: 600px"><input appAutoWidth placeholder="…" style="min-width: 5ch; max-width: 100%; font: 16px sans-serif; padding: 4px 10px; box-sizing: border-box" /></div>`
})
class HostComponent {}

describe('AutoWidthInputDirective', () => {
  function render(): HTMLInputElement {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('input');
  }

  function type(input: HTMLInputElement, text: string): number {
    input.value = text;
    input.dispatchEvent(new Event('input'));
    return input.getBoundingClientRect().width;
  }

  it('grows as the answer gets longer, in any script', () => {
    const input = render();

    const short = type(input, 'ab');
    const long = type(input, 'a much longer answer typed by the student');
    const arabic = type(input, 'التشفير المتماثل يستخدم المفتاح نفسه');

    expect(long).toBeGreaterThan(short);
    expect(arabic).toBeGreaterThan(short);
  });

  it('never shrinks below its minimum width, and never past its container', () => {
    const input = render();
    const minimum = parseFloat(getComputedStyle(input).minWidth);   // 5ch

    expect(type(input, 'a')).toBeCloseTo(minimum, 0);
    expect(type(input, 'x'.repeat(500))).toBeLessThanOrEqual(600);
  });
});
