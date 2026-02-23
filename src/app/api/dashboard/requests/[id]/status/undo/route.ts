import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/api-auth';
import type { TranslationStatus } from '@/types';

export async function POST(
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
    const body = await request.json() as {
      old_status: TranslationStatus;
      undo_expires_at: string;
    };

    // Verify undo window hasn't expired
    if (new Date() > new Date(body.undo_expires_at)) {
      return NextResponse.json({
        error: '실행 취소 시간이 만료되었습니다.'
      }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Revert all translations back to old status
    const { error: updateError } = await adminClient
      .from('translations')
      .update({ status: body.old_status })
      .eq('request_id', requestId);

    if (updateError) throw updateError;

    // Get user profile
    const { data: userProfile } = await adminClient
      .from('users')
      .select('name, email')
      .eq('id', user.id)
      .single();

    // Create audit log for undo
    const { data: translations } = await adminClient
      .from('translations')
      .select('id')
      .eq('request_id', requestId);

    if (translations) {
      const auditLogs = translations.map(t => ({
        translation_id: t.id,
        user_id: user.id,
        user_name: userProfile?.name || null,
        user_email: userProfile?.email || user.email,
        action: 'update' as const,
        field_name: 'status',
        old_value: null, // Undo action, so reversed
        new_value: body.old_status,
        comment: '상태 변경 실행 취소',
      }));

      await adminClient.from('translation_audit_logs').insert(auditLogs);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Undo error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
