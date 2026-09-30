/**
 * Coverage for the one exit path that is not taken at face value.
 *
 * `visibilitychange` fires identically for "switched to another app" and for
 * "pulled down the notification shade / took a screenshot / the screen dimmed".
 * Since a single exit now ends a One Time Join sitting, believing every one of
 * them would end exams over a screenshot. So a hide is only an exit if the page
 * is still hidden a moment later — and these pin both halves of that.
 *
 * `visibilityState` is read-only, so it is stubbed on `document` for the length
 * of each test and restored afterwards.
 */

import { QuizLockdownService } from './quiz-lockdown.service';
import { QuizExitReason } from '../../models';

describe('QuizLockdownService — hidden-page grace window', () => {
  let lockdown: QuizLockdownService;
  let exits: QuizExitReason[];
  let visibility: DocumentVisibilityState;
  let original: PropertyDescriptor | undefined;

  /** Put the page in `state` and fire the event the browser would fire. */
  function setVisibility(state: DocumentVisibilityState): void {
    visibility = state;
    document.dispatchEvent(new Event('visibilitychange'));
  }

  beforeEach(() => {
    exits = [];
    visibility = 'visible';
    original = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility
    });

    jasmine.clock().install();
    lockdown = new QuizLockdownService();
    lockdown.activate(reason => exits.push(reason));
  });

  afterEach(() => {
    lockdown.deactivate();
    jasmine.clock().uninstall();
    delete (document as unknown as Record<string, unknown>)['visibilityState'];
    if (original) Object.defineProperty(Document.prototype, 'visibilityState', original);
  });

  it('does not report an exit the instant the page hides', () => {
    setVisibility('hidden');

    expect(exits).toEqual([]);
    expect(lockdown.exitAttempts()).toBe(0);
  });

  /** A screenshot, a notification shade, a glance at the lock screen. */
  it('forgives a hide the student comes straight back from', () => {
    setVisibility('hidden');
    jasmine.clock().tick(1_500);
    setVisibility('visible');
    jasmine.clock().tick(10_000);

    expect(exits).toEqual([]);
    expect(lockdown.isActive()).toBe(true);
  });

  /** Actually leaving for another app: the exit lands once the window closes. */
  it('reports an exit once the page stays hidden', () => {
    setVisibility('hidden');
    jasmine.clock().tick(2_000);

    expect(exits).toEqual(['hidden']);
  });

  /** Two shade pulls are still two forgiven hides, not a tally creeping upward. */
  it('starts the window again on each hide', () => {
    setVisibility('hidden');
    jasmine.clock().tick(1_000);
    setVisibility('visible');
    setVisibility('hidden');
    jasmine.clock().tick(1_000);
    setVisibility('visible');
    jasmine.clock().tick(10_000);

    expect(exits).toEqual([]);
  });

  /**
   * Submitting inside the grace window must not be followed by a lock two
   * seconds later — the attempt is over and the student has left legitimately.
   */
  it('drops a pending window when containment ends', () => {
    setVisibility('hidden');
    lockdown.deactivate();
    jasmine.clock().tick(10_000);

    expect(exits).toEqual([]);
  });

  /**
   * The grace is for the two ambiguous signals only. Back is an unambiguous
   * departure, so it keeps its immediate report.
   */
  it('does not delay a Back press', () => {
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(exits).toEqual(['navigated']);
  });
});

/**
 * Fullscreen is the nearest thing the platform offers to "stay on this tab":
 * it hides the tab strip, so reaching another tab means dropping out of
 * fullscreen first — which these treat as leaving.
 *
 * `document.fullscreenElement` is read-only, so it is stubbed the same way
 * `visibilityState` is above.
 */
describe('QuizLockdownService — fullscreen containment', () => {
  let lockdown: QuizLockdownService;
  let exits: QuizExitReason[];
  let fullscreenEl: Element | null;
  let original: PropertyDescriptor | undefined;
  let requested: number;

  function setFullscreen(on: boolean): void {
    fullscreenEl = on ? document.documentElement : null;
    document.dispatchEvent(new Event('fullscreenchange'));
  }

  /** Enter fullscreen the way the confirmation click does, without a real one. */
  async function enterFullscreen(): Promise<void> {
    await lockdown.requestFullscreen();
    fullscreenEl = document.documentElement;
  }

  beforeEach(() => {
    exits = [];
    requested = 0;
    fullscreenEl = null;
    original = Object.getOwnPropertyDescriptor(Document.prototype, 'fullscreenElement');
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenEl
    });
    // Karma's own frame cannot actually go fullscreen (no user gesture), so the
    // request is stubbed — what is under test is the bookkeeping around it.
    spyOn(document.documentElement, 'requestFullscreen').and.callFake(() => {
      requested += 1;
      return Promise.resolve();
    });

    jasmine.clock().install();
    lockdown = new QuizLockdownService();
    lockdown.activate(reason => exits.push(reason));
  });

  afterEach(() => {
    lockdown.deactivate();
    jasmine.clock().uninstall();
    delete (document as unknown as Record<string, unknown>)['fullscreenElement'];
    if (original) Object.defineProperty(Document.prototype, 'fullscreenElement', original);
  });

  it('asks for fullscreen once', async () => {
    await enterFullscreen();

    expect(requested).toBe(1);
  });

  /** Escaping fullscreen is how a desktop student uncovers their other tabs. */
  it('treats leaving fullscreen as leaving the quiz', async () => {
    await enterFullscreen();

    setFullscreen(false);
    jasmine.clock().tick(2_000);

    expect(exits).toEqual(['fullscreen-exit']);
  });

  it('forgives a drop that is corrected inside the grace window', async () => {
    await enterFullscreen();

    setFullscreen(false);
    jasmine.clock().tick(1_500);
    setFullscreen(true);
    jasmine.clock().tick(10_000);

    expect(exits).toEqual([]);
  });

  /**
   * iPhone Safari has no element fullscreen and rejects the request. Such a
   * device never entered fullscreen, so it must never be accused of leaving it
   * — otherwise every iPhone would lock itself out two seconds in.
   */
  it('never reports a fullscreen exit on a browser that refused it', () => {
    setFullscreen(false);
    jasmine.clock().tick(10_000);

    expect(exits).toEqual([]);
  });

  /** Ending the sitting hands the screen back without self-reporting an exit. */
  it('releases fullscreen on deactivate without counting it', async () => {
    await enterFullscreen();
    const exitSpy = spyOn(document, 'exitFullscreen').and.returnValue(Promise.resolve());

    lockdown.deactivate();
    setFullscreen(false);
    jasmine.clock().tick(10_000);

    expect(exitSpy).toHaveBeenCalled();
    expect(exits).toEqual([]);
  });
});
