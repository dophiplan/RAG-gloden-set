import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { TranslationStatus } from '@/types/translations';

// PATCH - Update translation status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status: newStatus } = body;

    if (!newStatus) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    // Validate status transition
    // Workflow: pending -> in_progress -> reviewed -> deployed
    // Can also go back for corrections: deployed -> reviewed -> in_progress
    const validTransitions: Record<TranslationStatus, TranslationStatus[]> = {
      pending: ['pending', 'in_progress'], // Can stay or move forward
      in_progress: ['pending', 'in_progress', 'reviewed'], // Can go back, stay, or forward
      reviewed: ['in_progress', 'reviewed', 'deployed'], // Can go back, stay, or forward
      deployed: ['reviewed', 'deployed'], // Can go back for re-review or stay
    };

    // Fetch current translation
    const { data: translation, error: fetchError } = await supabase
      .from('translations')
      .select('status')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: '번역을 찾을 수 없습니다.' }, { status: 404 });
      }
      throw fetchError;
    }

    // Validate transition
    const currentStatus = translation.status as TranslationStatus;
    const allowedStatuses = validTransitions[currentStatus] || [];

    if (!allowedStatuses.includes(newStatus)) {
      return NextResponse.json({
        error: `상태를 변경할 수 없습니다: ${currentStatus} → ${newStatus}`,
        currentStatus,
        requestedStatus: newStatus,
        allowedTransitions: allowedStatuses,
        message: `현재 "${currentStatus}" 상태에서는 다음 상태로만 변경 가능합니다: ${allowedStatuses.join(', ')}`,
      }, { status: 400 });
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

    return NextResponse.json({ success: true, newStatus });
  } catch (error) {
    console.error('Error updating status:', error);
    return NextResponse.json(
      { error: '상태를 변경하는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
