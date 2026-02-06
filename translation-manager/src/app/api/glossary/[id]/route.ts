import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface GlossaryUpdateInput {
  term?: string;
  translation?: string;
  context?: string;
}

// GET - Get single glossary term
export async function GET(
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

    const { data, error } = await supabase
      .from('glossary')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '용어를 찾을 수 없습니다.' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching glossary term:', error);
    return NextResponse.json(
      { error: '용어를 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// PATCH - Update glossary term
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
    const body: GlossaryUpdateInput = await request.json();

    const updateData: Record<string, unknown> = {};
    if (body.term !== undefined) updateData.term = body.term.trim();
    if (body.translation !== undefined) updateData.translation = body.translation.trim();
    if (body.context !== undefined) updateData.context = body.context?.trim() || null;

    const { data, error } = await supabase
      .from('glossary')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: '용어를 찾을 수 없습니다.' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating glossary term:', error);
    return NextResponse.json(
      { error: '용어를 업데이트하는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE - Delete glossary term
export async function DELETE(
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

    const { error } = await supabase
      .from('glossary')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting glossary term:', error);
    return NextResponse.json(
      { error: '용어를 삭제하는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
