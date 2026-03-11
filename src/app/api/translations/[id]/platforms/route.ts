import { NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/api-auth';
import { TranslationCrudService } from '@/services';
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/response';

/**
 * PATCH /api/translations/[id]/platforms
 * Update platform deployment status
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { user, error: authError, adminClient } = await getAuthUser(supabase);

    if (authError || !user) {
      return apiUnauthorized();
    }

    const { id } = await params;
    const body = await request.json();
    const { platform_code, deploy_status } = body;

    if (!platform_code || !deploy_status) {
      return apiError('MISSING_PARAMS', 'platform_code and deploy_status are required', 400);
    }

    // Use Service to update platform deploy status
    const dbClient = adminClient || createAdminClient();
    const service = new TranslationCrudService(dbClient);
    
    const result = await service.updatePlatformDeployStatus(
      id,
      platform_code,
      deploy_status
    );

    return apiSuccess({
      message: 'Platform status updated',
      all_completed: result.allCompleted,
      progress: result.progress,
      completed_count: result.completedCount,
      total_count: result.totalCount,
    });

  } catch (error) {
    console.error('Error in platform status update:', error);
    
    // Handle "Translation not found" error as 404
    if (error instanceof Error && error.message === 'Translation not found') {
      return apiError('NOT_FOUND', '번역을 찾을 수 없습니다.', 404);
    }
    
    return apiError('INTERNAL_ERROR', 'Internal server error', 500);
  }
}

/**
 * GET /api/translations/[id]/platforms
 * Get platform deployment status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { user, error: authError, adminClient } = await getAuthUser(supabase);

    if (authError || !user) {
      return apiUnauthorized();
    }

    const { id } = await params;

    // Use Service to get platform deploy status
    const dbClient = adminClient || createAdminClient();
    const service = new TranslationCrudService(dbClient);
    
    const result = await service.getPlatformDeployStatus(id);

    return apiSuccess({
      platforms: result.platforms,
      progress: result.progress,
      completed_count: result.completedCount,
      total_count: result.totalCount,
      all_completed: result.allCompleted,
    });

  } catch (error) {
    console.error('Error fetching platform status:', error);
    
    // Handle "Translation not found" error as 404
    if (error instanceof Error && error.message === 'Translation not found') {
      return apiError('NOT_FOUND', '번역을 찾을 수 없습니다.', 404);
    }
    
    return apiError('INTERNAL_ERROR', 'Internal server error', 500);
  }
}
