import { AppErrorHandler } from './app-error-handler';
import { TenantUnavailableError } from '../services/tenant/tenant-context.service';

/**
 * An error handler that swallows anything is worse than none at all, so what
 * matters here is the boundary: exactly one error type, for exactly one reason,
 * is absorbed. Everything else has to reach the console unchanged.
 */
describe('AppErrorHandler', () => {
  let handler: AppErrorHandler;
  let errors: unknown[];
  let debugs: unknown[];

  beforeEach(() => {
    handler = new AppErrorHandler();
    errors = [];
    debugs = [];
    spyOn(console, 'error').and.callFake((...args: unknown[]) => { errors.push(args[0]); });
    spyOn(console, 'debug').and.callFake((...args: unknown[]) => { debugs.push(args[0]); });
  });

  it('absorbs a request abandoned because the user signed out', () => {
    handler.handleError(new TenantUnavailableError('SubjectService', 'signed-out'));

    expect(errors.length).toBe(0);
    expect(debugs.length).toBe(1);
  });

  it('unwraps an unhandled promise rejection to find it', () => {
    // Angular wraps rejections; the real error hides on `rejection`, so checking
    // the outer object alone would miss every case this exists for.
    handler.handleError({ rejection: new TenantUnavailableError('QuizAdminService', 'signed-out') });

    expect(errors.length).toBe(0);
    expect(debugs.length).toBe(1);
  });

  it('still reports a signed-in user who has no organization', () => {
    // The same absence, a different cause: this one is a real defect — an
    // incomplete backfill, or a user document written by hand — and hiding it
    // would make the data look fine while every read failed.
    handler.handleError(new TenantUnavailableError('SubjectService', 'unresolved'));

    expect(errors.length).toBe(1);
    expect(debugs.length).toBe(0);
  });

  it('passes ordinary errors straight through', () => {
    const boom = new Error('something genuinely broke');

    handler.handleError(boom);

    expect(errors).toEqual([boom]);
    expect(debugs.length).toBe(0);
  });

  it('passes a wrapped ordinary rejection through', () => {
    const boom = new Error('a real failure inside a promise');

    handler.handleError({ rejection: boom });

    expect(errors.length).toBe(1);
    expect(debugs.length).toBe(0);
  });
});

describe('TenantUnavailableError', () => {
  it('says the session ended when the user signed out', () => {
    const error = new TenantUnavailableError('SubjectService', 'signed-out');

    // The old message — "no tenant resolved for the current user" — described a
    // misconfiguration, when what happened was simply that the user left.
    expect(error.message).toContain('session ended');
    expect(error.message).toContain('SubjectService');
  });

  it('keeps the diagnostic wording when somebody is signed in without a tenant', () => {
    const error = new TenantUnavailableError('GradeService', 'unresolved');

    expect(error.message).toContain('no tenant resolved');
  });

  it('survives an instanceof check across the prototype fix-up', () => {
    // `Object.setPrototypeOf` in the constructor is what makes this hold when
    // the class is transpiled; without it the handler's check silently fails.
    expect(new TenantUnavailableError('X', 'signed-out') instanceof TenantUnavailableError).toBe(true);
    expect(new TenantUnavailableError('X', 'signed-out') instanceof Error).toBe(true);
  });
});
