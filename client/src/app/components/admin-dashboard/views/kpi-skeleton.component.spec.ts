import { TestBed } from '@angular/core/testing';
import { KpiSkeletonComponent } from './kpi-skeleton.component';

describe('KpiSkeletonComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [KpiSkeletonComponent] });
  });

  function render(inputs: { count?: number; columns?: number } = {}) {
    const fixture = TestBed.createComponent(KpiSkeletonComponent);
    if (inputs.count !== undefined) fixture.componentRef.setInput('count', inputs.count);
    if (inputs.columns !== undefined) fixture.componentRef.setInput('columns', inputs.columns);
    fixture.detectChanges();
    return fixture;
  }

  it('renders one placeholder tile per requested count', () => {
    const fixture = render({ count: 8 });
    expect(fixture.nativeElement.querySelectorAll('.stat--skeleton').length).toBe(8);
  });

  it('defaults to four tiles', () => {
    const fixture = render();
    expect(fixture.nativeElement.querySelectorAll('.stat--skeleton').length).toBe(4);
  });

  it('mirrors the real grid modifier so the swap causes no layout shift', () => {
    expect(render({ columns: 4 }).nativeElement.querySelector('.kpis').classList)
      .toContain('kpis--four');
    expect(render({ columns: 3 }).nativeElement.querySelector('.kpis').classList)
      .not.toContain('kpis--four');
  });

  it('is hidden from assistive technology — it conveys no information', () => {
    const fixture = render();
    expect(fixture.nativeElement.querySelector('.kpis').getAttribute('aria-hidden')).toBe('true');
  });

  it('renders no tiles for a count of zero rather than throwing', () => {
    const fixture = render({ count: 0 });
    expect(fixture.nativeElement.querySelectorAll('.stat--skeleton').length).toBe(0);
  });
});
