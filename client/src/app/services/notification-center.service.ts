import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { AppNotification, AppNotificationType } from '../models';
import { AuthService } from './auth';
import { ApiClient } from './api/api-client.service';

type ApiNotificationType = 'SubmissionApproved' | 'SubmissionRejected' | 'SubmissionCompleted' | 'SubmissionNeedsReview' | 'SubmissionReceived';

interface ApiNotification {
  id: number; type: ApiNotificationType; isRead: boolean; createdOn: string;
  participationId: number; homeworkId: number | null; title: string;
  childId: number; childName: string; correctCount: number; wrongCount: number;
  pendingReviewCount: number; timeTakenSeconds: number; feedback: string | null;
}

const TYPES: Record<ApiNotificationType, AppNotificationType> = {
  SubmissionApproved: 'homework-approved',
  SubmissionRejected: 'homework-revision',
  SubmissionCompleted: 'submission-completed',
  SubmissionNeedsReview: 'submission-needs-review',
  SubmissionReceived: 'submission-received'
};

/**
 * The signed-in account's inbox (`/me/notifications`), newest 50.
 *
 * The server writes every notification itself — a submission tells the parent
 * and, every time, the reviewer; a review tells the student — so this only reads and marks.
 * It reads when someone signs in, whenever the live channel says the inbox
 * changed (`RealtimeService`), straight after marking, and every
 * {@link POLL_MS} as a safety net for when the live channel cannot connect.
 * A root singleton: cleared the moment the signed-in account changes, so one
 * inbox never shows under another account.
 */
@Injectable({ providedIn: 'root' })
export class NotificationCenterService {
  private static readonly POLL_MS = 5 * 60_000;

  private readonly api = inject(ApiClient);
  private readonly authService = inject(AuthService);

  private readonly _items = signal<AppNotification[]>([]);
  private readonly _unreadCount = signal(0);
  readonly items = this._items.asReadonly();
  readonly unreadCount = this._unreadCount.asReadonly();

  private timer: ReturnType<typeof setInterval> | null = null;
  private generation = 0;

  constructor() {
    effect(() => {
      // The platform administrator belongs to no school, and notifications are a school's: the API answers 403.
      const user = this.authService.user();
      const hasInbox = !!user && !user.roles?.includes('platformAdmin');
      this.stop();
      this._items.set([]);
      this._unreadCount.set(0);
      if (!hasInbox) return;
      void this.refresh();
      this.timer = setInterval(() => void this.refresh(), NotificationCenterService.POLL_MS);
    }, { allowSignalWrites: true });

    inject(DestroyRef).onDestroy(() => this.stop());
  }

  async refresh(): Promise<void> {
    const generation = this.generation;
    try {
      const inbox = await this.api.get<{ notifications: ApiNotification[]; unreadCount: number }>('/me/notifications');
      if (generation !== this.generation) return;
      this._items.set(inbox.notifications.map(toNotification));
      this._unreadCount.set(inbox.unreadCount);
    } catch {
      // Offline, or signed out mid-request: keep what is shown.
    }
  }

  async markRead(id: string): Promise<void> {
    this._items.update(items => items.map(n => n.id === id ? { ...n, read: true } : n));
    this._unreadCount.update(count => Math.max(0, count - 1));
    await this.api.post(`/me/notifications/${id}:read`, {}).catch(() => undefined);
    await this.refresh();
  }

  async markAllRead(): Promise<void> {
    if (this._unreadCount() === 0) return;
    this._items.update(items => items.map(n => ({ ...n, read: true })));
    this._unreadCount.set(0);
    await this.api.post('/me/notifications:read-all', {}).catch(() => undefined);
    await this.refresh();
  }

  private stop(): void {
    this.generation++;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

function toNotification(notification: ApiNotification): AppNotification {
  const type = TYPES[notification.type];
  return {
    id: String(notification.id),
    type,
    read: notification.isRead,
    createdAt: new Date(notification.createdOn).getTime(),
    assignmentTitle: notification.title,
    assignmentId: String(notification.homeworkId ?? notification.participationId),
    participationId: String(notification.participationId),
    feedback: notification.feedback ?? undefined,
    childId: String(notification.childId),
    childName: notification.childName,
    correctCount: notification.correctCount,
    wrongCount: notification.wrongCount,
    pendingReviewCount: notification.pendingReviewCount,
    timeTakenSeconds: notification.timeTakenSeconds,
    reviewStatus: type === 'submission-completed' ? 'pending' : undefined
  };
}
