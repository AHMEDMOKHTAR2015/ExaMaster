import { Injectable, inject } from '@angular/core';
import { Teacher } from '../../../models';
import { TeacherProvisionResult } from '../../../interfaces';
import { ApiClient } from '../../api/api-client.service';

/** Default password assigned to teacher logins provisioned from their email. */
export const DEFAULT_TEACHER_PASSWORD = 'P@$$123456';

type ApiTeacherLoginStatus = 'Created' | 'Linked' | 'SkippedNoEmail' | 'ExistsUnmanaged';

/**
 * Gives a roster teacher an app login, through the API (`POST /teachers/{id}/login`).
 *
 * The server creates the Firebase sign-in with the Admin SDK, so the admin's
 * own session is never touched: the browser no longer needs the second Firebase
 * app it used for this. Idempotent, like before:
 *  - no email on the record → skipped;
 *  - an account of this school with that email → it gets the teacher role and the link;
 *  - otherwise → a new sign-in with the default password;
 *  - an email that already signs in elsewhere is reported, never adopted: anyone
 *    can create a Firebase account for any address, so adopting it would give
 *    teacher access to whoever registered it first.
 */
@Injectable({ providedIn: 'root' })
export class TeacherAccountService {
  private readonly api = inject(ApiClient);

  async ensureTeacherAccount(teacher: Teacher, password: string = DEFAULT_TEACHER_PASSWORD): Promise<TeacherProvisionResult> {
    const name = `${teacher.firstName} ${teacher.lastName}`.trim();
    const { status } = await this.api.post<{ status: ApiTeacherLoginStatus }>(`/teachers/${teacher.id}/login`, { password });

    switch (status) {
      case 'Created':
        return { status: 'created', message: `Login created for ${name} (${teacher.email}) with the default password.` };
      case 'Linked':
        return { status: 'linked', message: `Existing login ${teacher.email} linked to ${name}.` };
      case 'SkippedNoEmail':
        return { status: 'skipped-no-email', message: `${name} has no email — no login was created.` };
      default:
        return {
          status: 'exists-unmanaged',
          message: `${teacher.email} already signs in to an account outside this school, so it was not linked. Use a different email for ${name}.`
        };
    }
  }
}
