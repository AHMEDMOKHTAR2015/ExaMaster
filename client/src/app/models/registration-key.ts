import { RegistrationKeyStatus } from '../shared/registration-key-status';

export interface RegistrationKey {
  /** The API's id for the key (what the admin screens address). */
  id: string;
  /** What a family types to register: the app's original key uuid, kept by the import. */
  code?: string;
  active: boolean;
  /**
   * The organization an account registering with this key joins.
   *
   * Keys stay in a top-level collection because they are read *before* the
   * caller has a tenant — discovering it is the point. That makes this field
   * the root of trust for the whole registration path: the server gives a
   * self-registered user the key's organization and role, never ones they
   * claim.
   */
  tenantId?: string;
  expiresAt?: number; // Optional - undefined means never expires (for applicationAdmin keys)
  role?: 'userAdmin' | 'applicationAdmin';
  // The following fields are only used for userAdmin keys (parent/child registration)
  parentId?: string;
  usedByParentAt?: number;
  childUseCount?: number;
  maxChildUses?: number;
  /**
   * Stored status, maintained server-side — see
   * `shared/registration-key-status.ts`.
   *
   * Derived from `active`, `expiresAt` and `parentId`, but persisted so the
   * admin screen can filter on it with a `where` clause instead of downloading
   * every key to compute it. Two writers, because it changes for two different
   * reasons: `onRegistrationKeyWritten` when the key itself is edited, and the
   * scheduled `expireRegistrationKeys` when time passes and nothing was written.
   *
   * Optional for back-compat: keys written before this field existed carry none
   * until the sweep or the next edit stamps one, and the client falls back to
   * computing it.
   */
  status?: RegistrationKeyStatus;
}
