/** Who a visitor asks to join as. Teachers and administrators are always created by their school. */
export type AccessRequestKind = 'parent' | 'child';

export type AccessRequestStatus = 'pending' | 'approved' | 'rejected';

/**
 * A visitor without a registration key asking to join. Only the platform
 * administrator reads these; approving one creates the account in the
 * organization they choose. What the visitor said about their school, grade
 * and parent is a hint for the reviewer, never a reference.
 */
export interface AccessRequest {
  id: string;
  kind: AccessRequestKind;
  firstName: string;
  lastName: string;
  mobileNumber: string;
  contactEmail?: string;
  /** A parent's request: how many children they want to follow. Absent on one stored before it was asked. */
  childrenCount?: number;
  /** Always asked for; absent only on a request stored before it was required. */
  schoolName?: string;
  /** A student's request only. */
  gradeName?: string;
  parentName?: string;
  parentMobileNumber?: string;
  note?: string;
  status: AccessRequestStatus;
  /** Epoch milliseconds. */
  createdAt: number;
  decidedAt?: number;
  rejectionReason?: string;
  /** Approved only: the organization's numeric API id and name, and the account created there. */
  approvedTenantId?: number;
  approvedTenantName?: string;
  approvedUserId?: string;
}

/** What the request-access card sends. The password becomes the account's on approval. */
export interface AccessRequestInput {
  kind: AccessRequestKind;
  firstName: string;
  lastName: string;
  mobileNumber: string;
  password: string;
  schoolName: string;
  email?: string;
  /** Required for a parent: how many children they want to follow, 1–50. */
  childrenCount?: number;
  /** Required for a student. */
  gradeName?: string;
  parentName?: string;
  parentMobileNumber?: string;
  note?: string;
}

/** What approving takes: the organization always; a parent's children allowance, or a child's class and parent. */
export interface AccessRequestApproval {
  tenantId: number;
  maxChildren?: number | null;
  classId?: number;
  parentId?: number;
}

/** An organization the reviewer can approve a request into. `id` is the API's numeric id (routes take it). */
export interface AccessRequestTenantOption {
  id: number;
  name: string;
  slug: string;
  active: boolean;
}

export interface AccessRequestClassOption {
  id: number;
  name: string;
  gradeName: string;
  stageName: string;
}

export interface AccessRequestParentOption {
  id: number;
  displayName: string;
  mobileNumber?: string;
  childCount: number;
  /** `undefined` = unlimited. */
  maxChildren?: number;
  /** Whether their family key is active and unexpired: a child can only be added to a usable key. */
  hasUsableKey: boolean;
}
