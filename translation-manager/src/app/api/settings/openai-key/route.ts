import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST - Save OpenAI API key
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { api_key } = body;

    if (!api_key || typeof api_key !== 'string') {
      return NextResponse.json(
        { error: 'API 키가 필요합니다.' },
        { status: 400 }
      );
    }

    // Validate API key format
    if (!api_key.startsWith('sk-')) {
      return NextResponse.json(
        { error: '유효한 OpenAI API 키 형식이 아닙니다.' },
        { status: 400 }
      );
    }

    // Upsert user settings
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        openai_api_key: api_key,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving OpenAI API key:', error);
    return NextResponse.json(
      { error: 'API 키 저장에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE - Remove OpenAI API key
export async function DELETE() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { error } = await supabase
      .from('user_settings')
      .update({
        openai_api_key: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting OpenAI API key:', error);
    return NextResponse.json(
      { error: 'API 키 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
