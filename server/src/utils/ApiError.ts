/**
 * An error with an HTTP status and a stable machine-readable code.
 *
 * Only `message` and `details` are sent to clients — stack traces are never
 * exposed (Section 31).
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code ?? ApiError.defaultCode(status);
    this.details = details;
    Error.captureStackTrace?.(this, ApiError);
  }

  private static defaultCode(status: number): string {
    switch (status) {
      case 400:
        return 'BAD_REQUEST';
      case 401:
        return 'UNAUTHORIZED';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 409:
        return 'CONFLICT';
      case 422:
        return 'VALIDATION_ERROR';
      case 429:
        return 'RATE_LIMITED';
      default:
        return 'INTERNAL_ERROR';
    }
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, message, 'BAD_REQUEST', details);
  }

  static unauthorized(message = 'You need to sign in to continue.') {
    return new ApiError(401, message, 'UNAUTHORIZED');
  }

  static forbidden(message = 'You do not have access to this resource.') {
    return new ApiError(403, message, 'FORBIDDEN');
  }

  static notFound(message = 'The requested resource was not found.') {
    return new ApiError(404, message, 'NOT_FOUND');
  }

  static conflict(message: string, details?: unknown) {
    return new ApiError(409, message, 'CONFLICT', details);
  }

  static validation(message = 'Some fields need your attention.', details?: unknown) {
    return new ApiError(422, message, 'VALIDATION_ERROR', details);
  }
}
