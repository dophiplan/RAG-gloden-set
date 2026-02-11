import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface BulkApproveInput {
  ids: string[];
  action: 'approve' | 'reject';
}

// PATCH - Bulk approve or reject glossary terms
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body: BulkApproveInput = await request.json();

    if (!body.ids || body.ids.length === 0) {
      return NextResponse.json(
        { error: 'ID 목록은 필수입니다.' },
        { status: 400 }
      );
    }

    if (!body.action || !['approve', 'reject'].includes(body.action)) {
      return NextResponse.json(
        { error: '유효하지 않은 작업입니다.' },
        { status: 400 }
      );
    }

    const newStatus = body.action === 'approve' ? 'approved' : 'rejected';

    // Use batch update for performance
    const { data, error } = await supabase
      .from('glossary')
      .update({
        approval_status: newStatus,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .in('id', body.ids)
      .select();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      updated: data?.length || 0,
      failed: body.ids.length - (data?.length || 0),
    });
  } catch (error) {
    console.error('Error bulk approving/rejecting glossary terms:', error);
    return NextResponse.json(
      { error: '일괄 승인/거부에 실패했습니다.' },
      { status: 500 }
    );
  }
}
