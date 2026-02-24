/**
 * API 응답 정규화 유틸리티
 * 
 * 모든 API 응답은 { data: T, success: boolean, message?: string } 형태를 따릅니다.
 * 이 유틸리티는 다양한 응답 형태를 자동으로 처리합니다.
 */

// API 응답의 기본 구조
export interface ApiResponse<T = unknown> {
  data?: T;
  success?: boolean;
  message?: string;
  error?: string;
  // 기타 필드들 (하위 호환성)
  [key: string]: unknown;
}

// 표준화된 API 결과
export interface ApiResult<T> {
  data: T;
  success: boolean;
  message?: string;
}

/**
 * API 응답을 파싱하여 표준화된 형태로 반환
 * 
 * 지원하는 응답 형태:
 * 1. { data: { items: [...] } } → { items: [...] }
 * 2. { data: { products: [...] } } → { products: [...] }
 * 3. { data: { requests: [...] } } → { requests: [...] }
 * 4. { items: [...] } → { items: [...] } (레거시)
 */
export async function parseApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as ApiResponse;
    const errorMessage = errorData.error || errorData.message || `HTTP ${response.status}`;
    throw new ApiError(errorMessage, response.status, errorData);
  }

  const result = await response.json() as ApiResponse<T>;
  
  // { data: T } 형태면 data를 추출, 아니면 전체를 반환
  return result.data ?? result as T;
}

/**
 * 특정 필드가 있는 API 응답 파싱 (예: requests, products)
 */
export async function parseApiResponseWithField<T>(
  response: Response, 
  fieldName: string
): Promise<T[]> {
  const data = await parseApiResponse<Record<string, unknown>>(response);
  
  // 1. data.fieldName (표준)
  if (data && typeof data === 'object' && fieldName in data) {
    const field = data[fieldName];
    return Array.isArray(field) ? (field as T[]) : [];
  }
  
  // 2. data가 직접 배열인 경우
  if (Array.isArray(data)) {
    return data as T[];
  }
  
  return [];
}

/**
 * API 호출용 fetch 래퍼
 * 
 * 사용법:
 * const products = await apiFetch('/api/products');
 * const requests = await apiFetch('/api/dashboard/requests', { field: 'requests' });
 */
interface ApiFetchOptions extends RequestInit {
  field?: string; // 응답에서 추출할 필드명 (예: 'requests', 'products')
}

export async function apiFetch<T>(
  url: string, 
  options: ApiFetchOptions = {}
): Promise<T> {
  const { field, ...fetchOptions } = options;
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...fetchOptions,
  });

  if (field) {
    return parseApiResponseWithField(response, field) as Promise<T>;
  }
  
  return parseApiResponse(response);
}

/**
 * API Error 클래스
 */
export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * POST 요청 헬퍼
 */
export async function apiPost<T>(
  url: string, 
  body: unknown
): Promise<T> {
  return apiFetch<T>(url, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * PATCH 요청 헬퍼
 */
export async function apiPatch<T>(
  url: string, 
  body: unknown
): Promise<T> {
  return apiFetch<T>(url, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/**
 * DELETE 요청 헬퍼
 */
export async function apiDelete<T>(url: string): Promise<T> {
  return apiFetch<T>(url, { method: 'DELETE' });
}

/**
 * 쿼리 파라미터를 포함한 GET 요청
 */
export async function apiGet<T>(
  url: string, 
  params?: Record<string, string | number | undefined>
): Promise<T> {
  const urlWithParams = params
    ? `${url}?${new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      )}`
    : url;
  
  return apiFetch<T>(urlWithParams);
}

/**
 * 배열 필드를 안전하게 추출하는 헬퍼
 */
export function extractArrayField<T>(
  data: unknown, 
  fieldName: string, 
  fallback: T[] = []
): T[] {
  if (!data || typeof data !== 'object') return fallback;
  const record = data as Record<string, unknown>;
  const field = record[fieldName];
  return Array.isArray(field) ? (field as T[]) : fallback;
}
