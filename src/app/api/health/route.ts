/**
 * Health Check API
 * 
 * 시스템 상태 및 DB 연결 상태 확인
 * 
 * @endpoint GET /api/health
 * @endpoint GET /api/health?detailed=true
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/observability/logger';
import { isEnabled } from '@/lib/config/feature_flags';
import { getDatabaseProvider, initializeDatabaseProvider, createDatabaseProviderFromEnv } from '@/lib/database/provider';
import type { DatabaseProvider } from '@/lib/database/provider';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  environment: string;
  checks: {
    database: {
      status: 'healthy' | 'unhealthy';
      responseTime: number;
      message?: string;
    };
    memory: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      usedMB: number;
      totalMB: number;
      percentage: number;
    };
    uptime: {
      status: 'healthy';
      seconds: number;
    };
  };
}

interface ProviderHealthCheck {
  status: 'healthy' | 'unhealthy';
  responseTime: number;
  provider?: string;
  message?: string;
}

const START_TIME = Date.now();

// ============================================================================
// Legacy Implementation (기존 코드 100% 유지)
// ============================================================================

/**
 * 데이터베이스 연결 확인 (Legacy)
 */
async function checkDatabase(): Promise<HealthStatus['checks']['database']> {
  const start = Date.now();
  
  try {
    const supabase = await createClient();
    
    // 간단한 쿼리로 연결 확인
    const { error } = await supabase
      .from('translations')
      .select('id')
      .limit(1);

    const responseTime = Date.now() - start;

    if (error) {
      logger.error('Health check: Database connection failed', error, {
        responseTime,
      });
      return {
        status: 'unhealthy',
        responseTime,
        message: error.message,
      };
    }

    return {
      status: 'healthy',
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - start;
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error(
      'Health check: Database check failed',
      error instanceof Error ? error : new Error(String(error)),
      { responseTime }
    );
    
    return {
      status: 'unhealthy',
      responseTime,
      message,
    };
  }
}

/**
 * 메모리 사용량 확인 (Legacy)
 */
function checkMemory(): HealthStatus['checks']['memory'] {
  const usage = process.memoryUsage();
  const usedMB = Math.round(usage.heapUsed / 1024 / 1024);
  const totalMB = Math.round(usage.heapTotal / 1024 / 1024);
  const percentage = Math.round((usage.heapUsed / usage.heapTotal) * 100);

  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (percentage > 90) {
    status = 'unhealthy';
  } else if (percentage > 75) {
    status = 'degraded';
  }

  return {
    status,
    usedMB,
    totalMB,
    percentage,
  };
}

/**
 * 업타임 확인 (Legacy)
 */
function checkUptime(): HealthStatus['checks']['uptime'] {
  return {
    status: 'healthy',
    seconds: Math.floor((Date.now() - START_TIME) / 1000),
  };
}

/**
 * 전체 상태 계산 (Legacy)
 */
function calculateOverallStatus(checks: HealthStatus['checks']): HealthStatus['status'] {
  const statuses = [
    checks.database.status,
    checks.memory.status,
    checks.uptime.status,
  ];

  if (statuses.includes('unhealthy')) {
    return 'unhealthy';
  }
  if (statuses.includes('degraded')) {
    return 'degraded';
  }
  return 'healthy';
}

/**
 * Legacy 핸들러 (기존 구현 그대로 유지)
 */
async function handleLegacy(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const detailed = searchParams.get('detailed') === 'true';

  try {
    // 병렬로 모든 체크 수행
    const [dbCheck, memoryCheck, uptimeCheck] = await Promise.all([
      checkDatabase(),
      Promise.resolve(checkMemory()),
      Promise.resolve(checkUptime()),
    ]);

    const checks = {
      database: dbCheck,
      memory: memoryCheck,
      uptime: uptimeCheck,
    };

    const status = calculateOverallStatus(checks);
    
    const health: HealthStatus = {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      environment: process.env.NODE_ENV || 'development',
      checks,
    };

    // 상태에 따른 HTTP 상태 코드
    const statusCode = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;
    
    // 간단한 응답 (기본)
    if (!detailed) {
      return NextResponse.json(
        { status: health.status, timestamp: health.timestamp },
        { 
          status: statusCode,
          headers: {
            'x-provider-type': 'legacy',
          }
        }
      );
    }

    // 상세 응답
    return NextResponse.json(health, { 
      status: statusCode,
      headers: {
        'x-provider-type': 'legacy',
      }
    });
  } catch (error) {
    logger.error(
      'Health check failed (legacy)',
      error instanceof Error ? error : new Error(String(error))
    );

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      },
      { 
        status: 503,
        headers: {
          'x-provider-type': 'legacy',
        }
      }
    );
  }
}

// ============================================================================
// Provider-based Implementation (새로운 구현)
// ============================================================================

/**
 * Provider 초기화 (필요한 경우)
 */
async function initializeProviderIfNeeded(): Promise<DatabaseProvider | null> {
  try {
    // 이미 초기화된 경우
    if (getDatabaseProvider) {
      try {
        return getDatabaseProvider();
      } catch {
        // 초기화되지 않은 경우 계속 진행
      }
    }

    // Supabase 클라이언트로 초기화
    const supabase = await createClient();
    return createDatabaseProviderFromEnv(supabase);
  } catch (error) {
    logger.error('Failed to initialize database provider', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Provider 기반 헬스체크
 */
async function checkProviderHealth(provider: DatabaseProvider): Promise<ProviderHealthCheck> {
  const start = Date.now();
  
  try {
    // Provider를 통한 데이터베이스 헬스체크
    const result = await provider.translations.findMany({}, { limit: 1 });
    
    return {
      status: 'healthy',
      responseTime: Date.now() - start,
      provider: provider.type,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Provider health check failed', error instanceof Error ? error : new Error(String(error)));
    
    return {
      status: 'unhealthy',
      responseTime: Date.now() - start,
      provider: provider.type,
      message,
    };
  }
}

/**
 * Provider 기반 핸들러
 */
async function handleWithProvider(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const detailed = searchParams.get('detailed') === 'true';

  try {
    // Provider 초기화
    const provider = await initializeProviderIfNeeded();
    
    if (!provider) {
      logger.warn('Provider initialization failed, falling back to legacy');
      return handleLegacy(request);
    }

    // Provider 기반 헬스체크
    const dbCheck = await checkProviderHealth(provider);
    const memoryCheck = checkMemory();
    const uptimeCheck = checkUptime();

    const checks = {
      database: {
        status: dbCheck.status,
        responseTime: dbCheck.responseTime,
        message: dbCheck.message,
      },
      memory: memoryCheck,
      uptime: uptimeCheck,
    };

    const status = calculateOverallStatus(checks);
    
    const health: HealthStatus = {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      environment: process.env.NODE_ENV || 'development',
      checks,
    };

    // 상태에 따른 HTTP 상태 코드
    const statusCode = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;
    
    // 로깅
    logger.info('Health check completed (provider)', {
      provider: provider.type,
      status: health.status,
      responseTime: dbCheck.responseTime,
    });

    // 응답 생성
    const responseBody = detailed ? health : { 
      status: health.status, 
      timestamp: health.timestamp,
      provider: provider.type,
    };

    return NextResponse.json(responseBody, {
      status: statusCode,
      headers: {
        'x-provider-type': provider.type,
      },
    });
    
  } catch (error) {
    // 🚨 Provider 실패 시 자동 Fallback
    logger.error(
      'Provider health check failed, falling back to legacy',
      error instanceof Error ? error : new Error(String(error))
    );
    
    return handleLegacy(request);
  }
}

// ============================================================================
// API Routes
// ============================================================================

/**
 * GET /api/health
 * 
 * Feature Flag에 따라 Provider 패턴 또는 Legacy 방식으로 헬스체크 수행
 */
export async function GET(request: Request) {
  const useNewProvider = isEnabled('FF_PILOT_HEALTH_API');
  
  // 로깅: 플래그 상태
  logger.info('Health check requested', {
    useNewProvider,
    flagValue: process.env.FF_PILOT_HEALTH_API,
    url: request.url,
  });
  
  if (useNewProvider) {
    return handleWithProvider(request);
  }
  
  // 기존 코드 그대로 유지 (Fallback)
  return handleLegacy(request);
}

/**
 * HEAD /api/health
 * 
 * 부하 분산용 헬스체크 (본문 없음)
 */
export async function HEAD() {
  const useNewProvider = isEnabled('FF_PILOT_HEALTH_API');
  
  if (useNewProvider) {
    try {
      const provider = await initializeProviderIfNeeded();
      
      if (!provider) {
        return new NextResponse(null, { 
          status: 503,
          headers: {
            'x-provider-type': 'legacy',
          }
        });
      }
      
      const result = await provider.translations.findMany({}, { limit: 1 });
      
      return new NextResponse(null, { 
        status: 200,
        headers: {
          'x-provider-type': provider.type,
        }
      });
    } catch {
      // Fallback to legacy
      try {
        const supabase = await createClient();
        const { error } = await supabase.from('translations').select('id').limit(1);

        if (error) {
          return new NextResponse(null, { 
            status: 503,
            headers: {
              'x-provider-type': 'legacy',
            }
          });
        }

        return new NextResponse(null, { 
          status: 200,
          headers: {
            'x-provider-type': 'legacy',
          }
        });
      } catch {
        return new NextResponse(null, { 
          status: 503,
          headers: {
            'x-provider-type': 'legacy',
          }
        });
      }
    }
  }
  
  // Legacy HEAD implementation
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('translations').select('id').limit(1);

    if (error) {
      return new NextResponse(null, { 
        status: 503,
        headers: {
          'x-provider-type': 'legacy',
        }
      });
    }

    return new NextResponse(null, { 
      status: 200,
      headers: {
        'x-provider-type': 'legacy',
      }
    });
  } catch {
    return new NextResponse(null, { 
      status: 503,
      headers: {
        'x-provider-type': 'legacy',
      }
    });
  }
}
