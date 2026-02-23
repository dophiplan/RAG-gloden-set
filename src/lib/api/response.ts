import { NextResponse } from 'next/server';

/**
 * Standardized API response utilities for consistent error and success handling
 */

interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

interface ApiSuccessResponse<T = any> {
  data: T;
  meta?: Record<string, any>;
}

/**
 * Returns a standardized error response
 * @param code - Error code for programmatic handling
 * @param message - Human-readable error message
 * @param status - HTTP status code
 * @param details - Optional additional error details
 */
export function apiError(
  code: string,
  message: string,
  status: number,
  details?: any
): NextResponse<ApiErrorResponse> {
  const body: ApiErrorResponse = {
    error: {
      code,
      message,
      ...(details !== undefined && { details }),
    },
  };
  return NextResponse.json(body, { status });
}

/**
 * Returns a standardized success response
 * @param data - Response data
 * @param meta - Optional metadata (pagination, counts, etc.)
 */
export function apiSuccess<T>(
  data: T,
  meta?: Record<string, any>
): NextResponse<ApiSuccessResponse<T>> {
  const body: ApiSuccessResponse<T> = {
    data,
    ...(meta !== undefined && { meta }),
  };
  return NextResponse.json(body);
}

/**
 * Returns a 404 Not Found response for missing resources
 * @param resource - Name of the resource that was not found
 */
export function apiNotFound(resource: string): NextResponse<ApiErrorResponse> {
  return apiError(
    'RESOURCE_NOT_FOUND',
    `${resource}을(를) 찾을 수 없습니다.`,
    404
  );
}

/**
 * Returns a 401 Unauthorized response for authentication errors
 */
export function apiUnauthorized(): NextResponse<ApiErrorResponse> {
  return apiError(
    'UNAUTHORIZED',
    '인증이 필요합니다.',
    401
  );
}

/**
 * Returns a 400 Bad Request response for validation errors
 * @param message - Error message
 * @param details - Optional validation error details
 */
export function apiBadRequest(
  message: string,
  details?: any
): NextResponse<ApiErrorResponse> {
  return apiError(
    'BAD_REQUEST',
    message,
    400,
    details
  );
}

/**
 * Returns a 500 Internal Server Error response
 * @param message - Optional custom error message
 * @param details - Optional error details
 */
export function apiInternalError(
  message?: string,
  details?: any
): NextResponse<ApiErrorResponse> {
  return apiError(
    'INTERNAL_SERVER_ERROR',
    message || '서버 낮부 오류가 발생했습니다.',
    500,
    details
  );
}

/**
 * Returns a 403 Forbidden response for permission errors
 * @param message - Optional custom error message
 */
export function apiForbidden(message?: string): NextResponse<ApiErrorResponse> {
  return apiError(
    'FORBIDDEN',
    message || '접근 권한이 없습니다.',
    403
  );
}

/**
 * Returns a 409 Conflict response for resource conflicts
 * @param message - Error message
 * @param details - Optional conflict details
 */
export function apiConflict(
  message: string,
  details?: any
): NextResponse<ApiErrorResponse> {
  return apiError(
    'CONFLICT',
    message,
    409,
    details
  );
}
