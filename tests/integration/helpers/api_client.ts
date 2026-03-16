/**
 * API Client for Integration Tests
 * 
 * Next.js Route Handlers를 직접 호출하여 API 테스트 수행
 * 실제 HTTP 서버 없이도 API 로직을 테스트할 수 있음
 */

import { NextRequest, NextResponse } from 'next/server';
import type { SqliteDatabase } from '@/lib/database/sqlite';

// ============================================================================
// Types
// ============================================================================

export interface ApiRequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
}

export interface ApiResponse<T = unknown> {
  status: number;
  data: T;
  headers: Headers;
}

export interface MockNextRequestOptions {
  method?: string;
  url?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

// ============================================================================
// Mock NextRequest Creator
// ============================================================================

/**
 * NextRequest 목 객체 생성
 */
export function createMockNextRequest(options: MockNextRequestOptions = {}): NextRequest {
  const {
    method = 'GET',
    url = 'http://localhost:3000/api/test',
    body,
    headers = {},
  } = options;

  // Create URL with query params
  const urlObj = new URL(url);
  
  // Create request init
  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body && method !== 'GET') {
    init.body = JSON.stringify(body);
  }

  return new NextRequest(urlObj, init);
}

/**
 * NextResponse 데이터 추출
 */
export async function parseNextResponse<T>(response: NextResponse): Promise<ApiResponse<T>> {
  const data = await response.json();
  return {
    status: response.status,
    data,
    headers: response.headers,
  };
}

// ============================================================================
// Route Handler Test Helpers
// ============================================================================

export type RouteHandler = (request: NextRequest, context?: { params: Record<string, string> }) => Promise<NextResponse>;

/**
 * Route Handler 호출 헬퍼
 */
export async function callRouteHandler<T>(
  handler: RouteHandler,
  options: MockNextRequestOptions & { params?: Record<string, string> } = {}
): Promise<ApiResponse<T>> {
  const request = createMockNextRequest(options);
  const context = options.params ? { params: options.params } : undefined;
  
  const response = await handler(request, context);
  return parseNextResponse<T>(response);
}

/**
 * GET 요청 테스트
 */
export async function testGet<T>(
  handler: RouteHandler,
  url: string,
  headers?: Record<string, string>
): Promise<ApiResponse<T>> {
  return callRouteHandler<T>(handler, { method: 'GET', url, headers });
}

/**
 * POST 요청 테스트
 */
export async function testPost<T>(
  handler: RouteHandler,
  url: string,
  body: unknown,
  headers?: Record<string, string>
): Promise<ApiResponse<T>> {
  return callRouteHandler<T>(handler, { method: 'POST', url, body, headers });
}

/**
 * PUT 요청 테스트
 */
export async function testPut<T>(
  handler: RouteHandler,
  url: string,
  body: unknown,
  headers?: Record<string, string>
): Promise<ApiResponse<T>> {
  return callRouteHandler<T>(handler, { method: 'PUT', url, body, headers });
}

/**
 * PATCH 요청 테스트
 */
export async function testPatch<T>(
  handler: RouteHandler,
  url: string,
  body: unknown,
  headers?: Record<string, string>
): Promise<ApiResponse<T>> {
  return callRouteHandler<T>(handler, { method: 'PATCH', url, body, headers });
}

/**
 * DELETE 요청 테스트
 */
export async function testDelete<T>(
  handler: RouteHandler,
  url: string,
  headers?: Record<string, string>
): Promise<ApiResponse<T>> {
  return callRouteHandler<T>(handler, { method: 'DELETE', url, headers });
}

// ============================================================================
// Database Context for API Tests
// ============================================================================

/**
 * API 테스트용 데이터베이스 컨텍스트
 * Route Handlers에 주입하여 사용
 */
export interface TestApiContext {
  db: SqliteDatabase;
  userId?: string;
  userRole?: string;
}

/**
 * 인증 헤더 생성
 */
export function createAuthHeaders(userId: string, role: string = 'user'): Record<string, string> {
  // Base64 encoded user info (mock JWT)
  const userInfo = Buffer.from(JSON.stringify({ sub: userId, role })).toString('base64');
  return {
    'Authorization': `Bearer mock-jwt-${userInfo}`,
    'X-User-Id': userId,
    'X-User-Role': role,
  };
}

/**
 * 어드민 인증 헤더 생성
 */
export function createAdminHeaders(userId: string = 'admin-user'): Record<string, string> {
  return createAuthHeaders(userId, 'admin');
}

// ============================================================================
// Response Assertions
// ============================================================================

/**
 * 성공 응답 검증 (200-299)
 */
export function expectSuccess<T>(response: ApiResponse<T>): T {
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Expected success status, got ${response.status}: ${JSON.stringify(response.data)}`);
  }
  return response.data;
}

/**
 * 생성 응답 검증 (201)
 */
export function expectCreated<T>(response: ApiResponse<T>): T {
  if (response.status !== 201) {
    throw new Error(`Expected 201 Created, got ${response.status}: ${JSON.stringify(response.data)}`);
  }
  return response.data;
}

/**
 * 에러 응답 검증 (400-499)
 */
export function expectClientError<T>(response: ApiResponse<T>, expectedStatus?: number): T {
  if (response.status < 400 || response.status >= 500) {
    throw new Error(`Expected client error status, got ${response.status}`);
  }
  if (expectedStatus && response.status !== expectedStatus) {
    throw new Error(`Expected status ${expectedStatus}, got ${response.status}`);
  }
  return response.data;
}

/**
 * 서버 에러 검증 (500-599)
 */
export function expectServerError<T>(response: ApiResponse<T>): T {
  if (response.status < 500 || response.status >= 600) {
    throw new Error(`Expected server error status, got ${response.status}`);
  }
  return response.data;
}

// ============================================================================
// Pagination Helpers
// ============================================================================

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

/**
 * 페이지네이션 파라미터 생성
 */
export function createPaginationParams(page: number = 1, limit: number = 20): Record<string, string> {
  return {
    page: String(page),
    limit: String(limit),
  };
}

/**
 * 페이지네이션 응답 검증
 */
export function expectPaginatedResponse<T>(response: ApiResponse<PaginatedResponse<T>>): PaginatedResponse<T> {
  const data = expectSuccess(response);
  
  if (!Array.isArray(data.data)) {
    throw new Error('Expected data array in paginated response');
  }
  
  if (typeof data.count !== 'number') {
    throw new Error('Expected count number in paginated response');
  }
  
  return data;
}
