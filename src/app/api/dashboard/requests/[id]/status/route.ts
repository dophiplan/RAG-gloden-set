import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/api-auth';
import { apiSuccess, apiUnauthorized, apiNotFound, apiBadRequest, apiInternalError } from '@/lib/api/response';
import type { TranslationStatus } from '@/types';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { user } = await getAuthUser(supabase);
    if (!user) {
      return apiUnauthorized();
    }

    const { id: requestId } = await params;
    const { status: newStatus } = await request.json() as { status: TranslationStatus };

    // Use admin client to bypass RLS
    const adminClient = createAdminClient();

    // Fetch all translations in this request
    const { data: translations, error: fetchError } = await adminClient
      .from('translations')
      .select('id, status')
      .eq('request_id', requestId);

    if (fetchError) {
      console.error('Request status fetch error:', fetchError);
      return apiInternalError('번역 요청 조회 중 오류가 발생했습니다.');
    }

    if (!translations || translations.length === 0) {
      return apiNotFound('번역 요청');
    }

    // Get current status (should be uniform)
    const currentStatuses = [...new Set(translations.map(t => t.status))];
    if (currentStatuses.length > 1) {
      return apiBadRequest('번역 항목들의 상태가 일치하지 않습니다.');
    }

    const currentStatus = currentStatuses[0] as TranslationStatus;

    // Validate transition
    const validTransitions: Record<TranslationStatus, TranslationStatus[]> = {
      pending: ['in_progress', 're_request', 'not_used'],
      in_progress: ['reviewed', 're_request', 'not_used'],
      reviewed: ['deployed', 're_deploy_request', 'not_used'],
      deployed: ['re_deploy_request', 'not_used'],
      re_request: ['in_progress', 'pending', 'not_used'],
      re_deploy_request: ['reviewed', 'deployed', 'not_used'],
      not_used: ['pending', 're_request'],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      return apiBadRequest(`잘못된 상태 전환입니다: ${currentStatus} → ${newStatus}`);
    }

    // Update all translations in this request
    const translationIds = translations.map(t => t.id);

    const { error: updateError } = await adminClient
      .from('translations')
      .update({ status: newStatus })
      .in('id', translationIds);

    if (updateError) {
      console.error('Request status update error:', updateError);
      return apiInternalError('상태 업데이트 중 오류가 발생했습니다.');
    }

    // Get user profile for audit logs
    const { data: userProfile } = await adminClient
      .from('users')
      .select('name, email')
      .eq('id', user.id)
      .single();

    // Create audit logs for each translation (non-blocking)
    try {
      const auditLogs = translationIds.map(id => ({
        translation_id: id,
        user_id: user.id,
        user_name: userProfile?.name || null,
        user_email: userProfile?.email || user.email,
        action: 'update' as const,
        field_name: 'status',
        old_value: currentStatus,
        new_value: newStatus,
      }));

      const { error: auditError } = await adminClient.from('translation_audit_logs').insert(auditLogs);
      if (auditError) {
        console.error('Audit log creation failed:', auditError);
        // Don't fail the request if audit log fails
      }
    } catch (auditErr) {
      console.error('Audit log error:', auditErr);
      // Continue even if audit log fails
    }

    // Return undo info (5-second window)
    return apiSuccess({
      request_id: requestId,
      translation_ids: translationIds,
      old_status: currentStatus,
      new_status: newStatus,
      undo_expires_at: new Date(Date.now() + 5000).toISOString(),
    });
  } catch (error) {
    console.error('Request status update error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return apiInternalError('요청 처리 중 오류가 발생했습니다.', errorMessage);
  }
}
