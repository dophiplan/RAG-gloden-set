import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { autoTranslate } from '@/lib/openai/auto-translate';
import { LanguageCode } from '@/types';

interface TranslateRequest {
  translationId?: string;
  sourceText: string;
  context?: string;
  targetLanguages: LanguageCode[];
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body: TranslateRequest = await request.json();

    // Validate request
    if (!body.sourceText?.trim()) {
      return NextResponse.json(
        { error: '원문 텍스트는 필수입니다.' },
        { status: 400 }
      );
    }

    if (!body.targetLanguages || body.targetLanguages.length === 0) {
      return NextResponse.json(
        { error: '번역할 언어를 선택해주세요.' },
        { status: 400 }
      );
    }

    // Get user profile to check domain
    const { data: userProfile } = await supabase
      .from('users')
      .select('email')
      .eq('id', user.id)
      .single();

    let apiKey: string | null = null;

    // Priority 1: Organization API key for @rsupport.com users
    if (userProfile?.email?.endsWith('@rsupport.com')) {
      const { data: orgSettings } = await supabase
        .from('organization_settings')
        .select('openai_api_key')
        .eq('domain', 'rsupport.com')
        .single();

      apiKey = orgSettings?.openai_api_key || null;
    }

    // Priority 2: Individual user API key
    if (!apiKey) {
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('openai_api_key')
        .eq('user_id', user.id)
        .single();

      apiKey = userSettings?.openai_api_key || null;
    }

    // Priority 3: Environment variable
    if (!apiKey) {
      apiKey = process.env.OPENAI_API_KEY || null;
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API 키가 설정되지 않았습니다. 설정 페이지에서 API 키를 입력해주세요.' },
        { status: 400 }
      );
    }

    // Fetch glossary terms
    const { data: glossaryTerms } = await supabase
      .from('glossary')
      .select('*')
      .in('language_code', body.targetLanguages);

    // Fetch similar translations for translation memory
    const { data: translationMemory } = await supabase
      .from('translations')
      .select(`
        source_text,
        translation_results (
          language_code,
          translated_text
        )
      `)
      .neq('source_text', body.sourceText)
      .limit(20);

    // Format translation memory
    const formattedMemory = translationMemory?.flatMap((t) =>
      (t.translation_results as { language_code: string; translated_text: string }[])
        ?.filter((r) => body.targetLanguages.includes(r.language_code as LanguageCode))
        .map((r) => ({
          source_text: t.source_text,
          translated_text: r.translated_text,
          language_code: r.language_code,
        })) || []
    ) || [];

    // Fetch corrections for learning
    const { data: corrections } = await supabase
      .from('translation_corrections')
      .select('*')
      .in('language_code', body.targetLanguages)
      .order('created_at', { ascending: false })
      .limit(20);

    // Call AI translation
    const translations = await autoTranslate({
      sourceText: body.sourceText,
      context: body.context || null,
      targetLanguages: body.targetLanguages,
      glossaryTerms: glossaryTerms || [],
      translationMemory: formattedMemory,
      corrections: corrections || [],
      apiKey,
    });

    // If translationId is provided, save results to database
    if (body.translationId) {
      for (const translation of translations) {
        // Check if result already exists
        const { data: existing } = await supabase
          .from('translation_results')
          .select('id, translated_text')
          .eq('translation_id', body.translationId)
          .eq('language_code', translation.languageCode)
          .single();

        if (existing) {
          // Update existing
          await supabase
            .from('translation_results')
            .update({
              translated_text: translation.translatedText,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
        } else {
          // Create new
          await supabase
            .from('translation_results')
            .insert({
              translation_id: body.translationId,
              language_code: translation.languageCode,
              translated_text: translation.translatedText,
            });
        }
      }
    }

    return NextResponse.json({
      translations: translations.map((t) => ({
        languageCode: t.languageCode,
        translatedText: t.translatedText,
      })),
    });
  } catch (error) {
    console.error('Error in AI translate:', error);

    if (error instanceof Error && error.message.includes('OPENAI_API_KEY')) {
      return NextResponse.json(
        { error: 'OpenAI API 키가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'AI 번역 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
