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
    const { sourceText, context, targetLanguages, mode = 'all' } = body;

    if (!sourceText || !targetLanguages || !Array.isArray(targetLanguages)) {
      return badRequest('원문과 대상 언어가 필요합니다.');
    }

    // mode 유효성 검사
    if (!['all', 'empty', 'untranslated'].includes(mode)) {
      return badRequest('유효하지 않은 모드입니다. (all, empty, untranslated)');
    }

    // 현재 용어의 기존 번역 데이터 조회
    const { data: existingTerms } = await supabase
      .from('glossary')
      .select('id, language_code, translation')
      .eq('term', sourceText);

    // 모드에 따른 대상 언어 필터링
    let languagesToTranslate = targetLanguages;

    if (mode === 'empty') {
      // 빈 번역만 필터링
      const existingLangs = new Set(
        (existingTerms || [])
          .filter(t => t.translation && t.translation.trim() !== '')
          .map(t => t.language_code)
      );
      languagesToTranslate = targetLanguages.filter(lang => !existingLangs.has(lang));
    } else if (mode === 'untranslated') {
      // 번역이 없는 언어만 필터링
      const existingLangs = new Set((existingTerms || []).map(t => t.language_code));
      languagesToTranslate = targetLanguages.filter(lang => !existingLangs.has(lang));
    }
    // mode === 'all'이면 모든 targetLanguages를 번역

    // 번역할 언어가 없으면 바로 반환
    if (languagesToTranslate.length === 0) {
      return successResponse({
        translations: [],
        message: '번역할 언어가 없습니다.',
        skipped: true,
      });
    }

    // Call AI for translation
    const { translateWithProvider } = await import('@/lib/ai');
    const aiTranslations = await translateWithProvider('kimi', {
      sourceText,
      context: context || null,
      targetLanguages: languagesToTranslate,
      glossaryTerms: [],
      translationMemory: [],
      corrections: [],
      apiKey: process.env.KIMI_API_KEY || '',
    });

    // Update existing glossary terms or create new ones
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
      } else {
        // Create new translation entry
        const { data, error } = await supabase
          .from('glossary')
          .insert({
            term: sourceText,
            translation: translation.translatedText,
            language_code: translation.languageCode,
            context: context || null,
            source_type: 'ai_generated',
          })
          .select()
          .single();

        if (!error) results.push(data);
      }
    }

    return successResponse({
      translations: results,
      message: `${results.length}개 용어가 재번역되었습니다.`,
      mode,
      translatedLanguages: languagesToTranslate,
    });
  } catch (error) {
    console.error('Retranslate error:', error);
    return serverError('재번역 중 오류가 발생했습니다.');
  }
}
