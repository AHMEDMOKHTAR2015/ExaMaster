import { signal } from '@angular/core';
import { TestBed, waitForAsync } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { AppComponent } from './app.component';
import { AppNotification } from './models';
import { RealtimeService } from './services/realtime/realtime.service';
import { AuthService } from './services/auth';
import { LanguageService } from './services/language.service';
import { NotificationCenterService } from './services/notification-center.service';
import { TeacherReviewQueueService } from './services/teacher-review-queue.service';
import { AccessRequestService } from './services/access-requests/access-request.service';
import { TenantService } from './services/tenant/tenant.service';
import { TranslationOverridesService } from './services/i18n/translation-overrides.service';

describe('AppComponent', () => {
  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            isLoading: signal(false),
            authReady: signal(true),
            isAuthenticated: signal(false),
            user: signal(null),
            signOut: () => Promise.resolve()
          }
        },
        {
          provide: LanguageService,
          useValue: { currentLang: signal('en'), toggle: () => {} }
        },
        // Real NotificationCenterService pulls in Database + the ngx-toastr error
        // handler chain, none of which this smoke test cares about — stub the
        // small surface AppComponent actually reads/calls.
        {
          provide: NotificationCenterService,
          useValue: {
            items: signal([]),
            unreadCount: signal(0),
            markRead: () => Promise.resolve(),
            markAllRead: () => Promise.resolve()
          }
        },
        // Stub — real TranslateService needs TranslateModule.forRoot() wiring
        // this smoke test doesn't need; AppComponent only calls .instant().
        {
          provide: TranslateService,
          useValue: { instant: (key: string) => key }
        },
        // Real one opens a Firestore snapshot listener on the teacher's
        // `reviewQueues` doc; AppComponent only reads the count for a badge.
        {
          provide: TeacherReviewQueueService,
          useValue: { pendingCount: signal(0) }
        },
        // Real one reads the caller's `tenants/{tenantId}` document; the
        // sidebar only prints its name. Empty here, which is also what a
        // signed-out user gets, so the label is simply not rendered.
        {
          provide: TenantService,
          useValue: { name: signal('') }
        },
        // Real one opens two Firestore listeners on the school's label
        // overrides. AppComponent only reads `settled()` to hold the boot gate;
        // `true` here means "nothing to wait for", which is also what a
        // signed-out visitor gets.
        {
          provide: TranslationOverridesService,
          useValue: { settled: signal(true) }
        },
        // The real one opens a live connection to the API when someone signs in.
        { provide: AccessRequestService, useValue: { pendingCount: signal(0) } },
        { provide: RealtimeService, useValue: { connected: signal(false) } }
      ]
    }).compileComponents();
  }));

  it('should create the app', waitForAsync(() => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.debugElement.componentInstance;
    expect(app).toBeTruthy();
  }));

  it('should render the router outlet when unauthenticated', waitForAsync(() => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.debugElement.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  }));

  // Below 900px the sidebar is parked off-screen and `.app.is-sidebar-open` is
  // the only thing that brings it back, so these three behaviours are the whole
  // of mobile navigation. The CSS for them shipped long before anything set the
  // class, which left phones with no way to navigate at all.
  describe('sidebar drawer', () => {
    it('starts closed', () => {
      const app = TestBed.createComponent(AppComponent).componentInstance;
      expect(app.isSidebarOpen()).toBe(false);
    });

    it('toggles open and closed', () => {
      const app = TestBed.createComponent(AppComponent).componentInstance;
      const event = new MouseEvent('click');

      app.toggleSidebar(event);
      expect(app.isSidebarOpen()).toBe(true);

      app.toggleSidebar(event);
      expect(app.isSidebarOpen()).toBe(false);
    });

    it('closes on navigation, so choosing a nav item is not a tap that does nothing', async () => {
      const app = TestBed.createComponent(AppComponent).componentInstance;
      app.toggleSidebar(new MouseEvent('click'));
      expect(app.isSidebarOpen()).toBe(true);

      await TestBed.inject(Router).navigateByUrl('/');

      expect(app.isSidebarOpen()).toBe(false);
    });

    it('closes on Escape, the only exit for a keyboard user while it covers the page', () => {
      const app = TestBed.createComponent(AppComponent).componentInstance;
      app.toggleSidebar(new MouseEvent('click'));

      app.onEscape();

      expect(app.isSidebarOpen()).toBe(false);
    });
  });

  // A parent is told at submission whether answers wait for the teacher, then hears the verdict itself.
  describe('parent notifications', () => {
    const base: AppNotification = {
      id: '1', type: 'submission-completed', read: false, createdAt: 0,
      assignmentTitle: 'Unit 4', assignmentId: '9', participationId: '9',
      childName: 'Sara', correctCount: 3, wrongCount: 1, pendingReviewCount: 0, timeTakenSeconds: 90
    };

    it('says how many answers wait for the teacher when some do', () => {
      const app = TestBed.createComponent(AppComponent).componentInstance;
      const waiting = { ...base, pendingReviewCount: 2 };

      expect(app.notifMessageKey(waiting)).toBe('notifications.messages.completedNeedsReview');
      expect(app.notifMessageParams(waiting)['count']).toBe(2);
      expect(app.notifMessageKey(base)).toBe('notifications.messages.completed');
    });

    it('announces the verdict on their child\'s work', () => {
      const app = TestBed.createComponent(AppComponent).componentInstance;
      const approved: AppNotification = { ...base, type: 'child-approved', feedback: 'Well done' };
      const revision: AppNotification = { ...base, type: 'child-revision' };

      expect([app.notifTitleKey(approved), app.notifMessageKey(approved), app.notifTone(approved)])
        .toEqual(['notifications.types.childApproved', 'notifications.messages.childApproved', 'approved']);
      expect([app.notifTitleKey(revision), app.notifMessageKey(revision), app.notifTone(revision)])
        .toEqual(['notifications.types.childRevision', 'notifications.messages.childRevision', 'revision']);
      expect(app.notifMessageParams(approved)).toEqual({ childName: 'Sara', title: 'Unit 4' });
    });
  });
});
