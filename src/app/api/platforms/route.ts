import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { requireAdmin, isErrorResponse } from '@/lib/api/auth-middleware';
import { platformCreateSchema, validateAndSanitize } from '@/lib/validation/schemas';
import { apiCachedSuccess, apiSuccess, apiUnauthorized, apiInternalError, apiBadRequest, apiConflict } from '@/lib/api/response';
import { isEnabled } from '@/lib/config/feature_flags';
import { getDatabaseProvider, createDatabaseProviderFromEnv, resetDatabaseProvider } from '@/lib/database/provider';
import { logger } from '@/lib/observability/logger';

// ============================================================================
// Provider-based Implementation (GET only - Phase 3.1)
// ============================================================================

/**
 * Provider 초기화 (필요한 경우)
 */
async function initializeProviderIfNeeded() {
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
 * Provider 기반 플랫폼 목록 조회
 */
async function getPlatformsWithProvider(): Promise<NextResponse> {
  try {
    const provider = await initializeProviderIfNeeded();
    
    if (!provider) {
      logger.warn('Provider initialization failed, falling back to legacy');
      return getPlatformsLegacy();
    }

    // Provider의 Supabase 클라이언트를 통해 직접 쿼리
    // (Provider는 Repository 패턴을 제공하지만, platforms는 아직 Repository가 없음)
    const supabase = provider.getSupabaseClient?.();
    
    if (!supabase) {
      logger.warn('Provider does not have Supabase client, falling back to legacy');
      return getPlatformsLegacy();
    }

    const start = Date.now();
    const { data: platforms, error } = await supabase
      .from('platforms')
      .select('*')
      .order('code', { ascending: true });

    const responseTime = Date.now() - start;

    if (error) {
      logger.error('Provider query failed, falling back to legacy', error, { responseTime });
      return getPlatformsLegacy();
    }

    logger.info('Platforms fetched via provider', {
      provider: provider.type,
      count: platforms?.length || 0,
      responseTime,
    });

    return NextResponse.json(
      { 
        platforms,
        _meta: { provider: provider.type }
      },
      {
        headers: { 
          'x-provider-type': provider.type,
          'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400',
        }
      }
    );
  } catch (error) {
    // 🚨 Provider 실패 시 자동 Fallback
    logger.error(
      'Provider platforms fetch failed, falling back to legacy',
      error instanceof Error ? error : new Error(String(error))
    );
    return getPlatformsLegacy();
  }
}

// ============================================================================
// Legacy Implementation (기존 코드 100% 유지)
// ============================================================================

/**
 * Legacy: 플랫폼 목록 조회
 */
async function getPlatformsLegacy(): Promise<NextResponse> {
  try {
    // Use admin client to bypass RLS for reference data
    const adminClient = createAdminClient();

    const { data: platforms, error } = await adminClient
      .from('platforms')
      .select('*')
      .order('code', { ascending: true });

    if (error) throw error;

    return apiCachedSuccess({ platforms });
  } catch (error) {
    console.error('Error fetching platforms:', error);
    return apiInternalError('플랫폼 목록을 불러오는데 실패했습니다.');
  }
}

/**
 * Legacy: 플랫폼 생성
 */
async function createPlatformLegacy(request: NextRequest): Promise<NextResponse> {
  try {
    // Require admin permission
    const auth = await requireAdmin();
    if (isErrorResponse(auth)) return auth.error;

    const { user, supabase } = auth.context;

    // Parse and validate
    const rawBody = await request.json();
    const validation = validateAndSanitize(platformCreateSchema, rawBody);

    if (!validation.success) {
      return apiBadRequest(validation.error, 'VALIDATION_ERROR');
    }

    const body = validation.data;
    const { code, name, description, display_order } = body;

    // Check if code already exists (using regular client with RLS)
    const { data: existing } = await supabase
      .from('platforms')
      .select('id')
      .eq('code', code)
      .single();

    if (existing) {
      return apiConflict('이미 존재하는 플랫폼 코드입니다.');
    }

    // Insert new platform (RLS will allow if user is admin)
    const { data: platform, error } = await supabase
      .from('platforms')
      .insert({
        code,
        name,
        description: description || null,
        display_order: display_order ?? 0,
      })
      .select()
      .single();

    if (error) throw error;

    return apiSuccess({ platform });
  } catch (error) {
    console.error('Error creating platform:', error);
    return apiInternalError('플랫폼 추가에 실패했습니다.');
  }
}

// ============================================================================
// API Routes
// ============================================================================

/**
 * GET - List all platforms
 * 
 * Feature Flag에 따라 Provider 패턴 또는 Legacy 방식으로 조회
 */
export async function GET() {
  const useNewProvider = isEnabled('FF_PILOT_PLATFORMS_API');
  
  // 로깅: 플래그 상태
  logger.info('Platforms API requested', {
    useNewProvider,
    flagValue: process.env.FF_PILOT_PLATFORMS_API,
  });
  
  if (useNewProvider) {
    return getPlatformsWithProvider();
  }
  
  // 기존 코드 그대로 유지 (Fallback)
  return getPlatformsLegacy();
}

/**
 * POST - Create a new platform (admin only)
 * 
 * TODO: Phase 3.2에서 Provider 패턴으로 전환 예정
 * 현재는 Legacy 방식 유지 (쓰기 작업은 검증 후 전환)
 */
export async function POST(request: NextRequest) {
  // TODO: Phase 3.2에서 Provider 패턴으로 전환
  // const useNewProvider = isEnabled('FF_PILOT_PLATFORMS_API');
  // if (useNewProvider) {
  //   return createPlatformWithProvider(request);
  // }
  
  return createPlatformLegacy(request);
}
