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
    const validTransitions: Record<TranslationStatus, TranslationStatus[]> = {
      pending: ['in_progress'],
      in_progress: ['reviewed'],
      reviewed: ['deployed'],
      deployed: [],
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
    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      return NextResponse.json({
        error: `Invalid transition: ${currentStatus} -> ${newStatus}`
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

    // Create audit log
    await supabase.from('translation_audit_logs').insert({
      translation_id: id,
      user_id: user.id,
      user_name: userData?.name,
      user_email: user.email,
      action: 'update',
      field_name: 'status',
      old_value: currentStatus,
      new_value: newStatus,
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
