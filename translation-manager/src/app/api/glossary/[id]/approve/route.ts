import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GlossaryRepository } from '@/repositories';

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

    // Use Repository with Audit Logging (Phase 4)
    const repository = new GlossaryRepository(supabase);
    
    // Get user profile for audit log
    const { data: userProfile } = await supabase
      .from('users')
      .select('name')
      .eq('id', user.id)
      .single();

    const userInfo = {
      id: user.id,
      name: userProfile?.name,
      email: user.email || '',
    };

    let term;
    if (body.action === 'approve') {
      term = await repository.approveWithAudit(id, userInfo);
    } else {
      term = await repository.rejectWithAudit(id, userInfo);
    }

    return NextResponse.json({
      success: true,
      term,
    });
  } catch (error) {
    console.error('Error approving/rejecting glossary term:', error);
    return NextResponse.json(
      { error: '용어 승인/거부에 실패했습니다.' },
      { status: 500 }
    );
  }
}
