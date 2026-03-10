import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/api-auth';
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
    const { user, error: authError } = await getAuthUser(supabase);

    if (authError || !user) {
      return apiUnauthorized();
    }

    const { id } = await params;
    const body = await request.json();
    const { platform_code, deploy_status } = body;

    if (!platform_code || !deploy_status) {
      return apiError('MISSING_PARAMS', 'platform_code and deploy_status are required', 400);
    }

    // Update platform deploy status
    const { error } = await supabase
      .from('translation_platforms')
      .update({ deploy_status })
      .eq('translation_id', id)
      .eq('platform_code', platform_code);

    if (error) {
      console.error('Error updating platform status:', error);
      return apiError('UPDATE_FAILED', 'Failed to update platform status', 500);
    }

    // Check if all platforms are completed
    const { data: platforms } = await supabase
      .from('translation_platforms')
      .select('deploy_status')
      .eq('translation_id', id);

    const allCompleted = platforms?.every(p => p.deploy_status === 'completed') ?? false;
    const totalPlatforms = platforms?.length ?? 0;
    const completedPlatforms = platforms?.filter(p => p.deploy_status === 'completed').length ?? 0;
    const progress = totalPlatforms > 0 ? Math.round((completedPlatforms / totalPlatforms) * 100) : 0;

    // Auto-update translation status to 'deployed' if all platforms completed
    if (allCompleted && totalPlatforms > 0) {
      await supabase
        .from('translations')
        .update({ status: 'deployed' })
        .eq('id', id);
    }

    return apiSuccess({
      message: 'Platform status updated',
      all_completed: allCompleted,
      progress,
      completed_count: completedPlatforms,
      total_count: totalPlatforms,
    });

  } catch (error) {
    console.error('Error in platform status update:', error);
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
    const { user, error: authError } = await getAuthUser(supabase);

    if (authError || !user) {
      return apiUnauthorized();
    }

    const { id } = await params;

    const { data: platforms, error } = await supabase
      .from('translation_platforms')
      .select('platform_code, deploy_status')
      .eq('translation_id', id);

    if (error) {
      console.error('Error fetching platforms:', error);
      return apiError('FETCH_FAILED', 'Failed to fetch platforms', 500);
    }

    const totalPlatforms = platforms?.length ?? 0;
    const completedPlatforms = platforms?.filter(p => p.deploy_status === 'completed').length ?? 0;
    const progress = totalPlatforms > 0 ? Math.round((completedPlatforms / totalPlatforms) * 100) : 0;

    return apiSuccess({
      platforms: platforms || [],
      progress,
      completed_count: completedPlatforms,
      total_count: totalPlatforms,
      all_completed: totalPlatforms > 0 && completedPlatforms === totalPlatforms,
    });

  } catch (error) {
    console.error('Error fetching platform status:', error);
    return apiError('INTERNAL_ERROR', 'Internal server error', 500);
  }
}
