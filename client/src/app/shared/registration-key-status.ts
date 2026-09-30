/**
 * A registration key's status — the one definition, shared by both bundles.
 *
 * This used to be computed in the browser at render time, which made it
 * unfilterable: Firestore can only query stored fields, so the admin screen had
 * to download every key to offer an Active/Expired/Used filter. The status is a
 * real field now, written by `onRegistrationKeyWritten` and swept by
 * `expireRegistrationKeys`, so the filter is a `where` clause.
 *
 * Pure, no Angular. The API reports each key's status itself; this is the same
 * rule, for the screens that derive a badge from a key they already hold.
 */

export type RegistrationKeyStatus = 'active' | 'inactive' | 'expired' | 'used';

/** The subset of a key this rule reads. Keeps the function usable from both sides. */
export interface StatusableKey {
  active?: boolean;
  expiresAt?: number | null;
  role?: 'userAdmin' | 'applicationAdmin' | null;
  parentId?: string | null;
}

/**
 * Resolve a key's status.
 *
 * Order matters and is not arbitrary:
 *  - `inactive` wins over everything, because an admin switching a key off is a
 *    deliberate act that should not be reported as merely expired;
 *  - `expired` outranks `used`, so a key that ran out of time reads as expired
 *    even if a parent had already claimed it.
 *
 * `now` is a parameter rather than a call to `Date.now()` so the scheduled sweep
 * and the tests can both ask "what will this be at time T".
 */
export function resolveKeyStatus(key: StatusableKey, now: number = Date.now()): RegistrationKeyStatus {
  if (key.active === false) return 'inactive';
  if (key.expiresAt != null && key.expiresAt < now) return 'expired';
  // Parent-side keys are spent once a parent has claimed one; an applicationAdmin
  // key has no such notion and stays active until switched off or expired.
  if (key.role === 'userAdmin' && key.parentId) return 'used';
  return 'active';
}
