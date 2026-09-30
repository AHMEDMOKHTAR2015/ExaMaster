import { Signal, signal } from '@angular/core';
import { formatTime } from './question-timer';

/**
 * A single up-counting clock for the whole quiz run — "how long has the
 * student been at this", shown beside {@link QuestionTimer}'s whole-quiz
 * total duration as "elapsed / total".
 *
 * Deliberately not part of `QuestionTimer`, and not restarted alongside it:
 * that timer's countdown resets on every question change by design, and this
 * one must not — an elapsed clock that jumped back to 00:00 every time the
 * student clicked "Next" would answer a different question than the one it's
 * meant to. `QuizRunnerService` starts this once per attempt and stops it
 * only where the attempt itself ends or is set aside (review, submit, reset),
 * never on ordinary question navigation.
 *
 * No expiry: nothing happens when it reaches any particular value, so unlike
 * `QuestionTimer` there is no callback to run out. It reuses `formatTime` so
 * this label is never a subtly different mm:ss rendering of the same idea as
 * the ones beside it.
 */
export class QuizElapsedTimer {
  private readonly _elapsed = signal<string>(formatTime(0));

  /** Seconds elapsed since {@link start}, formatted mm:ss; ticks up with no ceiling. */
  readonly elapsed: Signal<string> = this._elapsed.asReadonly();

  private handle: ReturnType<typeof setInterval> | null = null;
  private secondsElapsed = 0;

  /** Resets to 00:00 and starts counting up. Call once per quiz attempt. */
  start(): void {
    this.stop();
    this.secondsElapsed = 0;
    this._elapsed.set(formatTime(0));
    this.run();
  }

  /** Freezes the display at its current value. Idempotent. */
  stop(): void {
    if (!this.handle) return;
    clearInterval(this.handle);
    this.handle = null;
  }

  /** Undoes a `stop()`, counting up again from wherever it was frozen — unlike `start()`, does not reset to 00:00. Idempotent. */
  resume(): void {
    if (this.handle) return;
    this.run();
  }

  private run(): void {
    this.handle = setInterval(() => {
      this.secondsElapsed += 1;
      this._elapsed.set(formatTime(this.secondsElapsed));
    }, 1000);
  }
}
