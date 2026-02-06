import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { LanguageCode } from '@/types';

interface TranslationResultInput {
  language_code: LanguageCode;
  translated_text: string;
}

// POST - Add or update translation result
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { id: translationId } = await params;
    const body: TranslationResultInput = await request.json();

    if (!body.language_code || !body.translated_text?.trim()) {
      return NextResponse.json(
        { error: '언어 코드와 번역 텍스트는 필수입니다.' },
        { status: 400 }
      );
    }

    // Check if result already exists for this language
    const { data: existing } = await supabase
      .from('translation_results')
      .select('id')
      .eq('translation_id', translationId)
      .eq('language_code', body.language_code)
      .single();

    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('translation_results')
        .update({
          translated_text: body.translated_text.trim(),
          reviewer_id: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    } else {
      // Create new
      const { data, error } = await supabase
        .from('translation_results')
        .insert({
          translation_id: translationId,
          language_code: body.language_code,
          translated_text: body.translated_text.trim(),
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data, { status: 201 });
    }
  } catch (error) {
    console.error('Error saving translation result:', error);
    return NextResponse.json(
      { error: '번역 결과를 저장하는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
