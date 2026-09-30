import { RegistrationKey } from '../../models';

/**
 * Who is being turned away. A child's Registration Key is their *parent's*, so
 * the same key problem has to be worded twice: the person reading the message
 * is not always the person who can fix it.
 */
export type KeyAudience = 'self' | 'child';

const MESSAGES: Record<'missing' | 'inactive' | 'expired', Record<KeyAudience, string>> = {
  missing: {
    self: 'Registration key not found.',
    child: "Your parent's Registration Key was not found. Please contact your parent."
  },
  inactive: {
    self: 'Registration key is inactive.',
    child: "Your parent's Registration Key is inactive. Please ask your parent to renew the subscription."
  },
  expired: {
    self: 'Registration key has expired.',
    child: "Your parent's Registration Key has expired. Please ask your parent to renew the subscription before you can sign in."
  }
};

/**
 * Why this key must not admit its holder, or `null` when it may.
 *
 * `now` is a parameter rather than a `Date.now()` call so the expiry boundary is
 * testable without mocking the clock — and so one sign-in decision is made
 * against a single instant instead of re-reading the time mid-check.
 *
 * A key with no `expiresAt` never expires; that is the `applicationAdmin` case,
 * not an oversight.
 */
export function findKeyProblem(
  key: RegistrationKey | null | undefined,
  audience: KeyAudience,
  now: number
): string | null {
  if (!key) return MESSAGES.missing[audience];
  if (!key.active) return MESSAGES.inactive[audience];
  if (key.expiresAt && key.expiresAt <= now) return MESSAGES.expired[audience];
  return null;
}

/**
 * The same messages, for a problem the API has already found (`GET /me`
 * reports it as `registrationKeyProblem`). The API decides; this only words it
 * for whoever is reading.
 */
export function keyProblemMessage(problem: 'Missing' | 'Inactive' | 'Expired', audience: KeyAudience): string {
  return MESSAGES[problem.toLowerCase() as 'missing' | 'inactive' | 'expired'][audience];
}
