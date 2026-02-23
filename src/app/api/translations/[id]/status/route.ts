import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { TranslationStatus } from '@/types/translations';
import { apiSuccess, apiUnauthorized, apiNotFound, apiBadRequest, apiInternalError } from '@/lib/api/response';

// PATCH - Update translation status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiUnauthorized();
    }

    const { id } = await params;
    const body = await request.json();
    const { status: newStatus } = body;

    if (!newStatus) {
      return apiBadRequest('Status is required');
    }

    // Validate status transition
    // Workflow: pending -> in_progress -> reviewed -> deployed
    // Can also go back for corrections: deployed -> reviewed -> in_progress
    const validTransitions: Record<TranslationStatus, TranslationStatus[]> = {
      pending: ['pending', 'in_progress'], // Can stay or move forward
      in_progress: ['pending', 'in_progress', 'reviewed'], // Can go back, stay, or forward
      reviewed: ['in_progress', 'reviewed', 'deployed'], // Can go back, stay, or forward
      deployed: ['reviewed', 'deployed', 're_deploy_request'], // Can go back for re-review or stay
      re_request: ['pending', 're_request', 'in_progress'], // Can restart workflow
      re_deploy_request: ['reviewed', 're_deploy_request', 'deployed'], // Can re-deploy or go back
      not_used: ['not_used', 'pending'], // Can reactivate
    };

    // Fetch current translation
    const { data: translation, error: fetchError } = await supabase
      .from('translations')
      .select('status')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return apiNotFound('번역');
      }
      throw fetchError;
    }

    // Validate transition
    const currentStatus = translation.status as TranslationStatus;
    const allowedStatuses = validTransitions[currentStatus] || [];

    if (!allowedStatuses.includes(newStatus)) {
      return apiBadRequest(
        `상태를 변경할 수 없습니다: ${currentStatus} → ${newStatus}`,
        {
          currentStatus,
          requestedStatus: newStatus,
          allowedTransitions: allowedStatuses,
          message: `현재 "${currentStatus}" 상태에서는 다음 상태로만 변경 가능합니다: ${allowedStatuses.join(', ')}`,
        }
      );
    }

    // Update status
    const { error: updateError } = await supabase
      .from('translations')
      .update({ status: newStatus })
      .eq('id', id);

    if (updateError) {
      throw updateError;
    }

    // Get user data for audit log
    const { data: userData } = await supabase
      .from('users')
      .select('name')
      .eq('id', user.id)
      .single();

    // Create audit log (fire-and-forget with error handling)
    void supabase.from('translation_audit_logs').insert({
      translation_id: id,
      user_id: user.id,
      user_name: userData?.name,
      user_email: user.email,
      action: 'update',
      field_name: 'status',
      old_value: currentStatus,
      new_value: newStatus,
    }).then(({ error }) => {
      if (error) {
        console.error('[Audit Log] Failed to log status update:', error);
        // Don't throw - audit log failure should not break the main operation
      }
    });

    return apiSuccess({ success: true, newStatus });
  } catch (error) {
    console.error('Error updating status:', error);
    return apiInternalError('상태를 변경하는데 실패했습니다.');
  }
}
