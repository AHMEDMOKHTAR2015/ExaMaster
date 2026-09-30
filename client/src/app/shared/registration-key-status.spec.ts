import { resolveKeyStatus } from './registration-key-status';

/**
 * This rule is now persisted, not just rendered — the trigger writes what it
 * returns and the admin screen filters on the stored value. So the precedence
 * between the four outcomes is a data-correctness question, not a display one:
 * get it wrong and a key is filed under a status an admin cannot find it by.
 */
describe('resolveKeyStatus', () => {
  const NOW = 1_700_000_000_000;

  it('is active for a live key with no expiry', () => {
    expect(resolveKeyStatus({ active: true, role: 'applicationAdmin' }, NOW)).toBe('active');
  });

  it('is active while the expiry is still ahead', () => {
    expect(resolveKeyStatus({ active: true, expiresAt: NOW + 1000 }, NOW)).toBe('active');
  });

  it('is expired once the moment has passed', () => {
    expect(resolveKeyStatus({ active: true, expiresAt: NOW - 1 }, NOW)).toBe('expired');
  });

  it('treats the exact expiry moment as still valid', () => {
    // A key expiring "at" T is usable at T; `<` not `<=`. Pinned because the
    // sweep and the badge must agree on the boundary to the millisecond.
    expect(resolveKeyStatus({ active: true, expiresAt: NOW }, NOW)).toBe('active');
  });

  it('is used once a parent has claimed a userAdmin key', () => {
    expect(resolveKeyStatus({ active: true, role: 'userAdmin', parentId: 'p1' }, NOW)).toBe('used');
  });

  it('does not call an unclaimed userAdmin key used', () => {
    expect(resolveKeyStatus({ active: true, role: 'userAdmin' }, NOW)).toBe('active');
  });

  it('has no notion of used for an applicationAdmin key', () => {
    // `parentId` is meaningless on this role; it must not read as spent.
    expect(resolveKeyStatus({ active: true, role: 'applicationAdmin', parentId: 'p1' }, NOW)).toBe('active');
  });

  it('reports inactive ahead of expired', () => {
    // Switching a key off is a deliberate act; reporting it as merely expired
    // would hide that someone did it.
    expect(resolveKeyStatus({ active: false, expiresAt: NOW - 1 }, NOW)).toBe('inactive');
  });

  it('reports inactive ahead of used', () => {
    expect(resolveKeyStatus({ active: false, role: 'userAdmin', parentId: 'p1' }, NOW)).toBe('inactive');
  });

  it('reports expired ahead of used', () => {
    // A claimed key that then ran out of time reads as expired: that is the
    // reason it can no longer be used.
    expect(resolveKeyStatus(
      { active: true, expiresAt: NOW - 1, role: 'userAdmin', parentId: 'p1' }, NOW
    )).toBe('expired');
  });

  it('treats a missing active flag as live', () => {
    // Keys written before `active` was always set must not all read as inactive.
    expect(resolveKeyStatus({ role: 'applicationAdmin' }, NOW)).toBe('active');
  });

  it('ignores a null expiry rather than comparing against it', () => {
    expect(resolveKeyStatus({ active: true, expiresAt: null }, NOW)).toBe('active');
  });
});
