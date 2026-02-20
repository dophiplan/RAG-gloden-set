import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/api-auth';
import { successResponse, serverError, badRequest } from '@/lib/api/middleware';

// POST - Retranslate glossary terms with AI
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthUser(supabase);

    if (authError || !user) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const { sourceText, context, targetLanguages } = body;

    if (!sourceText || !targetLanguages || !Array.isArray(targetLanguages)) {
      return badRequest('원문과 대상 언어가 필요합니다.');
    }

    // Call AI for translation
    const { translateWithProvider } = await import('@/lib/ai');
    const aiTranslations = await translateWithProvider('kimi', {
      sourceText,
      context: context || null,
      targetLanguages,
      glossaryTerms: [],
      translationMemory: [],
      corrections: [],
      apiKey: process.env.KIMI_API_KEY || '',
    });

    // Update existing glossary terms
    const results = [];
    for (const translation of aiTranslations) {
      // Find existing term
      const { data: existing } = await supabase
        .from('glossary')
        .select('id')
        .eq('term', sourceText)
        .eq('language_code', translation.languageCode)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { data, error } = await supabase
          .from('glossary')
          .update({
            translation: translation.translatedText,
            source_type: 'ai_generated',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (!error) results.push(data);
      }
    }

    return successResponse({
      translations: results,
      message: `${results.length}개 용어가 재번역되었습니다.`,
    });
  } catch (error) {
    console.error('Retranslate error:', error);
    return serverError('재번역 중 오류가 발생했습니다.');
  }
}
