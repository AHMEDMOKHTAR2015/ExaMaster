import { User, AuthProvider, CompletedQuiz, AdminRole } from '../../models';
import { ParticipationRecord } from '../../models/participation';

/**
 * Builder for constructing Firebase auth emails from user details.
 * Email format: {mobileNumber}@mobile.local
 * Example: "01007763077" → "01007763077@mobile.local"
 *
 * Deliberately NOT namespaced by tenant, even though Firebase Auth is a single
 * pool shared by every customer. A mobile number is therefore unique across the
 * whole platform, and the second organization to register one is refused with
 * `auth/email-already-in-use`.
 *
 * Namespacing it would need the tenant to be known at *sign-in*, when all the
 * user has typed is a phone number and a password — which means asking them
 * which school they belong to, or putting each customer on its own subdomain.
 * Both were ruled out in favour of a single sign-in page, so the collision is
 * accepted and surfaces as a provisioning error rather than a silent
 * cross-tenant link. Revisit this together with per-tenant subdomains; it
 * cannot be changed on its own, because every existing login is already
 * registered under this format.
 */
export class EmailBuilder {
  private _firstName = '';
  private _lastName = '';
  private _mobileNumber = '';
  private _domain = 'mobile.local';

  setFirstName(name: string): this {
    this._firstName = name.trim();
    return this;
  }

  setLastName(name: string): this {
    this._lastName = name.trim();
    return this;
  }

  setMobileNumber(mobile: string): this {
    this._mobileNumber = mobile;
    return this;
  }

  setDomain(domain: string): this {
    this._domain = domain;
    return this;
  }

  build(): string {
    const normalized = this._mobileNumber.replace(/\D/g, '');
    if (!normalized || normalized.length < 4) {
      throw new Error('Mobile number must have at least 4 digits');
    }

    return `${normalized}@${this._domain}`;
  }

  /**
   * Static convenience method for quick email generation.
   * firstName/lastName are accepted for API compatibility but no longer used.
   */
  static buildEmail(firstName: string, lastName: string, mobileNumber: string): string {
    return new EmailBuilder()
      .setMobileNumber(mobileNumber)
      .build();
  }

  /**
   * Build email from a mobile number alone (or pass through a full email if user
   * already typed one with an "@").
   */
  static fromMobile(mobileOrEmail: string, domain = 'mobile.local'): string {
    const input = (mobileOrEmail ?? '').trim();
    if (!input) throw new Error('Mobile number is required');
    if (input.includes('@')) return input;
    return new EmailBuilder().setMobileNumber(input).setDomain(domain).build();
  }
}

/**
 * Builder for constructing User objects using the Builder Design Pattern.
 * Provides a fluent API for step-by-step user construction.
 */
export class UserBuilder {
  private _uid = '';
  private _email = '';
  private _displayName = '';
  private _firstName = '';
  private _lastName = '';
  private _mobileNumber?: string;
  private _photoURL?: string | null;
  private _providerId: AuthProvider = 'email';
  private _accountType?: 'parent' | 'child';
  private _tenantId?: string;
  private _roles?: AdminRole[];
  private _teacherId?: string;
  private _parentId?: string;
  private _childIds?: string[];
  private _stageId?: string;
  private _gradeId?: string;
  private _classId?: string;
  private _registrationKeyId?: string;
  private _active?: boolean;
  private _createdAt: Date = new Date();
  private _lastLoginAt: Date = new Date();
  private _completedQuizzes: CompletedQuiz[] = [];
  private _participations?: ParticipationRecord[];
  private _participationCount?: number;

  setUid(uid: string): this { this._uid = uid; return this; }
  setEmail(email: string): this { this._email = email; return this; }
  setDisplayName(name: string): this { this._displayName = name; return this; }
  setFirstName(name: string): this { this._firstName = name; return this; }
  setLastName(name: string): this { this._lastName = name; return this; }
  setMobileNumber(mobile: string): this { this._mobileNumber = mobile; return this; }
  setPhotoURL(url: string | null | undefined): this { this._photoURL = url; return this; }
  setProviderId(provider: AuthProvider): this { this._providerId = provider; return this; }
  setAccountType(type: 'parent' | 'child'): this { this._accountType = type; return this; }
  /**
   * The organization the account joins. Required for every account a customer
   * creates: security rules reject a `users` document whose `tenantId` is not
   * the creating admin's own, and an account without one can read nothing.
   */
  setTenantId(id: string | undefined): this { this._tenantId = id; return this; }
  setRoles(roles: AdminRole[]): this { this._roles = roles; return this; }
  setTeacherId(id: string | undefined): this { this._teacherId = id; return this; }
  setParentId(id: string): this { this._parentId = id; return this; }
  setChildIds(ids: string[]): this { this._childIds = ids; return this; }
  setStageId(id: string): this { this._stageId = id; return this; }
  setGradeId(id: string | undefined): this { this._gradeId = id; return this; }
  setClassId(id: string): this { this._classId = id; return this; }
  setRegistrationKeyId(id: string): this { this._registrationKeyId = id; return this; }
  setActive(active: boolean): this { this._active = active; return this; }
  setCreatedAt(date: Date): this { this._createdAt = date; return this; }
  setLastLoginAt(date: Date): this { this._lastLoginAt = date; return this; }
  setCompletedQuizzes(quizzes: CompletedQuiz[]): this { this._completedQuizzes = quizzes; return this; }
  setParticipations(p: ParticipationRecord[]): this { this._participations = p; return this; }
  setParticipationCount(count: number): this { this._participationCount = count; return this; }

  /**
   * Auto-generates displayName from firstName and lastName if not explicitly set.
   * Auto-generates email using EmailBuilder if firstName, lastName, and mobileNumber are available.
   */
  build(): User {
    const displayName = this._displayName
      || `${this._firstName} ${this._lastName}`.trim()
      || 'Anonymous User';

    let email = this._email;
    if (!email && this._firstName && this._lastName && this._mobileNumber) {
      email = EmailBuilder.buildEmail(this._firstName, this._lastName, this._mobileNumber);
    }

    if (!this._uid) throw new Error('User uid is required');

    return {
      uid: this._uid,
      email,
      displayName,
      firstName: this._firstName || undefined,
      lastName: this._lastName || undefined,
      mobileNumber: this._mobileNumber,
      photoURL: this._photoURL ?? undefined,
      providerId: this._providerId,
      accountType: this._accountType,
      tenantId: this._tenantId,
      roles: this._roles,
      teacherId: this._teacherId,
      parentId: this._parentId,
      childIds: this._childIds,
      stageId: this._stageId,
      gradeId: this._gradeId,
      classId: this._classId,
      registrationKeyId: this._registrationKeyId,
      active: this._active,
      createdAt: this._createdAt,
      lastLoginAt: this._lastLoginAt,
      completedQuizzes: this._completedQuizzes,
      participations: this._participations,
      participationCount: this._participationCount
    };
  }

  /**
   * Serialize a User to a Firestore-safe payload.
   * Firestore rejects `undefined`; replace optional fields with `null`/sensible
   * defaults and convert Date instances to ISO strings.
   */
  static toFirestorePayload(user: User): Record<string, unknown> {
    const toIso = (d: unknown) => (d instanceof Date ? d.toISOString() : d);
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      mobileNumber: user.mobileNumber ?? null,
      photoURL: user.photoURL ?? null,
      providerId: user.providerId,
      accountType: user.accountType ?? null,
      // Written as `null` rather than omitted when absent, so the field always
      // exists: rules compare it with `get('tenantId', '')`, and a tenantless
      // document is matched by no organization at all.
      tenantId: user.tenantId ?? null,
      // Security rules match this array directly with `roles.hasAny([...])`, so
      // no denormalized companion field has to be kept in sync alongside it.
      roles: user.roles ?? null,
      teacherId: user.teacherId ?? null,
      parentId: user.parentId ?? null,
      childIds: user.childIds ?? [],
      stageId: user.stageId ?? null,
      gradeId: user.gradeId ?? null,
      classId: user.classId ?? null,
      registrationKeyId: user.registrationKeyId ?? null,
      active: user.active ?? true,
      createdAt: toIso(user.createdAt),
      lastLoginAt: toIso(user.lastLoginAt),
      completedQuizzes: (user.completedQuizzes ?? []).map(q => ({
        ...q,
        completedAt: toIso(q.completedAt)
      })),
      // `participations` is deliberately not persisted: nothing has ever
      // populated it (see teacher-stats.service.ts and teacher-dashboard-view),
      // so it only ever wrote an empty array onto every user document. The live
      // counter is `participationCount`; the records live in `participations`.
      participationCount: user.participationCount ?? 0
    };
  }
}

