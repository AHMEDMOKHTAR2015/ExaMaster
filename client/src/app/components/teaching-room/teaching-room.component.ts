import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SubjectService } from '../../services/admin';
import { TeachingRoomService } from '../../services/teaching-room.service';
import { TeachingRoomConnection } from '../../services/realtime/teaching-room-connection';
import { TeachingRoom, TeachingRoomMember } from '../../models';
import { seesBoard } from '../../shared/teaching-room-state';
import { BaseComponent } from '../../shared/base/base.component';
import { LessonUnit, MaterialLessonComponent } from '../teaching-materials/material-lesson.component';

/**
 * A Teaching Room (`/TeachingRoom/:id`): a live board the teacher presents one
 * of their materials on, lesson by lesson.
 *
 * The presenting teacher moves it with Previous and Next (each disabled at its
 * end) and decides who joins; a student of a class the material is for asks to
 * join and, once let in, follows every move without a reload. The board comes
 * only over the room's live connection, and only once the server has admitted
 * this person to the room's group — this page never decides that itself.
 */
@Component({
  selector: 'app-teaching-room',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, MaterialLessonComponent],
  providers: [TeachingRoomConnection],
  templateUrl: './teaching-room.component.html'
})
export class TeachingRoomComponent extends BaseComponent implements OnInit {
  private readonly roomService = inject(TeachingRoomService);
  private readonly subjectService = inject(SubjectService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  readonly live = inject(TeachingRoomConnection);

  readonly room = signal<TeachingRoom | null>(null);
  readonly notFound = signal(false);
  readonly subjectName = signal<string | null>(null);
  /** A move, a request or a decision is on its way: the controls wait for it. */
  readonly busy = signal(false);
  readonly actionError = signal<string | null>(null);

  /** The hub's answer once it has one (it changes live); until then, the API's. */
  readonly admission = computed(() => this.live.admission() ?? this.room()?.admission ?? 'none');
  readonly isTeacher = computed(() => this.admission() === 'teacher');
  readonly board = computed(() => (seesBoard(this.admission()) ? this.live.state() : null));
  readonly boardUnit = computed<LessonUnit | null>(() => {
    const item = this.board()?.item;
    return item ? { kind: item.unitKind, number: item.unitNumber, title: item.unitTitle, keyTakeaways: item.keyTakeaways } : null;
  });

  readonly waiting = computed(() => this.membersWith('pending'));
  readonly admitted = computed(() => this.membersWith('approved'));
  readonly turnedAway = computed(() => this.membersWith('rejected'));

  private id = '';

  async ngOnInit(): Promise<void> {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.setLoading(true);
    try {
      const room = await this.roomService.get(this.id);
      if (!room) {
        this.notFound.set(true);
        this.setLoading(false);
        return;
      }
      this.room.set(room);
      this.setLoading(false);
      // the subject's name is a label only: a missing one leaves the room usable
      void this.subjectService.fetchSubject(room.subjectId).then(subject => this.subjectName.set(subject?.name ?? null), () => undefined);
      await this.live.open(this.id, { joinRequestsChanged: () => void this.reloadRoom() });
    } catch (error) {
      this.setError(error instanceof Error ? error.message : String(error));
    }
  }

  askToJoin(): Promise<void> {
    return this.run(async () => this.live.setAdmission(await this.roomService.requestToJoin(this.id)));
  }

  next(): Promise<void> {
    return this.run(async () => this.live.show(await this.roomService.next(this.id)));
  }

  previous(): Promise<void> {
    return this.run(async () => this.live.show(await this.roomService.previous(this.id)));
  }

  approve(member: TeachingRoomMember): Promise<void> {
    return this.run(async () => {
      await this.roomService.approve(this.id, member.studentId);
      await this.reloadRoom();
    });
  }

  /** Turns a waiting student away, or removes an admitted one: their board clears at once. */
  reject(member: TeachingRoomMember): Promise<void> {
    return this.run(async () => {
      await this.roomService.reject(this.id, member.studentId);
      await this.reloadRoom();
    });
  }

  end(): Promise<void> {
    if (!confirm(this.translate.instant('teachingRooms.room.endConfirm'))) return Promise.resolve();
    return this.run(async () => {
      await this.roomService.end(this.id);
      await this.router.navigate(['/teaching-rooms']);
    });
  }

  private async run(action: () => Promise<unknown>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.actionError.set(null);
    try {
      await action();
    } catch (error) {
      this.actionError.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.busy.set(false);
    }
  }

  private async reloadRoom(): Promise<void> {
    const room = await this.roomService.get(this.id).catch(() => null);
    if (room) this.room.set(room);
  }

  private membersWith(status: TeachingRoomMember['status']): TeachingRoomMember[] {
    return (this.room()?.members ?? []).filter(member => member.status === status);
  }
}
