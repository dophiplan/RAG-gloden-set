import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface ApproveActionInput {
  action: 'approve' | 'reject';
}

// PATCH - Approve or reject glossary term
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
    const body: ApproveActionInput = await request.json();

    if (!body.action || !['approve', 'reject'].includes(body.action)) {
      return NextResponse.json(
        { error: '유효하지 않은 작업입니다.' },
        { status: 400 }
      );
    }

    const newStatus = body.action === 'approve' ? 'approved' : 'rejected';

    const { data, error } = await supabase
      .from('glossary')
      .update({
        approval_status: newStatus,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '용어를 찾을 수 없습니다.' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      term: data,
    });
  } catch (error) {
    console.error('Error approving/rejecting glossary term:', error);
    return NextResponse.json(
      { error: '용어 승인/거부에 실패했습니다.' },
      { status: 500 }
    );
  }
}
