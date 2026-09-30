/**
 * Users and accounts on the API. What is pinned here is what would corrupt data
 * silently if it drifted: which API role each app account type means, how a
 * page cursor maps to the API's page numbers, which calls an edit makes, and
 * which kind of account each create asks for.
 */

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../../environments/environment';
import { AppUserService } from './app-user.service';
import { UserAdminService } from './user-admin.service';
import { ChildAccountService } from '../../auth/child-account.service';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { ApiUser } from '../../api/api-models';
import { toRegistrationKey, toUser } from '../../auth/current-user.mapper';

const api = (path: string) => `${environment.apiUrl}${path}`;
const settle = () => new Promise(resolve => setTimeout(resolve));

function apiUser(id: number, overrides: Partial<ApiUser> = {}): ApiUser {
  return {
    id, signInUid: `uid-${id}`, email: `u${id}@x.test`, displayName: `User ${id}`, firstName: null, lastName: null, mobileNumber: null,
    photoUrl: null, roles: ['PARENT'], isActive: true, parentId: null, teacherId: null, stageId: null, gradeId: null, classId: null,
    registrationKeyId: null, createdOn: '2026-01-01T00:00:00Z', lastActiveOn: null, ...overrides
  };
}

describe('users and accounts on the API', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting()
      ]
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(TenantContextService).setTenantId('demo-school');
  });

  afterEach(() => http.verify());

  const expectGet = (path: string) => http.expectOne(r => r.url === api(path));

  it("maps the app's account types to API roles and a cursor to the next page number", async () => {
    const source = TestBed.inject(AppUserService).pagedSource('child');

    const first = source.fetchPage(2);
    let request = expectGet('/users');
    expect([request.request.params.get('role'), request.request.params.get('page'), request.request.params.get('pageSize')]).toEqual(['STUDENT', '1', '2']);
    request.flush({ items: [apiUser(1, { roles: ['STUDENT'] }), apiUser(2, { roles: ['STUDENT'] })], page: 1, pageSize: 2, totalCount: 3 });
    const page1 = await first;
    expect(page1.nextCursor).toBe('2');
    expect(page1.items[0].accountType).toBe('child');

    const second = source.fetchPage(2, page1.nextCursor);
    request = expectGet('/users');
    expect(request.request.params.get('page')).toBe('2');
    request.flush({ items: [apiUser(3, { roles: ['STUDENT'] })], page: 2, pageSize: 2, totalCount: 3 });
    expect((await second).nextCursor).toBeUndefined();
  });

  it('edits through the specific calls, never the stage or grade (they follow from the class)', async () => {
    const done = TestBed.inject(AppUserService).updateUserProfile('7', { firstName: 'Sara', lastName: 'S', parentId: '4', classId: '3', active: false });
    const calls: TestRequest[] = [];
    for (let i = 0; i < 4; i++) {
      await settle();
      const request = http.match(() => true)[0];
      calls.push(request);
      request.flush({ id: 7 });
    }
    await done;

    expect(calls.map(c => `${c.request.method} ${c.request.url.replace(environment.apiUrl, '')}`)).toEqual([
      'PUT /users/7/name', 'PUT /users/7/parent', 'PUT /users/7/placement', 'POST /users/7:deactivate'
    ]);
    expect(calls[1].request.body).toEqual({ parentId: 4 });
    expect(calls[2].request.body).toEqual({ classId: 3 });
  });

  it("sends a staff member's app roles as API roles", async () => {
    const done = TestBed.inject(AppUserService).updateUserProfile('9', { roles: ['teacher'] });
    const request = http.expectOne(api('/users/9/roles'));
    expect(request.request.body).toEqual({ roles: ['TEACHER'] });
    request.flush({ id: 9 });
    await done;
  });

  it('creates each kind of account with the fields the API needs, and nothing it decides itself', async () => {
    const accounts = TestBed.inject(ChildAccountService);

    const child = accounts.createChildAccount({ parentId: '4', firstName: 'Kid', lastName: 'K', classId: '3', mobileNumber: '0100', password: 'secret1' });
    let request = http.expectOne(api('/users'));
    expect(request.request.body).toEqual({ kind: 'Student', firstName: 'Kid', lastName: 'K', mobileNumber: '0100', password: 'secret1', parentId: 4, classId: 3 });
    request.flush({ id: 21 });
    expect(await child).toBe('21');

    const staff = accounts.createAdminAccount({ firstName: 'T', lastName: 'T', mobileNumber: '0200', password: 'secret1', roles: ['teacher'] });
    request = http.expectOne(api('/users'));
    expect(request.request.body['kind']).toBe('Teacher');
    request.flush({ id: 22 });
    await staff;

    const parentAsAdmin = accounts.createAdminAccount({ firstName: 'P', lastName: 'P', mobileNumber: '0300', password: 'secret1', roles: ['userAdmin'], registrationKeyId: 'code-1' });
    request = http.expectOne(api('/users'));
    expect([request.request.body['kind'], request.request.body['registrationKeyCode']]).toEqual(['Parent', 'code-1']);
    request.flush({ id: 23 });
    await parentAsAdmin;
  });

  it("gives a parent their own children from /me/children", async () => {
    const children = TestBed.inject(UserAdminService).listMyChildren();
    http.expectOne(api('/me/children')).flush({ children: [apiUser(5, { roles: ['STUDENT'], parentId: 4 })] });

    const [child] = await children;
    expect([child.id, child.uid, child.parentId, child.tenantId]).toEqual(['5', '5', '4', 'demo-school']);
  });
});

describe('API users and keys as app models', () => {
  it('addresses a person by API id, under both names the app keys people by', () => {
    const user = toUser(apiUser(12, { childCount: 2 }), 'demo-school');
    expect([user.id, user.uid, user.childCount, user.roles?.[0], user.accountType]).toEqual(['12', '12', 2, 'userAdmin', 'parent']);
  });

  it('keeps the code a family types separate from the key id the screens address', () => {
    const key = toRegistrationKey({
      id: 3, code: '0b5c-legacy', role: 'PARENT', isActive: true, expiresOn: '2027-01-01T00:00:00Z', status: 'Used', parentId: 4,
      claimedOn: '2026-01-01T00:00:00Z', maxChildren: 3, childCount: 1, createdOn: '2025-12-01T00:00:00Z'
    });
    expect([key.id, key.code, key.role, key.status, key.childUseCount, key.maxChildUses, key.parentId]).toEqual(['3', '0b5c-legacy', 'userAdmin', 'used', 1, 3, '4']);
    expect(key.expiresAt).toBe(Date.parse('2027-01-01T00:00:00Z'));
  });
});
