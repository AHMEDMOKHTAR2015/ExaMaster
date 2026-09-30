import { Injectable, Signal, computed, inject } from '@angular/core';
import { User, UserProfile } from '../models';
import { AuthService } from './auth';

/**
 * Derives presentational user-profile data (initials, member-since, totals) from the
 * authenticated user. AuthService is the source of truth for *identity*; this service
 * owns the *view* of that identity.
 */
@Injectable({ providedIn: 'root' })
export class UserProfileService {
  private readonly authService = inject(AuthService);

  readonly profile: Signal<UserProfile | null> = computed(() => {
    const user = this.authService.user();
    return user ? this.buildProfile(user) : null;
  });

  private buildProfile(user: User): UserProfile {
    return {
      initials: this.getInitials(user.displayName),
      fullName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
      memberSince: this.formatMonthYear(user.createdAt)
    };
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.split(' ').filter(p => p.length > 0);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  formatMonthYear(date: Date | string | null | undefined): string {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
}
