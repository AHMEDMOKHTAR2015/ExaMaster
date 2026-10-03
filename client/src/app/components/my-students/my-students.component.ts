import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { TeacherStudentsService, filterMyStudents } from '../../services/admin';
import { MyStudent } from '../../models';
import { BaseComponent } from '../../shared/base/base.component';

/** A group in the filter, with the grade it belongs to so same-named groups can be told apart. */
interface GroupOption {
  id: string;
  label: string;
}

/**
 * A teacher's students: everyone in the groups they teach, with their parent,
 * placement, and how many of the teacher's quizzes and homework they have
 * submitted — searchable and filterable by group. The server decides who is on
 * the list (`GET /me/students`); the route is for teachers only (`teacherGuard`).
 */
@Component({
  selector: 'app-my-students',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule, TranslatePipe],
  templateUrl: './my-students.component.html'
})
export class MyStudentsComponent extends BaseComponent implements OnInit {
  private readonly teacherStudents = inject(TeacherStudentsService);

  readonly students = signal<MyStudent[]>([]);
  readonly search = signal('');
  readonly groupFilter = signal('');

  readonly groups = computed<GroupOption[]>(() => {
    const byId = new Map<string, GroupOption>();
    for (const student of this.students()) {
      if (!byId.has(student.classId)) {
        const label = student.gradeName ? `${student.className} · ${student.gradeName}` : student.className;
        byId.set(student.classId, { id: student.classId, label });
      }
    }
    return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label));
  });

  readonly visibleStudents = computed(() => filterMyStudents(this.students(), this.search(), this.groupFilter()));

  async ngOnInit(): Promise<void> {
    this.setLoading(true);
    try {
      this.students.set(await this.teacherStudents.listMine());
      this.setLoading(false);
    } catch (error) {
      this.setError(error instanceof Error ? error.message : String(error));
    }
  }

  /** A colour per student, as the Users table does (a `.tbl .avatar[data-variant]` with a background). */
  avatarVariant(student: MyStudent): 'brand' | 'mint' | 'sky' | 'amber' {
    const variants = ['brand', 'mint', 'sky', 'amber'] as const;
    return variants[Number(student.id) % variants.length] ?? 'brand';
  }

  initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }
}
