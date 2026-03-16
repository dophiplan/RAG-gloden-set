/**
 * Observability Example API
 * 
 * Observability 시스템 사용 예시
 * 
 * @endpoint GET /api/observability-example
 * @endpoint POST /api/observability-example
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  withApiInstrumentation,
  logger,
  metrics,
  getContextLogger,
} from '@/lib/observability';

// GET 핸들러 - 기본 예시
async function handleGet(request: NextRequest) {
  const requestLogger = getContextLogger('ExampleEndpoint');
  
  // 로깅 예시
  requestLogger.info('Processing GET request');
  
  // 비즈니스 메트릭 예시
  metrics.recordTranslationCreated(1, 'example');
  
  // 느린 작업 시뮬레이션
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return NextResponse.json({
    message: 'GET request processed',
    timestamp: new Date().toISOString(),
  });
}

// POST 핸들러 - 에러 처리 예시
async function handlePost(request: NextRequest) {
  const requestLogger = getContextLogger('ExampleEndpoint');
  
  try {
    const body = await request.json();
    requestLogger.info('Processing POST request', { body });
    
    // 용어집 히트 메트릭 예시
    if (body.useGlossary) {
      metrics.recordGlossaryHit(1);
    }
    
    // AI 번역 메트릭 예시
    metrics.recordAiTranslation('anthropic', true);
    
    return NextResponse.json({
      message: 'POST request processed',
      data: body,
    });
  } catch (error) {
    requestLogger.error('Failed to process POST request', error as Error);
    
    // 에러 메트릭 기록
    metrics.recordError('validation', 'ExampleEndpoint');
    
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

// 자동 계측된 핸들러 낳출
export const GET = withApiInstrumentation(handleGet, {
  component: 'ObservabilityExample',
});

export const POST = withApiInstrumentation(handlePost, {
  component: 'ObservabilityExample',
  recordMetrics: (data, duration) => {
    // 커스텀 메트릭 기록
    logger.debug('Custom metrics recorded', { data, duration });
  },
});
