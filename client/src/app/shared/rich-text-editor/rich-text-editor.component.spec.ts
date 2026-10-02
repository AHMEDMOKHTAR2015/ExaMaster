import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { RichTextEditorComponent } from './rich-text-editor.component';

describe('RichTextEditorComponent', () => {
  it('never writes a script or event handler into its live editing surface, but keeps the formatting', () => {
    TestBed.configureTestingModule({
      imports: [RichTextEditorComponent],
      // the toolbar's TranslatePipe reads labels through TranslateService
      providers: [{ provide: TranslateService, useValue: { instant: (key: string) => key, translate: (key: string) => signal(key) } }]
    });
    const fixture = TestBed.createComponent(RichTextEditorComponent);
    (window as unknown as { pwned?: boolean }).pwned = false;

    fixture.componentRef.setInput('value', '<p>A <b>bold</b> start<img src="x" onerror="window.pwned = true"><script>window.pwned = true</script></p>');
    fixture.detectChanges();

    const surface: HTMLElement = fixture.nativeElement.querySelector('[contenteditable]');
    expect(surface.innerHTML).toContain('<b>bold</b>');
    expect(surface.innerHTML).not.toContain('onerror');
    expect(surface.innerHTML).not.toContain('<script');
    expect((window as unknown as { pwned?: boolean }).pwned).toBeFalse();
  });
});
