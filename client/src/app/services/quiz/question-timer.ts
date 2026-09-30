import { Signal, signal } from '@angular/core';

/**
 * mm:ss, the only format a quiz clock is ever shown in — exported because the
 * whole-quiz total on the runner has to match the per-question labels exactly.
 */
export function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const secs = Math.round(totalSeconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

/**
 * The countdown for a single question: the two labels the quiz screen renders
 * ("remaining / total") and the callback that fires when time runs out.
 *
 * A plain class, not an `@Injectable` — a runner owns one instance for the
 * question it is currently showing, which is not a thing the injector can hand
 * out as a singleton.
 *
 * `onExpired` is a constructor dependency rather than an event the caller polls
 * for, so the timer stays ignorant of what expiry means: `QuizRunnerService`
 * decides whether that is "advance" or "submit the attempt".
 */
export class QuestionTimer {
  private readonly _remaining = signal<string>(formatTime(0));
  private readonly _durationLabel = signal<string>(formatTime(0));

  /** Seconds left on the current question, formatted mm:ss; ticks down to 0. */
  readonly remaining: Signal<string> = this._remaining.asReadonly();
  /** The question's total allotted time, formatted mm:ss — the fixed half of "remaining / total". */
  readonly durationLabel: Signal<string> = this._durationLabel.asReadonly();

  private handle: ReturnType<typeof setInterval> | null = null;
  private secondsLeft = 0;

  constructor(private readonly onExpired: () => void) {}

  /**
   * Begins (or restarts) the countdown. Any countdown already running is
   * abandoned first — without that, moving between questions leaves the old
   * interval alive and the label jitters between two clocks.
   */
  start(durationSeconds: number): void {
    this.stop();
    this.secondsLeft = durationSeconds;
    this._durationLabel.set(formatTime(durationSeconds));
    this._remaining.set(formatTime(durationSeconds));
    this.handle = setInterval(() => this.tick(), 1000);
  }

  stop(): void {
    if (!this.handle) return;
    clearInterval(this.handle);
    this.handle = null;
  }

  private tick(): void {
    this.secondsLeft -= 1;
    if (this.secondsLeft <= 0) {
      this._remaining.set(formatTime(0));
      // Stopped before the callback, not after: `onExpired` submits the attempt
      // on the last question, and a still-live interval could fire again first.
      this.stop();
      this.onExpired();
      return;
    }
    this._remaining.set(formatTime(this.secondsLeft));
  }
}
