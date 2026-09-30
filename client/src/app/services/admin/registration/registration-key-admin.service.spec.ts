/**
 * Registration keys on the API: the server generates the code a family types,
 * status is a filter the server applies, and only a family (userAdmin) key has
 * a children allowance.
 */

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../../environments/environment';
import { RegistrationKeyAdminService } from './registration-key-admin.service';
import { ApiRegistrationKey } from '../../api/api-models';

const api = (path: string) => `${environment.apiUrl}${path}`;
const stored = (overrides: Partial<ApiRegistrationKey> = {}): ApiRegistrationKey => ({
  id: 7, code: 'f3b1-generated', role: 'PARENT', isActive: true, expiresOn: '2027-01-01T00:00:00.000Z', status: 'Active',
  parentId: null, claimedOn: null, maxChildren: 3, childCount: 0, createdOn: '2026-09-28T00:00:00Z', ...overrides
});

describe('RegistrationKeyAdminService', () => {
  let service: RegistrationKeyAdminService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(RegistrationKeyAdminService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('creates a family key and returns the code the server generated', async () => {
    const created = service.createKey({ role: 'userAdmin', expiresAt: Date.parse('2027-01-01T00:00:00Z'), maxChildUses: 3 });
    const request = http.expectOne(api('/registration-keys'));
    expect(request.request.body).toEqual({ role: 'PARENT', expiresOn: '2027-01-01T00:00:00.000Z', maxChildren: 3 });
    request.flush(stored());

    const key = await created;
    expect([key.id, key.code, key.role, key.status, key.maxChildUses]).toEqual(['7', 'f3b1-generated', 'userAdmin', 'active', 3]);
  });

  it('never sends an allowance or expiry an administrator key does not have', async () => {
    const created = service.createKey({ role: 'applicationAdmin', maxChildUses: 5 });
    const request = http.expectOne(api('/registration-keys'));
    expect(request.request.body).toEqual({ role: 'APPLICATION_ADMIN', expiresOn: null, maxChildren: null });
    request.flush(stored({ role: 'APPLICATION_ADMIN', expiresOn: null, maxChildren: null }));
    await created;
  });

  it("filters by the API's status names and pages by page number", async () => {
    const page = service.pagedSource('used').fetchPage(10, '2');
    const request = http.expectOne(r => r.url === api('/registration-keys'));
    expect([request.request.params.get('status'), request.request.params.get('page')]).toEqual(['Used', '2']);
    request.flush({ items: [stored({ status: 'Used' })], page: 2, pageSize: 10, totalCount: 11 });
    expect((await page).nextCursor).toBeUndefined();
  });

  it('updates by id with the active flag, expiry and allowance', async () => {
    const done = service.updateKey({ id: '7', code: 'f3b1', active: false, role: 'userAdmin', expiresAt: Date.parse('2027-02-01T00:00:00Z'), maxChildUses: 2 });
    const request = http.expectOne(api('/registration-keys/7'));
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ isActive: false, expiresOn: '2027-02-01T00:00:00.000Z', maxChildren: 2 });
    request.flush({ id: 7 });
    await done;
  });
});
