/**
 * API 유틸리티 사용 예시
 * 
 * 기존 코드 → 새 코드 변환 가이드
 */

import { 
  apiFetch, 
  apiGet, 
  apiPost, 
  apiPatch, 
  apiDelete,
  extractArrayField 
} from './api-utils';
import type { DashboardRequest } from '@/types/translations';

// ========================================
// 예시 1: 단순 GET 요청 (제품 목록)
// ========================================

// ❌ 기존 코드 (문제 발생)
async function fetchProductsOld() {
  const response = await fetch('/api/products');
  const data = await response.json();
  return data.products; // API 변경 시 undefined 오류!
}

// ✅ 새 코드 (안전)
async function fetchProductsNew() {
  const data = await apiFetch<{ products: Product[] }>('/api/products');
  return data.products || [];
}

// ========================================
// 예시 2: 필드가 명확한 경우 (requests)
// ========================================

// ❌ 기존 코드 (문제 발생)
async function fetchRequestsOld() {
  const response = await fetch('/api/dashboard/requests');
  const data = await response.json();
  return data.requests?.filter((r: DashboardRequest) => r) || []; // undefined 오류!
}

// ✅ 새 코드 (안전)
async function fetchRequestsNew() {
  const requests = await apiFetch<DashboardRequest[]>('/api/dashboard/requests');
  // 또는 필드 명시
  const data = await apiFetch<{ requests: DashboardRequest[] }>('/api/dashboard/requests');
  return extractArrayField(data, 'requests');
}

// ========================================
// 예시 3: 쿼리 파라미터가 있는 경우
// ========================================

// ❌ 기존 코드
async function fetchStatsOld(startDate: string, endDate: string) {
  const params = new URLSearchParams();
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);
  
  const res = await fetch(`/api/dashboard/stats?${params}`);
  const data = await res.json();
  return data; // 구조 불확실
}

// ✅ 새 코드
interface DashboardStats {
  total: number;
  pending: number;
  in_progress: number;
  reviewed: number;
  deployed: number;
}

async function fetchStatsNew(startDate: string, endDate: string) {
  return apiGet<DashboardStats>('/api/dashboard/stats', {
    start_date: startDate,
    end_date: endDate,
  });
}

// ========================================
// 예시 4: POST 요청
// ========================================

// ❌ 기존 코드
async function createProductOld(productData: unknown) {
  const response = await fetch('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(productData),
  });
  return response.json();
}

// ✅ 새 코드
async function createProductNew(productData: unknown) {
  return apiPost('/api/products', productData);
}

// ========================================
// 예시 5: useEffect 내에서 사용
// ========================================

// ❌ 기존 코드 (translations/[product]/page.tsx)
useEffect(() => {
  async function fetchRequests() {
    try {
      const response = await fetch('/api/dashboard/requests');
      if (response.ok) {
        const result = await response.json();
        const requestsData = result.data?.requests || result.requests || []; // 복잡!
        setRequests(requestsData);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }
  fetchRequests();
}, []);

// ✅ 새 코드
useEffect(() => {
  async function fetchRequests() {
    try {
      const data = await apiFetch<{ requests: DashboardRequest[] }>('/api/dashboard/requests');
      setRequests(data.requests || []);
    } catch (error) {
      console.error('Error:', error);
    }
  }
  fetchRequests();
}, []);

// ========================================
// 예시 6: 에러 핸들링
// ========================================

import { ApiError } from './api-utils';

async function handleApiCall() {
  try {
    const data = await apiFetch('/api/something');
    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      // HTTP 에러 (401, 403, 500 등)
      console.error(`API Error ${error.status}:`, error.message);
      
      if (error.status === 401) {
        // 인증 필요
        redirectToLogin();
      }
    } else {
      // 네트워크 에러 등
      console.error('Network Error:', error);
    }
    throw error;
  }
}

function redirectToLogin() {
  window.location.href = '/login';
}

// 타입 정의 (예시)
interface Product {
  id: string;
  code: string;
  name: string;
}
