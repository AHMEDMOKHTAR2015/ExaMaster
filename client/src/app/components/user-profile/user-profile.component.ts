import { Component, input, output, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { UserProfile } from '../../models';
import { BaseComponent } from '../../shared/base';
import { fadeIn, slideInUp, staggerList } from '../../shared/animations';
import { CompletedQuizProgress } from '../../shared/participation-score';
import { LanguageService } from '../../services/language.service';

/**
 * User profile component displaying user information and completed quizzes
 * Follows Single Responsibility Principle - only handles profile display
 */
@Component({
  selector: 'app-user-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './user-profile.component.html',
  animations: [fadeIn, slideInUp, staggerList]
})
export class UserProfileComponent extends BaseComponent {
  readonly profile = input<UserProfile | null>(null);
  readonly completedQuizzes = input<CompletedQuizProgress[]>([]);
  readonly stageName = input<string | null>(null);
  readonly gradeName = input<string | null>(null);
  readonly className = input<string | null>(null);
  /** Standalone-quiz (homework excluded) attempt stats — kept in sync with the page-level KPI tiles so the two never disagree. */
  readonly quizStats = input<{ completedCount: number; averageScore: number; bestScore: number }>({
    completedCount: 0,
    averageScore: 0,
    bestScore: 0
  });
  readonly signOut = output<void>();

  // Show completed quizzes panel expanded
  readonly showAllQuizzes = signal<boolean>(false);

  // Computed: Recent completed quizzes (last 5)
  readonly recentQuizzes = computed(() => {
    const quizzes = [...this.completedQuizzes()];
    return quizzes
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
      .slice(0, this.showAllQuizzes() ? undefined : 5);
  });

  /**
   * Toggle show all quizzes
   */
  toggleShowAll(): void {
    this.showAllQuizzes.update(v => !v);
  }

  /**
   * Emit sign out event
   */
  onSignOut(): void {
    this.signOut.emit();
  }

  /**
   * Format date for display
   */
  private readonly lang = inject(LanguageService);
  private readonly translate = inject(TranslateService);

  formatDate(date: Date | string): string {
    const d = date instanceof Date ? date : new Date(date);
    const locale = this.lang.currentLang() === 'ar' ? 'ar-EG' : 'en-GB';
    return d.toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  /**
   * Format time taken
   */
  formatTimeTaken(seconds: number): string {
    if (seconds < 60) return this.translate.instant('userProfile.duration.seconds', { s: seconds });
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0
      ? this.translate.instant('userProfile.duration.minutesSeconds', { m: mins, s: secs })
      : this.translate.instant('userProfile.duration.minutes', { m: mins });
  }

  /**
   * Get score class based on percentage
   */
  getScoreClass(percentage: number): string {
    if (percentage >= 80) return 'score-excellent';
    if (percentage >= 60) return 'score-good';
    if (percentage >= 40) return 'score-average';
    return 'score-poor';
  }

  /**
   * Track by for completed quizzes
   */
  trackByQuiz(index: number, quiz: CompletedQuizProgress): string {
    return `${quiz.quizId}-${quiz.completedAt}`;
  }
}
