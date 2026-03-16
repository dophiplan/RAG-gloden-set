import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { metrics } from '@/lib/observability/metrics';
import { generateRequestId, extractContextFromRequest, logger } from '@/lib/observability/logger';

/**
 * Middleware with Observability
 * 
 * - 요청 ID 생성 및 추적
 * - API 지연 시간 측정
 * - 에러 추적
 */
export async function middleware(request: NextRequest) {
  const start = Date.now();
  const requestId = request.headers.get('x-request-id') || generateRequestId();
  
  // 요청 컨텍스트 로깅 (development 모드)
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Request started', {
      requestId,
      path: request.nextUrl.pathname,
      method: request.method,
      userAgent: request.headers.get('user-agent')?.substring(0, 100),
    });
  }

  try {
    // Allow bypassing auth in development if explicitly enabled
    if (process.env.ALLOW_AUTH_BYPASS === 'true' && process.env.NODE_ENV === 'development') {
      console.warn('⚠️  AUTH BYPASS ENABLED - Development mode only');
      const response = NextResponse.next();
      response.headers.set('x-request-id', requestId);
      return response;
    }

    // Supabase 세션 업데이트 및 인증 처리
    const response = await updateSession(request);
    
    // 요청 ID 헤더 추가 (응답 추적용)
    response.headers.set('x-request-id', requestId);
    
    // 메트릭 기록 (비동기로 처리하여 응답 지연 최소화)
    const duration = Date.now() - start;
    const statusCode = response.status;
    
    // 메트릭 비동기 기록
    metrics.recordApiLatency(
      request.nextUrl.pathname,
      request.method,
      duration,
      statusCode
    );

    // 느린 요청 경고 (개발 모드)
    if (process.env.NODE_ENV === 'development' && duration > 1000) {
      logger.warn('Slow request detected', {
        requestId,
        path: request.nextUrl.pathname,
        method: request.method,
        duration,
        statusCode,
      });
    }

    return response;
  } catch (error) {
    // 에러 메트릭 기록
    const duration = Date.now() - start;
    metrics.recordApiLatency(
      request.nextUrl.pathname,
      request.method,
      duration,
      500
    );
    metrics.recordError('middleware', 'auth');

    // 에러 로그
    logger.error(
      'Middleware error',
      error instanceof Error ? error : new Error(String(error)),
      {
        requestId,
        path: request.nextUrl.pathname,
        method: request.method,
        duration,
      }
    );

    throw error;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes (they handle their own auth)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api).*)',
  ],
};
