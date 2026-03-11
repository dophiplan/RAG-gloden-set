import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '../../types';
import { logTranslationAudit } from '../../lib/audit';
import { ApiError, successResponse } from '../../lib/response';

export async function translationsRevert(
  request: NextRequest,
  user: User,
  adminClient: SupabaseClient
): Promise<NextResponse> {
  const body = await request.json();
  const ids = body.ids || body.translation_ids;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    throw new ApiError('ids 배열은 필수입니다.', 400);
  }

  const results = [];

  for (const id of ids) {
    // Get latest audit log for this translation
    const { data: auditLog } = await adminClient
      .from('translation_audit_logs')
      .select('*')
      .eq('translation_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (auditLog && auditLog.old_value) {
      // Revert to old value
      await adminClient
        .from('translations')
        .update({ source_text: auditLog.old_value })
        .eq('id', id);

      results.push({ id, reverted: true });
    } else {
      results.push({ id, reverted: false, reason: 'No audit log found' });
    }
  }

  await logTranslationAudit(adminClient, {
    action: 'bulk_revert',
    userId: user.id,
    userEmail: user.email,
    affectedIds: ids,
  });

  return successResponse({
    message: `${results.filter(r => r.reverted).length}개 항목이 복원되었습니다.`,
    results,
  });
}
