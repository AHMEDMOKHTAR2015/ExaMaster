/**
 * The whole-quiz elapsed clock, on its own.
 *
 * The behaviour worth pinning is that it counts up with no ceiling and no
 * expiry — the opposite shape of `QuestionTimer`, which this sits beside in
 * the header pill as "elapsed / total". Restart behaviour is asserted too:
 * `start()` always re-zeroes, since `QuizRunnerService` only ever calls it
 * once per attempt, but a stray second call must not carry the old count
 * forward.
 */

import { QuizElapsedTimer } from './quiz-elapsed-timer';

describe('QuizElapsedTimer', () => {
  let timer: QuizElapsedTimer;

  beforeEach(() => {
    jasmine.clock().install();
    timer = new QuizElapsedTimer();
  });

  afterEach(() => {
    timer.stop();
    jasmine.clock().uninstall();
  });

  it('starts at 00:00', () => {
    expect(timer.elapsed()).toBe('00:00');
  });

  it('counts up once per second, with no ceiling', () => {
    timer.start();

    jasmine.clock().tick(1000);
    expect(timer.elapsed()).toBe('00:01');

    jasmine.clock().tick(59_000);
    expect(timer.elapsed()).toBe('01:00');
  });

  it('freezes at its current value once stopped', () => {
    timer.start();
    jasmine.clock().tick(5000);

    timer.stop();
    jasmine.clock().tick(10_000);

    expect(timer.elapsed()).toBe('00:05');
  });

  it('stopping twice is harmless', () => {
    timer.start();
    jasmine.clock().tick(2000);

    timer.stop();
    timer.stop();

    expect(timer.elapsed()).toBe('00:02');
  });

  it('restarting re-zeroes rather than continuing the previous count', () => {
    timer.start();
    jasmine.clock().tick(10_000);

    timer.start();
    jasmine.clock().tick(3000);

    expect(timer.elapsed()).toBe('00:03');
  });
});
