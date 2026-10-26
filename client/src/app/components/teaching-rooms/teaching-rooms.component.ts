import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AdminAccessService, SubjectService } from '../../services/admin';
import { AuthService } from '../../services/auth/auth.service';
import { TeachingRoomService } from '../../services/teaching-room.service';
import { Subject, TeachingRoomAdmission, TeachingRoomSummary } from '../../models';
import { BaseComponent } from '../../shared/base/base.component';

/**
 * Teaching Rooms: a teacher's live rooms (opened from Teaching Materials →
 * Present), or, for a student, the rooms open to their class and where they
 * stand in each. The API decides which rooms each person gets.
 */
@Component({
  selector: 'app-teaching-rooms',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, TranslatePipe],
  templateUrl: './teaching-rooms.component.html'
})
export class TeachingRoomsComponent extends BaseComponent implements OnInit {
  private readonly roomService = inject(TeachingRoomService);
  private readonly subjectService = inject(SubjectService);
  private readonly authService = inject(AuthService);
  private readonly adminAccess = inject(AdminAccessService);
  private readonly translate = inject(TranslateService);

  readonly presents = computed(() => this.adminAccess.getStrategy(this.authService.getUserRoles()).canPresentTeachingRooms());
  readonly rooms = signal<TeachingRoomSummary[]>([]);
  private readonly subjects = signal<Subject[]>([]);
  private readonly subjectNames = computed(() => new Map(this.subjects().map(subject => [subject.id, subject.name])));

  async ngOnInit(): Promise<void> {
    this.setLoading(true);
    try {
      const [rooms, subjects] = await Promise.all([
        this.roomService.list(),
        // names are labels only: the list stays usable without them
        this.subjectService.listSubjects().then(page => page.items, () => [])
      ]);
      this.rooms.set(rooms);
      this.subjects.set(subjects);
      this.setLoading(false);
    } catch (error) {
      this.setError(error instanceof Error ? error.message : String(error));
    }
  }

  subjectName(id: string): string {
    return this.subjectNames().get(id) ?? this.translate.instant('common.na');
  }

  standingBadge(admission: TeachingRoomAdmission): string {
    switch (admission) {
      case 'approved': return 'badge--success';
      case 'pending': return 'badge--warning';
      case 'rejected': return 'badge--muted';
      default: return 'badge--brand';
    }
  }
}
