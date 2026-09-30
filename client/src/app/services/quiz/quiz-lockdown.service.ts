import { Injectable, computed, signal } from '@angular/core';
import { QuizExitReason } from '../../models';

/**
 * Browser-level containment for a "One Time Join" attempt.
 *
 * Owns every listener the feature installs and nothing else — the runner says
 * when an attempt is contained, the app shell reads {@link isActive} to hide its
 * chrome, and the quiz page supplies the callback that persists an exit. Kept
 * out of `QuizRunnerService` deliberately: the shell would otherwise have to
 * import the runner (and, through it, the whole quiz-taking stack) just to know
 * whether to draw a sidebar.
 *
 * **What the browser will and will not let us do.** None of this is a sandbox,
 * and it is not meant to be:
 *
 *  - Closing or reloading the tab can only be *questioned*, via `beforeunload`.
 *    The browser renders its own wording; a page cannot choose the text and
 *    cannot refuse the answer.
 *  - The Back button is neutralised by keeping a sentinel entry on the history
 *    stack and pushing it again on every `popstate`. The student can still
 *    hold Back to jump several entries at once — that lands them on another
 *    route, which is why leaving is *recorded*, not merely prevented.
 *  - Tab switching cannot be blocked at all — no web API can refuse it, and
 *    none is coming. `visibilitychange` reports it after the fact and cannot
 *    say what caused it, so that path waits before believing it (see
 *    {@link GRACE_MS}). Fullscreen is the nearest available substitute: it
 *    hides the tab strip, so reaching another tab means leaving fullscreen
 *    first, and leaving fullscreen is itself an exit.
 *
 * So containment is two layers, and the durable one is not this file: every
 * exit path ends in a lock the student cannot clear (`QuizLockService`), which
 * is what makes walking out cost something even when the guard below is
 * bypassed or simply unavailable.
 */
@Injectable({ providedIn: 'root' })
export class QuizLockdownService {
  private readonly active = signal<boolean>(false);

  /**
   * True while a contained attempt is open. The app shell hides its sidebar,
   * topbar and every other route affordance off this one signal.
   */
  readonly isActive = computed(() => this.active());

  /** Observed exits this attempt, for the "you left the quiz" warning on return. */
  readonly exitAttempts = signal<number>(0);

  /** Invoked on every observed exit. Set by whoever owns the attempt's lock record. */
  private onExit: ((reason: QuizExitReason) => void) | null = null;

  /**
   * Marker put on the history stack when containment starts, so a `popstate`
   * can be told from an ordinary in-app navigation.
   */
  private static readonly HISTORY_MARKER = 'quiz-lockdown';

  private readonly beforeUnload = (event: BeforeUnloadEvent): string => {
    this.reportExit('closed');
    // Both forms are needed: `preventDefault()` is the modern spec, a non-empty
    // `returnValue` is what older engines still key off. The string itself is
    // never displayed by any current browser.
    event.preventDefault();
    event.returnValue = '';
    return '';
  };

  private readonly onPopState = (): void => {
    // Put the sentinel straight back, so the entry the student just popped is
    // replaced and Back has nothing to move to. Recorded as an exit either way:
    // if the stack runs out, the next Back does leave.
    this.pushMarker();
    this.reportExit('navigated');
  };

  /**
   * How long a *reversible* signal has to reverse before it counts as leaving.
   *
   * Two of the four exit signals are ambiguous. `visibilitychange` cannot tell
   * "switched to another app" from "pulled down the notification shade", "took
   * a screenshot", "answered a call" or "the screen dimmed" — the browser
   * reports all of them identically. `fullscreenchange` fires for a transient
   * drop as readily as a deliberate escape. Treating every one as an exit ends
   * exams for things no invigilator would object to, and each false lock costs
   * a teacher an unlock request.
   *
   * A student genuinely leaving does not come back inside two seconds; a shade
   * pull or a screenshot does. So those two exits are *scheduled* and cancelled
   * if the condition reverses in time.
   *
   * `beforeunload` and `popstate` describe an unambiguous departure and stay
   * immediate.
   */
  private static readonly GRACE_MS = 2000;

  /** The single pending "they may have left" timer, or `null`. */
  private graceTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Whether *we* put the page into fullscreen. False when the browser refused
   * or does not support it (iPhone Safari has no element fullscreen at all),
   * which is what keeps a device that never went fullscreen from reporting an
   * exit for leaving it.
   */
  private enteredFullscreen = false;

  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState !== 'hidden') {
      // Back within the grace window — nothing happened.
      this.cancelScheduledExit();
      return;
    }
    this.scheduleExit('hidden');
  };

  private readonly onFullscreenChange = (): void => {
    if (!this.enteredFullscreen) return;
    if (document.fullscreenElement) {
      this.cancelScheduledExit();
      return;
    }
    this.scheduleExit('fullscreen-exit');
  };

  private scheduleExit(reason: QuizExitReason): void {
    this.cancelScheduledExit();
    this.graceTimer = setTimeout(() => {
      this.graceTimer = null;
      this.reportExit(reason);
    }, QuizLockdownService.GRACE_MS);
  }

  private cancelScheduledExit(): void {
    if (this.graceTimer === null) return;
    clearTimeout(this.graceTimer);
    this.graceTimer = null;
  }

  /**
   * Put the page into fullscreen for the sitting.
   *
   * **Must be called straight from the student's click** on the One Time Join
   * confirmation — the Fullscreen API is gesture-gated and a request made a
   * tick later, or after an `await`, is refused.
   *
   * Failure is not an error worth showing. iPhone Safari implements fullscreen
   * for `<video>` only and rejects this outright; a desktop browser can refuse
   * it by policy. The sitting proceeds either way — this hides the tab strip,
   * it does not enforce anything, and the lock is what actually enforces.
   */
  async requestFullscreen(): Promise<void> {
    const root = document.documentElement;
    if (typeof root.requestFullscreen !== 'function' || document.fullscreenElement) return;
    try {
      await root.requestFullscreen({ navigationUI: 'hide' });
      this.enteredFullscreen = true;
    } catch {
      // Refused or unsupported — see above.
    }
  }

  /**
   * Give the screen back. Clears the flag first, so the `fullscreenchange` this
   * causes is not read as the student escaping.
   */
  private releaseFullscreen(): void {
    if (!this.enteredFullscreen) return;
    this.enteredFullscreen = false;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  }

  /**
   * Begin containing the current attempt.
   *
   * Idempotent — calling it twice must not stack a second set of listeners,
   * which would double every recorded exit.
   */
  activate(onExit: (reason: QuizExitReason) => void): void {
    if (this.active()) return;
    this.onExit = onExit;
    this.exitAttempts.set(0);
    this.active.set(true);

    this.pushMarker();
    window.addEventListener('beforeunload', this.beforeUnload);
    window.addEventListener('popstate', this.onPopState);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    document.addEventListener('fullscreenchange', this.onFullscreenChange);
  }

  /**
   * Stop containing: the attempt was submitted, timed out, or the page is
   * being torn down. Safe to call when never activated, which is what lets the
   * quiz page call it unconditionally from `ngOnDestroy`.
   */
  deactivate(): void {
    if (!this.active()) return;
    // Before the listeners: a hide that was still inside its grace window when
    // the attempt ended (submitted, or ended by another exit path) must not
    // surface as an exit two seconds later.
    this.cancelScheduledExit();
    window.removeEventListener('beforeunload', this.beforeUnload);
    window.removeEventListener('popstate', this.onPopState);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    document.removeEventListener('fullscreenchange', this.onFullscreenChange);
    this.onExit = null;
    this.active.set(false);
    // Last: the student gets their browser back whether the attempt ended in a
    // submission or in a lock.
    this.releaseFullscreen();
  }

  /**
   * Record one observed exit.
   *
   * Public because the in-app guards (the router's `CanDeactivate`, the quiz
   * page's own controls) reach the same conclusion without a DOM event.
   */
  reportExit(reason: QuizExitReason): void {
    if (!this.active()) return;
    this.exitAttempts.update(n => n + 1);
    this.onExit?.(reason);
  }

  private pushMarker(): void {
    history.pushState({ [QuizLockdownService.HISTORY_MARKER]: true }, '');
  }
}
