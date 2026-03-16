/**
 * Metrics JSON API
 * 
 * JSON 형식의 메트릭 노출 (디버깅용)
 * 
 * @endpoint GET /api/metrics/json
 */

import { NextResponse } from 'next/server';
import { metrics } from '@/lib/observability/metrics';
import { logger } from '@/lib/observability/logger';

/**
 * 권한 확인
 */
function isAuthorized(request: Request): boolean {
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
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

  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.METRICS_TOKEN;
  
  if (expectedToken && authHeader) {
    const token = authHeader.replace('Bearer ', '');
    return token === expectedToken;
  }

  return false;
}

/**
 * GET /api/metrics/json
 * 
 * JSON 형식 메트릭 반환
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (!metrics.isEnabled()) {
      return NextResponse.json(
        { error: 'Metrics collection is disabled' },
        { status: 503 }
      );
    }

    const metricsData = metrics.toJSON();

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      metrics: metricsData,
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    logger.error(
      'Failed to export metrics as JSON',
      error instanceof Error ? error : new Error(String(error))
    );

    return NextResponse.json(
      { error: 'Failed to export metrics' },
      { status: 500 }
    );
  }
}
