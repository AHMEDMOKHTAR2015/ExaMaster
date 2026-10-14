import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { AppNotification, AppNotificationType } from '../models';
import { AuthService } from './auth';
import { ApiClient } from './api/api-client.service';

type ApiNotificationType = 'SubmissionApproved' | 'SubmissionRejected' | 'SubmissionCompleted' | 'SubmissionNeedsReview' | 'SubmissionReceived'
  | 'ChildSubmissionApproved' | 'ChildSubmissionRejected';

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
  SubmissionReceived: 'submission-received',
  ChildSubmissionApproved: 'child-approved',
  ChildSubmissionRejected: 'child-revision'
};

/**
 * The signed-in account's inbox (`/me/notifications`), newest 50.
 *
 * The server writes every notification itself — a submission tells the parent
 * and, every time, the reviewer; a review tells the student and the parent — so
 * this only reads and marks.
 * It reads when someone signs in (or the live channel reconnects), whenever the
 * live channel says the inbox changed (`RealtimeService`), and straight after
 * marking — never on a timer, so an idle signed-in tab makes no API calls.
 * Unread notifications live on the server, so whatever arrived while someone
 * was away is in the first read after they sign in.
 * A root singleton: cleared the moment the signed-in account changes, so one
 * inbox never shows under another account.
 */
@Injectable({ providedIn: 'root' })
export class NotificationCenterService {
  private readonly api = inject(ApiClient);
  private readonly authService = inject(AuthService);

  private readonly _items = signal<AppNotification[]>([]);
  private readonly _unreadCount = signal(0);
  readonly items = this._items.asReadonly();
  readonly unreadCount = this._unreadCount.asReadonly();

  private generation = 0;

  constructor() {
    // The platform administrator belongs to no school, and notifications are a school's: the API answers 403.
    const hasInbox = () => {
      const user = this.authService.user();
      return !!user && !user.roles?.includes('platformAdmin');
    };

    effect(() => {
      const inbox = hasInbox();
      this.authService.user();                                   // a change of account resets it, even to one with the same role
      this.generation++;
      this._items.set([]);
      this._unreadCount.set(0);
      if (inbox) void this.refresh();
    }, { allowSignalWrites: true });

    inject(DestroyRef).onDestroy(() => this.generation++);
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
