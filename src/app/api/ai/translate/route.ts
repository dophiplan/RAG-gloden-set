import { NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { translateWithProvider, AIProvider } from '@/lib/ai';
import { LanguageCode } from '@/types';
import { aiTranslateSchema, validateAndSanitize, sanitizeText } from '@/lib/validation/schemas';
import { apiSuccess, apiUnauthorized, apiBadRequest, apiInternalError } from '@/lib/api/response';

interface TranslateRequest {
  translationId?: string;
  sourceText: string;
  context?: string;
  targetLanguages: LanguageCode[];
  provider?: AIProvider;
}

const RSUPPORT_DOMAIN = 'rsupport.com';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiUnauthorized();
    }

    // Parse and validate request
    const rawBody = await request.json();
    const validation = validateAndSanitize(aiTranslateSchema, rawBody);

    if (!validation.success) {
      return apiBadRequest(validation.error);
    }

    const body = validation.data as TranslateRequest;
    const sanitizedSourceText = sanitizeText(body.sourceText);
    const sanitizedContext = body.context ? sanitizeText(body.context) : null;

    // Get AI provider settings
    const adminClient = createAdminClient();
    const { data: orgSettings } = await adminClient
      .from('organization_settings')
      .select('*')
      .eq('domain', RSUPPORT_DOMAIN)
      .maybeSingle();

    // Build available providers map
    const availableProviders: Record<string, string> = {};
    
    if (orgSettings?.openai_api_key) availableProviders.openai = orgSettings.openai_api_key;
    if (orgSettings?.claude_api_key) availableProviders.claude = orgSettings.claude_api_key;
    if (orgSettings?.kimi_api_key) availableProviders.kimi = orgSettings.kimi_api_key;
    if (orgSettings?.gemini_api_key) availableProviders.gemini = orgSettings.gemini_api_key;

    // Fallback: Environment variable for OpenAI
    if (!availableProviders.openai && process.env.OPENAI_API_KEY) {
      availableProviders.openai = process.env.OPENAI_API_KEY;
    }

    // Fallback: Environment variable for Kimi (Moonshot AI)
    if (!availableProviders.kimi && process.env.KIMI_API_KEY) {
      availableProviders.kimi = process.env.KIMI_API_KEY;
    }

    // Determine provider to use
    let selectedProvider: AIProvider | null = null;
    let apiKey: string | null = null;

    if (body.provider) {
      // Specific provider requested
      if (availableProviders[body.provider]) {
        selectedProvider = body.provider;
        apiKey = availableProviders[body.provider];
      } else {
        return apiBadRequest(`${body.provider.toUpperCase()} API 키가 설정되지 않았습니다.`);
      }
    } else {
      // Auto-select based on priority order
      const providerOrder: AIProvider[] = orgSettings?.settings?.ai_provider_order || 
        ['openai', 'claude', 'kimi', 'gemini'];
      
      for (const provider of providerOrder) {
        if (availableProviders[provider]) {
          selectedProvider = provider;
          apiKey = availableProviders[provider];
          break;
        }
      }
    }

    if (!apiKey || !selectedProvider) {
      return apiBadRequest('사용 가능한 AI API 키가 없습니다. 설정 페이지에서 API 키를 등록해주세요.');
    }

    // Fetch glossary terms
    const { data: glossaryTerms } = await supabase
      .from('glossary')
      .select('*')
      .in('language_code', body.targetLanguages);

    // Fetch translation memory
    const { data: translationMemory } = await supabase
      .from('translations')
      .select(`
        source_text,
        translation_results (language_code, translated_text)
      `)
      .neq('source_text', sanitizedSourceText)
      .limit(20);

    // Format translation memory
    const formattedMemory = translationMemory?.flatMap((t: any) =>
      t.translation_results
        ?.filter((r: any) => body.targetLanguages.includes(r.language_code as LanguageCode))
        .map((r: any) => ({
          source_text: t.source_text,
          translated_text: r.translated_text,
          language_code: r.language_code,
        })) || []
    ) || [];

    // Fetch corrections
    const { data: corrections } = await supabase
      .from('translation_corrections')
      .select('*')
      .in('language_code', body.targetLanguages)
      .order('created_at', { ascending: false })
      .limit(20);

    // Call AI translation
    console.log(`🤖 AI Translation: ${selectedProvider.toUpperCase()}`);
    
    const translations = await translateWithProvider(selectedProvider, {
      sourceText: sanitizedSourceText,
      context: sanitizedContext,
      targetLanguages: body.targetLanguages,
      glossaryTerms: glossaryTerms || [],
      translationMemory: formattedMemory,
      corrections: corrections || [],
      apiKey,
    });

    // Save results if translationId provided
    if (body.translationId) {
      for (const translation of translations) {
        const { data: existing } = await supabase
          .from('translation_results')
          .select('id')
          .eq('translation_id', body.translationId)
          .eq('language_code', translation.languageCode)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('translation_results')
            .update({
              translated_text: translation.translatedText,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
        } else {
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

    return apiSuccess({
      translations: translations.map(t => ({
        languageCode: t.languageCode,
        translatedText: t.translatedText,
      })),
      provider: selectedProvider,
    });

  } catch (error) {
    console.error('Error in AI translate:', error);
    
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      if (error.message.includes('401') || error.message.includes('Authentication')) {
        return apiInternalError('AI API 키가 유효하지 않습니다. 설정에서 확인해주세요.');
      }
      // Return more specific error message for debugging
      return apiInternalError(`번역 중 오류: ${error.message}`);
    }
    
    return apiInternalError('번역 중 오류가 발생했습니다.');
  }
}
