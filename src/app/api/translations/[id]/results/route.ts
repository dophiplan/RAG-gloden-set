import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/api-auth';
import { TranslationCrudService } from '@/services';
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
    const { user, error: authError, adminClient } = await getAuthUser(supabase);

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

    // Use Service to update translation result
    const dbClient = adminClient || createAdminClient();
    const service = new TranslationCrudService(dbClient);
    
    const result = await service.updateTranslationResult(
      translationId,
      body.language_code,
      body.translated_text,
      user.id
    );

    // Fetch the updated/created result
    const { data: resultData } = await dbClient
      .from('translation_results')
      .select('*')
      .eq('id', result.id)
      .single();

    return NextResponse.json(resultData, { status: result.isNew ? 201 : 200 });
  } catch (error) {
    console.error('Error saving translation result:', error);
    
    // Handle "Translation not found" error as 404
    if (error instanceof Error && error.message === 'Translation not found') {
      return NextResponse.json(
        { error: '번역을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: '번역 결과를 저장하는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
