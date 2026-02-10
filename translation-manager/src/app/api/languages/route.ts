import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

/**
 * GET - List all languages
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { data: languages, error } = await supabase
      .from('languages')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ languages });
  } catch (error) {
    console.error('Error fetching languages:', error);
    return NextResponse.json(
      { error: '언어 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a new language (master only)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // Check if user is master
    const adminClient = createAdminClient();
    const { data: userProfile } = await adminClient
      .from('users')
      .select('roles')
      .eq('id', user.id)
      .single();

    const isMaster = userProfile?.roles?.includes('master') || userProfile?.roles?.includes('1st_master');

    if (!isMaster) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const { code, name, description, display_order } = body;

    if (!code || !name) {
      return NextResponse.json(
        { error: '언어 코드와 이름은 필수입니다.' },
        { status: 400 }
      );
    }

    // Check if code already exists
    const { data: existing } = await adminClient
      .from('languages')
      .select('id')
      .eq('code', code)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: '이미 존재하는 언어 코드입니다.' },
        { status: 400 }
      );
    }

    const { data: language, error } = await adminClient
      .from('languages')
      .insert({
        code,
        name,
        description: description || null,
        display_order: display_order || 0,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ language }, { status: 201 });
  } catch (error) {
    console.error('Error creating language:', error);
    return NextResponse.json(
      { error: '언어 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
