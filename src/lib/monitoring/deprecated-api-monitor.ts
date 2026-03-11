/**
 * Deprecated API Monitoring
 * 
 * 2026-06-11 제거 예정인 API들의 사용량을 모니터링
 */

import { NextRequest } from 'next/server';

// 모니터링 대상 Deprecated API 목록
export const DEPRECATED_APIS = [
  { path: '/api/translations/bulk', method: 'POST', alternative: '/api/bulk?type=translations&action=create' },
  { path: '/api/translations/bulk-update', method: 'PATCH', alternative: '/api/bulk?type=translations&action=update' },
  { path: '/api/translations/bulk-delete', method: 'DELETE', alternative: '/api/bulk?type=translations&action=delete' },
  { path: '/api/glossary/bulk', method: 'POST', alternative: '/api/bulk?type=glossary&action=create' },
  { path: '/api/glossary/bulk-update', method: 'PATCH', alternative: '/api/bulk?type=glossary&action=update' },
  { path: '/api/glossary/bulk-revert', method: 'POST', alternative: '/api/bulk?type=glossary&action=revert' },
  { path: '/api/glossary/revert', method: 'POST', alternative: '/api/rollback' },
  { path: '/api/rollback/execute', method: 'POST', alternative: '/api/rollback' },
  { path: '/api/rollback/batch', method: 'POST', alternative: '/api/rollback' },
  { path: '/api/rollback/batch-by-date', method: 'POST', alternative: '/api/rollback' },
  { path: '/api/rollback/check', method: 'POST', alternative: '/api/rollback (GET)' },
  { path: '/api/translations/[id]/revert', method: 'POST', alternative: '/api/rollback' },
  { path: '/api/admin/users/bulk-update', method: 'PATCH', alternative: '/api/bulk?type=admin-users&action=update' },
  { path: '/api/admin/users/bulk-delete', method: 'POST', alternative: '/api/bulk?type=admin-users&action=delete' },
];

interface DeprecatedAPICall {
  path: string;
  method: string;
  timestamp: string;
  userAgent?: string;
  referer?: string;
}

// 메모리에 로그 저장
const callLogs: DeprecatedAPICall[] = [];
const MAX_LOGS = 10000;

/**
 * Deprecated API 호출 로깅
 */
export function logDeprecatedAPICall(request: NextRequest, path: string): void {
  const call: DeprecatedAPICall = {
    path,
    method: request.method,
    timestamp: new Date().toISOString(),
    userAgent: request.headers.get('user-agent') || undefined,
    referer: request.headers.get('referer') || undefined,
  };

  callLogs.push(call);

  if (callLogs.length > MAX_LOGS) {
    callLogs.shift();
  }

  console.warn(
    `[DEPRECATED API] ${request.method} ${path} called at ${call.timestamp}\n` +
    `This API will be removed on 2026-06-11. Migrate to unified API.\n` +
    `Referer: ${call.referer || 'unknown'}`
  );
}

/**
 * Deprecated API 여부 확인
 */
export function isDeprecatedAPI(path: string): boolean {
  return DEPRECATED_APIS.some(api => {
    if (api.path.includes('[id]')) {
      const pattern = api.path.replace(/\[id\]/g, '[^/]+');
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(path);
    }
    return api.path === path;
  });
}

/**
 * 모니터링 통계 조회
 */
export function getDeprecatedAPIStats(): {
  totalCalls: number;
  callsByEndpoint: Record<string, number>;
  callsByDate: Record<string, number>;
  last24Hours: number;
} {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const callsByEndpoint: Record<string, number> = {};
  const callsByDate: Record<string, number> = {};
  let last24HoursCount = 0;

  for (const call of callLogs) {
    callsByEndpoint[call.path] = (callsByEndpoint[call.path] || 0) + 1;

    const date = call.timestamp.split('T')[0];
    callsByDate[date] = (callsByDate[date] || 0) + 1;

    if (new Date(call.timestamp) >= last24h) {
      last24HoursCount++;
    }
  }

  return {
    totalCalls: callLogs.length,
    callsByEndpoint,
    callsByDate,
    last24Hours: last24HoursCount,
  };
}

/**
 * 주간 리포트 생성
 */
export function generateWeeklyReport(): string {
  const stats = getDeprecatedAPIStats();
  const removalDate = new Date('2026-06-11');
  const daysRemaining = Math.ceil((removalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  let report = '# Deprecated API Usage Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n`;
  report += `Removal Date: 2026-06-11 (D-${daysRemaining})\n\n`;

  report += '## Summary\n';
  report += `- Total Calls: ${stats.totalCalls}\n`;
  report += `- Last 24 Hours: ${stats.last24Hours}\n\n`;

  report += '## Calls by Endpoint (Top 10)\n';
  const sortedEndpoints = Object.entries(stats.callsByEndpoint)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  for (const [endpoint, count] of sortedEndpoints) {
    report += `- ${endpoint}: ${count} calls\n`;
  }

  return report;
}

/**
 * 실시간 알림 체크
 */
export function checkAlertThreshold(): { alert: boolean; message?: string } {
  const stats = getDeprecatedAPIStats();

  if (stats.last24Hours >= 10) {
    return {
      alert: true,
      message: `⚠️ Deprecated API called ${stats.last24Hours} times in last 24h`,
    };
  }

  return { alert: false };
}
