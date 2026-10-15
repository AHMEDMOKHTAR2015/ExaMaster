import { Component, ChangeDetectionStrategy, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { UserAdminService } from '../../services/admin';
import { User } from '../../models';
import { BaseComponent } from '../../shared/base/base.component';
import { ChildPlacement, SchoolStructureLookup, avatarVariant, initials } from './child-display';

/**
 * A parent's children, one card each; a card opens that child's profile
 * (`/my-children/:id`). The server decides who is on the list
 * (`GET /me/children`); the route is for parents only (`myChildrenGuard`).
 */
@Component({
  selector: 'app-my-children',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, TranslatePipe],
  providers: [SchoolStructureLookup],
  templateUrl: './my-children.component.html'
})
export class MyChildrenComponent extends BaseComponent implements OnInit {
  private readonly userAdminService = inject(UserAdminService);
  protected readonly structure = inject(SchoolStructureLookup);

  readonly children = signal<User[]>([]);

  protected readonly avatarVariant = avatarVariant;
  protected readonly initials = initials;

  async ngOnInit(): Promise<void> {
    this.setLoading(true);
    try {
      const [children] = await Promise.all([this.userAdminService.listMyChildren(), this.structure.load()]);
      this.children.set(children);
      this.setLoading(false);
    } catch (error) {
      this.setError(error instanceof Error ? error.message : String(error));
    }
  }

  placement(child: User): ChildPlacement {
    return this.structure.placementOf(child);
  }
}
