/**
 * The access-request service's contract with the API: a request carries only
 * the hints that belong to its kind (the API refuses a parent's request that
 * names a grade or a parent), and the review list comes back in the app's
 * own vocabulary.
 */

import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AccessRequestService } from './access-request.service';
import { AuthService } from '../auth';
import { environment } from '../../../environments/environment';

describe('AccessRequestService', () => {
  let service: AccessRequestService;
  let http: HttpTestingController;
  const user = signal<{ roles: string[] } | null>(null);

  beforeEach(() => {
    user.set(null);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { user } }
      ]
    });
    service = TestBed.inject(AccessRequestService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it("sends a parent's request without a child's hints", async () => {
    const sent = service.submit({
      kind: 'parent', firstName: ' Mona ', lastName: 'Adel', mobileNumber: '0100 123', password: 'secret1',
      email: ' mona@example.com ', schoolName: ' Acme School ', gradeName: 'Grade 3', parentName: 'Someone', note: '  ',
      childrenCount: 2
    });

    const request = http.expectOne(`${environment.apiUrl}/access-requests`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      kind: 'Parent', firstName: 'Mona', lastName: 'Adel', mobileNumber: '0100 123', password: 'secret1',
      email: 'mona@example.com', childrenCount: 2, schoolName: 'Acme School', gradeName: null, parentName: null, parentMobileNumber: null, note: null
    });
    request.flush({ id: 1 });
    await sent;
  });

  it("sends a child's request without a contact email or a children count", async () => {
    const sent = service.submit({
      kind: 'child', firstName: 'Omar', lastName: 'Adel', mobileNumber: '0111', password: 'secret1',
      email: 'kid@example.com', schoolName: 'Acme School', gradeName: 'Grade 3', parentName: 'Mona Adel', parentMobileNumber: '0100',
      childrenCount: 3
    });

    const request = http.expectOne(`${environment.apiUrl}/access-requests`);
    expect(request.request.body).toEqual(jasmine.objectContaining({
      kind: 'Child', email: null, childrenCount: null, gradeName: 'Grade 3', parentName: 'Mona Adel', parentMobileNumber: '0100'
    }));
    request.flush({ id: 2 });
    await sent;
  });

  it('maps the review list into the app vocabulary and pages it', async () => {
    const listed = service.list({ status: 'approved', kind: 'child', page: 1, pageSize: 1 });

    const request = http.expectOne(r => r.url === `${environment.apiUrl}/platform/access-requests`);
    expect(request.request.params.get('status')).toBe('Approved');
    expect(request.request.params.get('kind')).toBe('Child');
    request.flush({
      items: [{
        id: 7, kind: 'Child', firstName: 'Omar', lastName: 'Adel', mobileNumber: '0111', contactEmail: null, childrenCount: null,
        schoolName: 'Acme', gradeName: null, parentName: null, parentMobileNumber: null, note: null,
        status: 'Approved', createdOn: '2026-10-01T08:00:00Z', decidedOn: '2026-10-01T09:00:00Z', rejectionReason: null,
        approvedTenantId: 3, approvedTenantName: 'Acme School', approvedUserId: 42
      }],
      page: 1, pageSize: 1, totalCount: 2
    });

    const result = await listed;
    expect(result.totalCount).toBe(2);
    expect(result.nextCursor).toBe('2');
    expect(result.items[0]).toEqual(jasmine.objectContaining({
      id: '7', kind: 'child', status: 'approved', schoolName: 'Acme', gradeName: undefined,
      approvedTenantName: 'Acme School', approvedUserId: '42', createdAt: Date.parse('2026-10-01T08:00:00Z')
    }));
  });

  it('takes the badge count from an unfiltered pending list', async () => {
    user.set({ roles: ['platformAdmin'] });
    TestBed.flushEffects();
    http.expectOne(r => r.url.endsWith('/platform/access-requests') && r.params.get('pageSize') === '1')
      .flush({ items: [], page: 1, pageSize: 1, totalCount: 0 });
    await Promise.resolve();

    const listed = service.list({ status: 'pending', page: 1, pageSize: 20 });
    http.expectOne(r => r.url.endsWith('/platform/access-requests') && r.params.get('pageSize') === '20')
      .flush({ items: [], page: 1, pageSize: 20, totalCount: 5 });
    await listed;

    expect(service.pendingCount()).toBe(5);
  });
});
