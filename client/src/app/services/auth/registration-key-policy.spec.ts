/**
 * The sign-in gate for a Registration Key, as a pure decision.
 *
 * This lived inside `AuthService.validateUserRegistrationKey`, where reaching it
 * meant standing up Firebase Auth and Firestore. The fetch stays in the service;
 * what is pinned here is the part that actually encodes a rule — which problem
 * blocks sign-in, and which of the two audiences is told about it.
 *
 * The child wording is the load-bearing half: a child's key is their *parent's*,
 * so a child who cannot sign in must be pointed at the person who can fix it.
 */

import { findKeyProblem, keyProblemMessage } from './registration-key-policy';
import { RegistrationKey } from '../../models';

const NOW = 1_700_000_000_000;

function key(overrides: Partial<RegistrationKey> = {}): RegistrationKey {
  return { id: 'key-1', active: true, ...overrides };
}

describe('findKeyProblem', () => {
  it('returns null for an active key with no expiry', () => {
    expect(findKeyProblem(key(), 'self', NOW)).toBeNull();
  });

  it('returns null for an active key whose expiry is still in the future', () => {
    expect(findKeyProblem(key({ expiresAt: NOW + 1 }), 'self', NOW)).toBeNull();
  });

  it('reports a missing key', () => {
    expect(findKeyProblem(null, 'self', NOW)).toBe('Registration key not found.');
  });

  it('reports an inactive key', () => {
    expect(findKeyProblem(key({ active: false }), 'self', NOW)).toBe('Registration key is inactive.');
  });

  it('reports an expired key', () => {
    expect(findKeyProblem(key({ expiresAt: NOW - 1 }), 'self', NOW))
      .toBe('Registration key has expired.');
  });

  it('treats a key expiring exactly now as expired', () => {
    // `expiresAt <= now`, not `<` — the boundary belongs to the expired side.
    expect(findKeyProblem(key({ expiresAt: NOW }), 'self', NOW))
      .toBe('Registration key has expired.');
  });

  it('checks active before expiry, so an inactive expired key reads as inactive', () => {
    expect(findKeyProblem(key({ active: false, expiresAt: NOW - 1 }), 'self', NOW))
      .toBe('Registration key is inactive.');
  });

  describe('child wording', () => {
    it('points a child at their parent when the key is missing', () => {
      expect(findKeyProblem(null, 'child', NOW))
        .toBe("Your parent's Registration Key was not found. Please contact your parent.");
    });

    it('asks a child to have their parent renew an inactive key', () => {
      expect(findKeyProblem(key({ active: false }), 'child', NOW))
        .toBe("Your parent's Registration Key is inactive. Please ask your parent to renew the subscription.");
    });

    it('asks a child to have their parent renew an expired key', () => {
      expect(findKeyProblem(key({ expiresAt: NOW - 1 }), 'child', NOW))
        .toBe("Your parent's Registration Key has expired. Please ask your parent to renew the subscription before you can sign in.");
    });

    it('still lets a child through on a valid key', () => {
      expect(findKeyProblem(key({ expiresAt: NOW + 1 }), 'child', NOW)).toBeNull();
    });
  });
});

describe('keyProblemMessage', () => {
  it('words a problem the API found exactly as findKeyProblem would', () => {
    expect(keyProblemMessage('Expired', 'self')).toBe(findKeyProblem(key({ expiresAt: NOW }), 'self', NOW)!);
    expect(keyProblemMessage('Inactive', 'child')).toBe(findKeyProblem(key({ active: false }), 'child', NOW)!);
    expect(keyProblemMessage('Missing', 'child')).toBe(findKeyProblem(null, 'child', NOW)!);
  });
});
