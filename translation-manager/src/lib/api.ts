/**
 * Typed fetch wrappers to reduce boilerplate in API calls.
 * Handles JSON parsing, error extraction, and Content-Type headers.
 */

interface ApiResponse<T> {
  ok: boolean;
  data: T;
  status: number;
}

interface ApiError {
  ok: false;
  error: string;
  status: number;
}

type ApiResult<T> = ApiResponse<T> | ApiError;

async function handleResponse<T>(response: Response): Promise<ApiResult<T>> {
  const data = await response.json();
  if (!response.ok) {
    return {
      ok: false,
      error: data.error || `Request failed with status ${response.status}`,
      status: response.status,
    };
  }
  return { ok: true, data: data as T, status: response.status };
}

export async function apiFetch<T>(url: string): Promise<ApiResult<T>> {
  const response = await fetch(url);
  return handleResponse<T>(response);
}

export async function apiPost<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(response);
}

export async function apiPatch<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(response);
}

export async function apiDelete<T>(url: string): Promise<ApiResult<T>> {
  const response = await fetch(url, {
    method: 'DELETE',
  });
  return handleResponse<T>(response);
}
