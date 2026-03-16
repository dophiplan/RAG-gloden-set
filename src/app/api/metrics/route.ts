/**
 * Metrics API
 * 
 * Prometheus 형식의 메트릭 노출
 * 
 * @endpoint GET /api/metrics
 */

import { NextResponse } from 'next/server';
import { metrics } from '@/lib/observability/metrics';
import { logger } from '@/lib/observability/logger';

/**
 * 메트릭 엔드포인트 접근 권한 확인
 * 
 * 낶부 네트워크 또는 특정 토큰으로 접근 제한
 */
function isAuthorized(request: Request): boolean {
  // 로컬 개발 환경은 항상 허용
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  // 낶부 네트워크 확인 (Vercel 등의 환경)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // 낶부 IP 범위 확인 (10.x, 172.16-31.x, 192.168.x)
    const ip = forwardedFor.split(',')[0].trim();
    if (
      ip.startsWith('10.') ||
      ip.startsWith('192.168.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) ||
      ip === '127.0.0.1'
    ) {
      return true;
    }
  }

  // 메트릭 토큰 확인
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.METRICS_TOKEN;
  
  if (expectedToken && authHeader) {
    const token = authHeader.replace('Bearer ', '');
    return token === expectedToken;
  }

  return false;
}

/**
 * GET /api/metrics
 * 
 * Prometheus 형식 메트릭 반환
 */
export async function GET(request: Request) {
  // 권한 확인
  if (!isAuthorized(request)) {
    logger.warn('Unauthorized metrics access attempt', {
      userAgent: request.headers.get('user-agent')?.substring(0, 100),
      forwardedFor: request.headers.get('x-forwarded-for'),
    });

    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // 메트릭 수집이 비활성화된 경우
    if (!metrics.isEnabled()) {
      return NextResponse.json(
        { error: 'Metrics collection is disabled' },
        { status: 503 }
      );
    }

    // Prometheus 형식으로 메트릭 낳은내기
    const prometheusMetrics = metrics.toPrometheusFormat();

    // Prometheus가 파싱할 수 있는 Content-Type
    return new NextResponse(prometheusMetrics, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    logger.error(
      'Failed to export metrics',
      error instanceof Error ? error : new Error(String(error))
    );

    return NextResponse.json(
      { error: 'Failed to export metrics' },
      { status: 500 }
    );
  }
}

/**
 * 추가 메트릭 정보
 * 
 * @endpoint GET /api/metrics/info
 */
export async function GET_info(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    enabled: metrics.isEnabled(),
    format: 'prometheus',
    endpoints: {
      prometheus: '/api/metrics',
      json: '/api/metrics/json',
    },
    documentation: 'https://prometheus.io/docs/instrumenting/exposition_formats/',
  });
}
