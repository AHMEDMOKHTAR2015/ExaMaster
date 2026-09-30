import { AdminRole } from '../models';

/**
 * What an administrator (or a parent) gives to create an account. The API
 * creates the Firebase sign-in and the profile together; nothing here names a
 * uid, a tenant or a slot, because the server decides all three.
 */

/** A student, enrolled on their parent's family key (never one named here). */
export interface CreateChildUserParams {
  parentId: string;                                      // the parent's API id
  firstName: string;
  lastName: string;
  classId: string;                                       // the stage and grade follow from the class
  mobileNumber: string;
  password: string;
}

/** A parent, who claims the family key they are created with. */
export interface CreateParentUserParams {
  firstName: string;
  lastName: string;
  mobileNumber: string;
  password: string;
  registrationKeyId: string;                             // the key's code, as the family was given it
  email?: string;
}

/** Staff: an application administrator or a teacher (a userAdmin is a parent: see createParentAccount). */
export interface CreateAdminUserParams {
  firstName: string;
  lastName: string;
  mobileNumber: string;
  password: string;
  registrationKeyId?: string;                            // optional for staff; held if given
  roles: AdminRole[];
  email?: string;
}

/** A parent enrolling one of their own children (the key and the parent are the caller's). */
export interface AddMyChildParams {
  firstName: string;
  lastName: string;
  classId: string;
  mobileNumber: string;
  password: string;
}
