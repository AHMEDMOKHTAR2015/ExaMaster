import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ClickOutsideDirective, LoadingButtonDirective } from '../../directives';
import { AuthService } from '../../services/auth';
import { NotificationService } from '../../services/notification.service';
import { ServiceError } from '../../services/shared/service-error';

const MINIMUM_LENGTH = 6;

/**
 * The signed-in person changes their own password: the current one, then the
 * new one twice. Every other session of the account ends on the server; this
 * one continues, signed back in with the new password.
 */
@Component({
    selector: 'app-change-password-dialog',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, TranslatePipe, ClickOutsideDirective, LoadingButtonDirective],
    templateUrl: './change-password-dialog.component.html'
})
export class ChangePasswordDialogComponent {
  private readonly authService = inject(AuthService);
  private readonly notification = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  readonly closed = output<void>();

  readonly current = signal('');
  readonly next = signal('');
  readonly confirm = signal('');
  readonly isSaving = signal(false);
  readonly error = signal('');

  readonly minimumLength = MINIMUM_LENGTH;
  readonly mismatch = computed(() => this.confirm().length > 0 && this.confirm() !== this.next());
  readonly canSave = computed(() =>
    this.current().length > 0 && this.next().length >= MINIMUM_LENGTH && this.next() === this.confirm() && !this.isSaving());

  close(): void {
    if (!this.isSaving()) this.closed.emit();
  }

  async save(): Promise<void> {
    if (!this.canSave()) return;
    this.isSaving.set(true);
    this.error.set('');
    try {
      await this.authService.changeMyPassword(this.current(), this.next());
      this.notification.success(this.translate.instant('changePassword.done'));
      this.closed.emit();
    } catch (error) {
      this.error.set(error instanceof ServiceError ? error.message : this.translate.instant('changePassword.failed'));
    } finally {
      this.isSaving.set(false);
    }
  }
}
