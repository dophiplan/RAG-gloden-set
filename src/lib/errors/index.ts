/**
 * Standardized Error Classes
 * Provides consistent error handling across the application
 */

/**
 * Base API Error
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      details: this.details,
    };
  }
}

/**
 * Validation Error (400)
 * Thrown when request validation fails
 */
export class ValidationError extends ApiError {
  constructor(message: string = '잘못된 요청입니다.', details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Authentication Error (401)
 * Thrown when authentication is required or fails
 */
export class AuthenticationError extends ApiError {
  constructor(message: string = '인증이 필요합니다.') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Authorization Error (403)
 * Thrown when user doesn't have permission
 */
export class AuthorizationError extends ApiError {
  constructor(message: string = '권한이 없습니다.') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

/**
 * Not Found Error (404)
 * Thrown when a resource is not found
 */
export class NotFoundError extends ApiError {
  constructor(resource: string = '리소스') {
    super(`${resource}를 찾을 수 없습니다.`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Conflict Error (409)
 * Thrown when there's a conflict (e.g., duplicate entry)
 */
export class ConflictError extends ApiError {
  constructor(message: string = '중복된 데이터가 존재합니다.') {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

/**
 * Rate Limit Error (429)
 * Thrown when rate limit is exceeded
 */
export class RateLimitError extends ApiError {
  constructor(message: string = '요청 횟수 제한을 초과했습니다.') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Database Error (500)
 * Thrown when database operations fail
 */
export class DatabaseError extends ApiError {
  constructor(message: string = '데이터베이스 오류가 발생했습니다.', details?: unknown) {
    super(message, 500, 'DATABASE_ERROR', details);
    this.name = 'DatabaseError';
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

/**
 * External Service Error (502)
 * Thrown when external service (like OpenAI, Anthropic) fails
 */
export class ExternalServiceError extends ApiError {
  constructor(
    service: string,
    message: string = '외부 서비스 오류가 발생했습니다.',
    details?: unknown
  ) {
    super(`${service}: ${message}`, 502, 'EXTERNAL_SERVICE_ERROR', details);
    this.name = 'ExternalServiceError';
    Object.setPrototypeOf(this, ExternalServiceError.prototype);
  }
}

/**
 * Repository Error (500)
 * Thrown when repository operations fail
 */
export class RepositoryError extends ApiError {
  constructor(message: string = 'Repository operation failed.', details?: unknown) {
    super(message, 500, 'REPOSITORY_ERROR', details);
    this.name = 'RepositoryError';
    Object.setPrototypeOf(this, RepositoryError.prototype);
  }
}

/**
 * Check if error is an instance of ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Format error for API response
 */
export function formatError(error: unknown): {
  error: string;
  code?: string;
  details?: unknown;
  statusCode: number;
} {
  if (isApiError(error)) {
    return {
      error: error.message,
      code: error.code,
      details: error.details,
      statusCode: error.statusCode,
    };
  }

  // Unknown error
  return {
    error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
    code: 'UNKNOWN_ERROR',
    statusCode: 500,
  };
}
