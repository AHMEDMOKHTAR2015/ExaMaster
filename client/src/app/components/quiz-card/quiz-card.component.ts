import { Component, input, output, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { QuizInfo } from '../../interfaces';
import { cardHover, scaleIn } from '../../shared/animations';

/**
 * Quiz card component - Reusable card for displaying quiz information
 * Shows: title, question count, duration, difficulty badge, and description tooltip
 * Follows Interface Segregation Principle - only requires what it needs
 */
@Component({
  selector: 'app-quiz-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './quiz-card.component.html',
  animations: [cardHover, scaleIn]
})
export class QuizCardComponent {
  readonly quiz = input.required<QuizInfo>();
  /**
   * True when this student walked out of a "One Time Join" attempt at this quiz
   * and a teacher has not let them back in. The card explains itself instead of
   * offering a Start button that would only be refused.
   */
  readonly locked = input(false);
  /** Subject name and colour, resolved by the caller — see `QuizListComponent.subjectLookup`. */
  readonly subjectName = input('');
  readonly subjectColor = input<string | undefined>(undefined);
  readonly startQuiz = output<number>();

  // Hover state for animation
  readonly isHovered = signal<boolean>(false);
  // Falls back to the gradient header when the cover image fails to load
  // (e.g. legacy Google Drive / Storage URLs that no longer resolve).
  readonly imageError = signal<boolean>(false);

  /** Hide a broken cover image so the gradient header shows instead. */
  onImageError(): void {
    this.imageError.set(true);
  }

  /**
   * Get estimated duration based on question count
   * Assumes ~1.5 minutes per question
   */
  /**
   * Estimated minutes, as a bare number.
   *
   * The card renders it in a stat block that supplies its own "MINUTES" label,
   * matching the assignment card beside it — so a pre-formatted "30 min" string
   * would read as "30 min MINUTES".
   */
  /**
   * Initials for the reviewer's avatar, matching how the assignment card builds
   * its teacher's — first and last initial, so "Emy Hossam" reads as EH.
   */
  get reviewerInitials(): string {
    const parts = (this.quiz().reviewerName ?? '').split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }

  get estimatedMinutes(): number {
    return Math.ceil(this.quiz().questionCount * 1.5);
  }

  /**
   * Get difficulty level based on question count and config
   */
  get difficulty(): { level: string; class: string } {
    const count = this.quiz().questionCount;
    const shuffle = this.quiz().config?.shuffleQuestions;

    if (count >= 20 || shuffle) {
      return { level: 'Hard', class: 'difficulty-hard' };
    } else if (count >= 10) {
      return { level: 'Medium', class: 'difficulty-medium' };
    }
    return { level: 'Easy', class: 'difficulty-easy' };
  }

  /**
   * Emit start quiz event
   */
  onStartQuiz(): void {
    if (this.locked()) return;
    this.startQuiz.emit(this.quiz().id);
  }

  /**
   * Set hover state
   */
  setHovered(hovered: boolean): void {
    this.isHovered.set(hovered);
  }

  /**
   * Toggle tooltip visibility
   */
}
