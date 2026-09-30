/**
 * `GET /me` → the app's `User`. The API speaks in roles (STUDENT, PARENT) where
 * the app spoke in `accountType` plus `userAdmin`; this translation is what lets
 * every guard, strategy and screen keep working while the data source changes.
 */

import { toAppUser } from './current-user.mapper';
import { ApiCurrentUser, ApiRole } from '../api/api-models';


function me(roles: ApiRole[], overrides: Partial<ApiCurrentUser['user']> = {}): ApiCurrentUser {
  return {
    user: {
      id: 5, signInUid: 'dev-student', email: 'sara@school.test', displayName: 'Sara', firstName: 'Sara', lastName: null,
      mobileNumber: null, photoUrl: null, roles, isActive: true, parentId: 4, teacherId: null, stageId: 1, gradeId: 2, classId: 3,
      registrationKeyId: 9, createdOn: '2026-01-02T03:04:05Z', lastActiveOn: null, ...overrides
    },
    tenant: { id: 1, slug: 'demo-school', name: 'Demo', isActive: true, plan: 'Trial', logoUrl: null, primaryColor: null, createdOn: '2026-01-01T00:00:00Z' },
    registrationKey: null,
    registrationKeyProblem: null
  };
}

describe('toAppUser', () => {
  it('turns a student into the child account the app knows', () => {
    const user = toAppUser(me(['STUDENT']));

    expect(user.accountType).toBe('child');
    expect(user.roles).toEqual([]);
  });

  it('turns a parent into a userAdmin with accountType parent', () => {
    const user = toAppUser(me(['PARENT']));

    expect(user.accountType).toBe('parent');
    expect(user.roles).toEqual(['userAdmin']);
  });

  it('keeps staff roles under their app names', () => {
    expect(toAppUser(me(['APPLICATION_ADMIN', 'TEACHER'])).roles).toEqual(['applicationAdmin', 'teacher']);
    expect(toAppUser(me(['PLATFORM_ADMIN'])).roles).toEqual(['platformAdmin']);
  });

  it('gives ids as the strings the models expect, and the organization as its slug', () => {
    const user = toAppUser(me(['STUDENT']));

    expect([user.parentId, user.stageId, user.gradeId, user.classId, user.registrationKeyId]).toEqual(['4', '1', '2', '3', '9']);
    expect(user.tenantId).toBe('demo-school');
    expect([user.id, user.uid]).toEqual(['5', '5']);
  });

  it('leaves absent links undefined rather than the string "null"', () => {
    const user = toAppUser(me(['TEACHER'], { parentId: null, classId: null, stageId: null, gradeId: null, registrationKeyId: null }));

    expect([user.parentId, user.classId, user.registrationKeyId]).toEqual([undefined, undefined, undefined]);
  });

  it('parses dates and carries the active flag', () => {
    const user = toAppUser(me(['STUDENT'], { isActive: false }));

    expect(user.createdAt).toEqual(new Date('2026-01-02T03:04:05Z'));
    expect(user.active).toBeFalse();
  });

  it('reports when someone was last active, and nothing for someone who never signed in', () => {
    expect(toAppUser(me(['STUDENT'], { lastActiveOn: '2026-09-29T08:15:00Z' })).lastLoginAt).toEqual(new Date('2026-09-29T08:15:00Z'));
    expect(toAppUser(me(['STUDENT'])).lastLoginAt).toBeUndefined();
  });

  it('has no organization for a platform administrator', () => {
    expect(toAppUser({ ...me(['PLATFORM_ADMIN']), tenant: null }).tenantId).toBeUndefined();
  });
});
