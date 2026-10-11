import { EnvironmentInjector, createEnvironmentInjector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { safetyNetPoll } from './safety-net-poll';
import { PageVisibilityService } from './page-visibility.service';
import { LiveChannelState } from '../realtime/live-channel-state';

describe('safetyNetPoll', () => {
  const INTERVAL = 1_000;
  let visible: ReturnType<typeof signal<boolean>>;
  let active: ReturnType<typeof signal<boolean>>;
  let live: LiveChannelState;
  let reads: number;

  /** Starts a poll in an injector of its own, as a service's constructor would; returns that injector. */
  function host(coveredByLiveChannel: boolean): EnvironmentInjector {
    const injector = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
    runInInjectionContext(injector, () =>
      safetyNetPoll({ intervalMs: INTERVAL, active: () => active(), coveredByLiveChannel, refresh: () => reads++ }));
    TestBed.tick();
    return injector;
  }

  beforeEach(() => {
    jasmine.clock().install();
    visible = signal(true);
    active = signal(true);
    reads = 0;
    TestBed.configureTestingModule({
      providers: [{ provide: PageVisibilityService, useValue: { visible } }]
    });
    live = TestBed.inject(LiveChannelState);
  });

  afterEach(() => jasmine.clock().uninstall());

  it('reads on its interval while the tab is visible', () => {
    host(false);
    jasmine.clock().tick(INTERVAL * 3);
    expect(reads).toBe(3);
  });

  it('stops while the tab is hidden, and reads once when it comes back', () => {
    host(false);
    visible.set(false);
    TestBed.tick();
    jasmine.clock().tick(INTERVAL * 5);
    expect(reads).toBe(0);

    visible.set(true);
    TestBed.tick();
    expect(reads).toBe(1);                                       // the catch-up read
    jasmine.clock().tick(INTERVAL);
    expect(reads).toBe(2);                                       // and polling again
  });

  it('leaves a count the live channel covers to the live channel while it is up', () => {
    live.connected.set(true);
    host(true);
    jasmine.clock().tick(INTERVAL * 5);
    expect(reads).toBe(0);

    live.connected.set(false);                                   // the channel dropped: the safety net takes over
    TestBed.tick();
    jasmine.clock().tick(INTERVAL);
    expect(reads).toBe(1);
  });

  it('keeps polling a count no live signal covers, whatever the channel does', () => {
    live.connected.set(true);
    host(false);
    jasmine.clock().tick(INTERVAL * 2);
    expect(reads).toBe(2);
  });

  it('does nothing for someone with nothing to poll for, even when the tab returns', () => {
    active.set(false);
    host(false);
    visible.set(false);
    TestBed.tick();
    visible.set(true);
    TestBed.tick();
    jasmine.clock().tick(INTERVAL * 3);
    expect(reads).toBe(0);
  });

  it('stops when its owner is destroyed', () => {
    const injector = host(false);
    injector.destroy();
    jasmine.clock().tick(INTERVAL * 3);
    expect(reads).toBe(0);
  });
});
