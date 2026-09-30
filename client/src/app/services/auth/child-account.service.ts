import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../api/api-client.service';
import { ApiId } from '../api/api-models';
import { AddMyChildParams, CreateAdminUserParams, CreateChildUserParams, CreateParentUserParams } from '../../interfaces';

/**
 * Creating accounts, through the API (`POST /users`, `POST /me/children`).
 *
 * The server creates the Firebase sign-in with the Admin SDK and the profile in
 * the same request, and removes the sign-in again if the profile cannot be
 * saved. So the browser no longer needs the second Firebase app it used to keep
 * the admin signed in, and no longer spends a family's slot itself: the API
 * charges the key the *parent* holds, in the same commit as the child.
 *
 * Every method returns the new account's API id.
 */
@Injectable({ providedIn: 'root' })
export class ChildAccountService {
  private readonly api = inject(ApiClient);

  async createChildAccount(params: CreateChildUserParams): Promise<string> {
    return this.create({
      kind: 'Student',
      firstName: params.firstName,
      lastName: params.lastName,
      mobileNumber: params.mobileNumber,
      password: params.password,
      parentId: Number(params.parentId),
      classId: Number(params.classId)
    });
  }

  async createParentAccount(params: CreateParentUserParams): Promise<string> {
    return this.create({
      kind: 'Parent',
      firstName: params.firstName,
      lastName: params.lastName,
      mobileNumber: params.mobileNumber,
      email: params.email || null,
      password: params.password,
      registrationKeyCode: params.registrationKeyId
    });
  }

  /** Staff. A `userAdmin` is a parent account and goes through {@link createParentAccount}. */
  async createAdminAccount(params: CreateAdminUserParams): Promise<string> {
    if (params.roles.includes('userAdmin')) {
      return this.createParentAccount({ ...params, registrationKeyId: params.registrationKeyId ?? '' });
    }
    return this.create({
      kind: params.roles.includes('teacher') ? 'Teacher' : 'ApplicationAdmin',
      firstName: params.firstName,
      lastName: params.lastName,
      mobileNumber: params.mobileNumber,
      email: params.email || null,
      password: params.password,
      registrationKeyCode: params.registrationKeyId || null
    });
  }

  /** The signed-in parent enrolling a child of their own, on one of their family's slots. */
  async addMyChild(params: AddMyChildParams): Promise<string> {
    const { id } = await this.api.post<ApiId>('/me/children', {
      firstName: params.firstName,
      lastName: params.lastName,
      mobileNumber: params.mobileNumber,
      password: params.password,
      classId: Number(params.classId)
    });
    return String(id);
  }

  private async create(body: Record<string, unknown>): Promise<string> {
    return String((await this.api.post<ApiId>('/users', body)).id);
  }
}
