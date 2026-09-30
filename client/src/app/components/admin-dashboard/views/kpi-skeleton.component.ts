import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Placeholder tiles shown while dashboard statistics are being fetched.
 *
 * The figures behind the KPI tiles are counted by the server on request, so
 * there is a real gap between the dashboard rendering and the
 * numbers arriving. Without this the tiles mount showing `0`, which reads as a
 * result rather than as "still loading" — briefly telling an admin they have
 * zero users. Reserving the same space with a shimmer avoids both the false
 * reading and the layout shift when the real values land.
 *
 * Mirrors the grid and tile shape of the real markup so nothing moves on swap.
 * Uses the existing `.skeleton-shimmer` primitive rather than a new animation.
 */
@Component({
  selector: 'app-kpi-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="kpis" [class.kpis--four]="columns() === 4" aria-hidden="true">
      @for (tile of placeholders(); track $index) {
        <div class="stat stat--skeleton">
          <div class="stat__head">
            <span class="skeleton-shimmer stat-skeleton__label"></span>
            <span class="skeleton-shimmer stat-skeleton__icon"></span>
          </div>
          <div class="skeleton-shimmer stat-skeleton__value"></div>
        </div>
      }
    </div>
  `
})
export class KpiSkeletonComponent {
  /** How many placeholder tiles to render — match the real tile count. */
  readonly count = input<number>(4);

  /** Grid width, mirroring the `kpis--four` modifier on the real markup. */
  readonly columns = input<number>(4);

  /** `@for` needs something iterable; the values themselves are unused. */
  protected placeholders(): number[] {
    return Array.from({ length: this.count() }, (_, i) => i);
  }
}
