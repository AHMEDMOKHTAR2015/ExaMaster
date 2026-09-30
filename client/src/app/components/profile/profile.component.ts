import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../services/auth';
import { UserProfileService } from '../../services/user-profile.service';
import { NotificationService } from '../../services/notification.service';
import { ParticipationSummaryService } from '../../services/participation-summary.service';
import { StageService, GradeService, ClassGroupService } from '../../services/admin';
import { BaseComponent } from '../../shared/base';
import { UserProfileComponent } from '../user-profile/user-profile.component';

/**
 * Standalone "Profile" destination for the mobile bottom tab bar.
 *
 * <app-user-profile> also renders embedded inside AvailableQuizzesComponent's
 * side panel. Both read quiz stats and completed-quiz history from
 * ParticipationSummaryService — a shared, uid-cached load — rather than each
 * running its own copy of the scan, since the bottom tab bar makes switching
 * between the two a one-tap round trip.
 */
@Component({
  selector: 'app-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UserProfileComponent],
  templateUrl: './profile.component.html'
})
export class ProfileComponent extends BaseComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly userProfileService = inject(UserProfileService);
  private readonly notificationService = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly stageService = inject(StageService);
  private readonly gradeService = inject(GradeService);
  private readonly classService = inject(ClassGroupService);
  private readonly participationSummary = inject(ParticipationSummaryService);
  private readonly router = inject(Router);

  readonly user = this.authService.user;
  readonly userProfile = this.userProfileService.profile;
  readonly quizStats = this.participationSummary.quizStats;
  readonly completedQuizzes = this.participationSummary.completedQuizzes;

  readonly stageName = signal<string | null>(null);
  readonly gradeName = signal<string | null>(null);
  readonly className = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.authService.waitForAuthReady();
    void this.loadStageName();
    void this.loadGradeName();
    void this.loadClassName();
    void this.participationSummary.ensureLoaded();
  }

  private async loadStageName(): Promise<void> {
    const user = this.user();
    if (!user?.stageId) {
      this.stageName.set(null);
      return;
    }
    const stage = await this.stageService.fetchStage(user.stageId);
    this.stageName.set(stage?.name ?? user.stageId);
  }

  /** Mirrors AvailableQuizzesComponent: an unresolvable grade shows as absent, not as its id. */
  private async loadGradeName(): Promise<void> {
    const user = this.user();
    if (!user?.gradeId) {
      this.gradeName.set(null);
      return;
    }
    const grade = await this.gradeService.fetchGrade(user.gradeId);
    this.gradeName.set(grade?.name ?? null);
  }

  private async loadClassName(): Promise<void> {
    const user = this.user();
    if (user?.accountType !== 'child' || !user.classId) {
      this.className.set(null);
      return;
    }
    const cls = await this.classService.fetchClass(user.classId);
    this.className.set(cls?.name ?? null);
  }

  async onSignOut(): Promise<void> {
    try {
      await this.authService.signOut();
      this.router.navigate(['/login']);
    } catch {
      this.notificationService.error(this.translate.instant('userProfile.signOutFailed'));
    }
  }
}
