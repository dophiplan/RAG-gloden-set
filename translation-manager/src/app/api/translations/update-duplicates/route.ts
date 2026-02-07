import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface UpdateDuplicatesInput {
  sourceText: string;
  field: string;
  value: string | string[] | null;
  excludeId?: string;
}

// POST - Update all translations with matching source text
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body: UpdateDuplicatesInput = await request.json();
    const { sourceText, field, value, excludeId } = body;

    if (!sourceText || !field) {
      return NextResponse.json(
        { error: 'sourceText와 field는 필수입니다.' },
        { status: 400 }
      );
    }

    // Find all translations with matching source text
    let query = supabase
      .from('translations')
      .select('id')
      .eq('source_text', sourceText);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data: duplicates, error: findError } = await query;

    if (findError) throw findError;

    if (!duplicates || duplicates.length === 0) {
      return NextResponse.json({
        success: true,
        updatedCount: 0,
        message: '중복 데이터가 없습니다.',
      });
    }

    // Update all duplicates
    const { error: updateError } = await supabase
      .from('translations')
      .update({ [field]: value })
      .in('id', duplicates.map(d => d.id));

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      updatedCount: duplicates.length,
      message: `${duplicates.length}개의 중복 데이터가 업데이트되었습니다.`,
    });
  } catch (error) {
    console.error('Error updating duplicates:', error);
    return NextResponse.json(
      { error: '중복 데이터 업데이트 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// GET - Find duplicates for a given source text
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sourceText = searchParams.get('sourceText');
    const excludeId = searchParams.get('excludeId');

    if (!sourceText) {
      return NextResponse.json(
        { error: 'sourceText 파라미터가 필요합니다.' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('translations')
      .select('id, source_text, version, created_at')
      .eq('source_text', sourceText)
      .order('created_at', { ascending: false });

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data: duplicates, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      duplicates: duplicates || [],
      count: duplicates?.length || 0,
    });
  } catch (error) {
    console.error('Error finding duplicates:', error);
    return NextResponse.json(
      { error: '중복 데이터 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
