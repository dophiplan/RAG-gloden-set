import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/api-auth';
import type { TranslationStatus } from '@/types';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { user } = await getAuthUser(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    if (fetchError) throw fetchError;

    if (!translations || translations.length === 0) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Get current status (should be uniform)
    const currentStatuses = [...new Set(translations.map(t => t.status))];
    if (currentStatuses.length > 1) {
      return NextResponse.json({
        error: '번역 항목들의 상태가 일치하지 않습니다.'
      }, { status: 400 });
    }

    const currentStatus = currentStatuses[0] as TranslationStatus;

    // Validate transition
    const validTransitions: Record<TranslationStatus, TranslationStatus[]> = {
      pending: ['in_progress'],
      in_progress: ['reviewed'],
      reviewed: ['deployed'],
      deployed: [],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      return NextResponse.json({
        error: `잘못된 상태 전환입니다: ${currentStatus} → ${newStatus}`
      }, { status: 400 });
    }

    // Update all translations in this request
    const translationIds = translations.map(t => t.id);

    const { error: updateError } = await adminClient
      .from('translations')
      .update({ status: newStatus })
      .in('id', translationIds);

    if (updateError) throw updateError;

    // Get user profile for audit logs
    const { data: userProfile } = await adminClient
      .from('users')
      .select('name, email')
      .eq('id', user.id)
      .single();

    // Create audit logs for each translation
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

    await adminClient.from('translation_audit_logs').insert(auditLogs);

    // Return undo info (5-second window)
    return NextResponse.json({
      success: true,
      request_id: requestId,
      translation_ids: translationIds,
      old_status: currentStatus,
      new_status: newStatus,
      undo_expires_at: new Date(Date.now() + 5000).toISOString(),
    });
  } catch (error) {
    console.error('Request status update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
