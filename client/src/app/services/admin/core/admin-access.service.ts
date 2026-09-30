import { Injectable } from '@angular/core';
import { AdminRole } from '../../../models';
import { AdminRoleStrategy } from '../../../interfaces';
import { ApplicationAdminStrategy } from '../strategies/application-admin.strategy';
import { UserAdminStrategy } from '../strategies/user-admin.strategy';
import { TeacherStrategy } from '../strategies/teacher.strategy';
import { NoAdminStrategy } from '../strategies/no-admin.strategy';

@Injectable({
  providedIn: 'root'
})
export class AdminAccessService {
  getStrategy(roles: AdminRole[] | undefined): AdminRoleStrategy {
    if (roles?.includes('applicationAdmin')) {
      return new ApplicationAdminStrategy();
    }
    if (roles?.includes('userAdmin')) {
      return new UserAdminStrategy();
    }
    if (roles?.includes('teacher')) {
      return new TeacherStrategy();
    }
    return new NoAdminStrategy();
  }
}
