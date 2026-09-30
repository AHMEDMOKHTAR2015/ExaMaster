/**
 * A failed request, as every service reports it. `code` is the HTTP status as
 * text ('404', '409', …), or 'unavailable' / 'unknown'; `message` is the API's
 * own wording when it gave one (it words its refusals for people), else a
 * generic one for the status (`SERVICE_ERROR_MESSAGES`).
 */
export const SERVICE_ERROR_MESSAGES: Record<string, string> = {
  '400': 'Bad request. Please check your input.',
  '401': 'Unauthorized. Please sign in.',
  '403': 'Access forbidden. You do not have permission.',
  '404': 'Resource not found.',
  '408': 'Request timeout. Please try again.',
  '409': 'This conflicts with something that already exists.',
  '429': 'Too many requests. Please try again later.',
  '500': 'Server error. Please try again later.',
  '502': 'Bad gateway. Please try again later.',
  '503': 'Service unavailable. Please try again later.',
  '504': 'Gateway timeout. Please try again later.',
  'timeout': 'Operation timed out. Please try again.',
  'unknown': 'An unexpected error occurred. Please try again.'
};

export class ServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'ServiceError';
    Object.setPrototypeOf(this, ServiceError.prototype);
  }

  static fromHttpError(error: unknown): ServiceError {
    const err = error as { status?: number; message?: string };
    const status = String(err?.status || 'unknown');
    const message = SERVICE_ERROR_MESSAGES[status] || err?.message || 'An unexpected error occurred.';
    return new ServiceError(status, message, error);
  }

  static fromMessage(message: string): ServiceError {
    return new ServiceError(message, SERVICE_ERROR_MESSAGES[message] || message);
  }
}
