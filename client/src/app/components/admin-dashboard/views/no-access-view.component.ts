import { Component, inject, ChangeDetectionStrategy } from '@angular/core';

import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
    selector: 'app-no-access-view',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [TranslatePipe],
    templateUrl: './no-access-view.component.html'
})
export class NoAccessViewComponent {
  private readonly router = inject(Router);

  navigateToDashboard(): void {
    this.router.navigate(['/available-quizzes']);
  }

  navigateToHome(): void {
    this.router.navigate(['/']);
  }
}

