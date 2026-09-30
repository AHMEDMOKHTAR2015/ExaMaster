/**
 * The per-question countdown, on its own.
 *
 * Inside `QuizRunnerService` this was four private fields and three methods
 * tangled with navigation, so none of it could be tested without standing up a
 * quiz run: the expiry path in particular only ever ran via a real one-second
 * interval. Here the clock is mocked and the boundary is asserted directly.
 *
 * The behaviour worth pinning is that expiry fires exactly once and leaves the
 * clock stopped — the timer drives auto-submit on the last question, so a
 * double fire would submit a student's attempt twice.
 */

import { QuestionTimer } from './question-timer';

describe('QuestionTimer', () => {
  let timer: QuestionTimer;
  let expiries: number;

  beforeEach(() => {
    jasmine.clock().install();
    expiries = 0;
    timer = new QuestionTimer(() => expiries++);
  });

  afterEach(() => {
    timer.stop();
    jasmine.clock().uninstall();
  });

  it('shows the full duration on both labels the moment it starts', () => {
    timer.start(90);

    expect(timer.durationLabel()).toBe('01:30');
    expect(timer.remaining()).toBe('01:30');
  });

  it('counts the remaining label down once per second', () => {
    timer.start(90);

    jasmine.clock().tick(1000);
    expect(timer.remaining()).toBe('01:29');

    jasmine.clock().tick(2000);
    expect(timer.remaining()).toBe('01:27');
  });

  it('leaves the duration label fixed while the remaining label falls', () => {
    timer.start(60);

    jasmine.clock().tick(5000);

    expect(timer.durationLabel()).toBe('01:00');
    expect(timer.remaining()).toBe('00:55');
  });

  it('lands on 00:00 and reports expiry when the time runs out', () => {
    timer.start(3);

    jasmine.clock().tick(3000);

    expect(timer.remaining()).toBe('00:00');
    expect(expiries).toBe(1);
  });

  it('fires expiry exactly once, however long the clock keeps running', () => {
    // A second callback here would auto-submit a student's attempt twice.
    timer.start(2);

    jasmine.clock().tick(60_000);

    expect(expiries).toBe(1);
  });

  it('stops counting after expiry', () => {
    timer.start(2);
    jasmine.clock().tick(2000);

    jasmine.clock().tick(5000);

    expect(timer.remaining()).toBe('00:00');
  });

  it('does not report expiry once stopped', () => {
    timer.start(5);

    timer.stop();
    jasmine.clock().tick(10_000);

    expect(expiries).toBe(0);
  });

  it('restarting abandons the previous countdown rather than running two', () => {
    timer.start(5);
    jasmine.clock().tick(2000);

    timer.start(30);
    jasmine.clock().tick(1000);

    // 30 - 1, not affected by the abandoned 5s countdown, which would
    // otherwise have expired two ticks later.
    expect(timer.remaining()).toBe('00:29');
    expect(expiries).toBe(0);
  });

  it('formats a duration over ten minutes without truncating', () => {
    timer.start(725);

    expect(timer.durationLabel()).toBe('12:05');
  });

  it('treats a zero duration as immediately expired on the first tick', () => {
    timer.start(0);

    expect(timer.remaining()).toBe('00:00');
    jasmine.clock().tick(1000);

    expect(expiries).toBe(1);
  });
});
