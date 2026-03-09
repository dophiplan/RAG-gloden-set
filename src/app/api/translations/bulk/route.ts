import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { TranslationStatus, ProductCode, LanguageCode, Scope } from '@/types';
import { getAuthUser } from '@/lib/api-auth';
import { translateWithProvider, AIProvider } from '@/lib/ai';
import { bulkCreateSchema, bulkUpdateSchema, validateAndSanitize, sanitizeText } from '@/lib/validation/schemas';

const RSUPPORT_DOMAIN = 'rsupport.com';

// POST - Bulk create translations
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const { user } = await getAuthUser(supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate request
    const rawBody = await request.json();
    const validation = validateAndSanitize(bulkCreateSchema, rawBody);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const body = validation.data;
    const requestId = crypto.randomUUID();
    const originalTexts = (body.texts || []).map((text: string) => sanitizeText(text));

    // Create translation records
    const translations = (originalTexts || []).map((text: string, index: number) => ({
      source_text: text,
      context: body.context ? sanitizeText(body.context) : null,
      version: body.version || null,
      product_code: body.product_code || null,
      scope: body.scope || null,
      priority: body.priority || 'medium',
      user_id: user.id,
      status: 'pending' as const,
      request_id: requestId,
      completion_date: body.completion_date || null,
    }));

    const { data, error } = await adminClient
      .from('translations')
      .insert(translations)
      .select();

    if (error || !data) {
      console.error('Insert error:', error);
      return NextResponse.json({ error: '번역 항목 생성에 실패했습니다.' }, { status: 500 });
    }

    // Create translation_products links
    if (body.product_code) {
      const translationProducts = data.map((translation: any) => ({
        translation_id: translation.id,
        product_code: body.product_code,
      }));
      await adminClient.from('translation_products').insert(translationProducts);
    }

    // Create translation results for each language
    const languages = body.languages || [];
    const allLanguages = languages.includes('ko') ? languages : ['ko', ...languages];

    const translationResults = data.flatMap((translation: any, index: number) =>
      (allLanguages || []).map(lang => ({
        translation_id: translation.id,
        language_code: lang,
        translated_text: lang === 'ko' ? originalTexts[index] : '',
      }))
    );

    await adminClient.from('translation_results').insert(translationResults);

    // Auto-translate with glossary and AI
    let warning: string | null = null;
    
    try {
      // Apply glossary translations
      const { data: glossaryTerms } = await adminClient
        .from('glossary')
        .select('*')
        .eq('approval_status', 'approved')
        .in('language_code', allLanguages);

      // Apply glossary matches
      if (glossaryTerms && glossaryTerms.length > 0) {
        const glossaryUpdates: any[] = [];
        
        for (let i = 0; i < (data || []).length; i++) {
          const translationId = data[i].id;
          const koText = originalTexts[i];
          
          for (const lang of allLanguages) {
            if (lang === 'ko') continue;
            
            const term = glossaryTerms.find((g: any) => 
              g.language_code === lang && 
              (g.term === koText || koText.includes(g.term))
            );
            
            if (term) {
              glossaryUpdates.push({
                translation_id: translationId,
                language_code: lang,
                translated_text: term.translation,
                source_type: 'glossary',
                glossary_term_id: term.id,
              });
            }
          }
        }
        
        if (glossaryUpdates.length > 0) {
          await adminClient.from('translation_results').upsert(glossaryUpdates, {
            onConflict: 'translation_id,language_code',
          });
        }
      }

      // AI Translation for remaining empty translations
      const { data: orgSettings } = await adminClient
        .from('organization_settings')
        .select('*')
        .eq('domain', RSUPPORT_DOMAIN)
        .maybeSingle();

      const providerOrder: AIProvider[] = orgSettings?.settings?.ai_provider_order || 
        ['openai', 'claude', 'kimi', 'gemini'];

      // Find available provider
      let apiKey: string | null = null;
      let selectedProvider: AIProvider | null = null;

      for (const provider of providerOrder) {
        const keyField = `${provider}_api_key` as keyof typeof orgSettings;
        if (orgSettings?.[keyField]) {
          apiKey = orgSettings[keyField] as string;
          selectedProvider = provider;
          break;
        }
      }

      // Fallback to env variables
      if (!apiKey && process.env.OPENAI_API_KEY) {
        apiKey = process.env.OPENAI_API_KEY;
        selectedProvider = 'openai';
      }
      if (!apiKey && process.env.KIMI_API_KEY) {
        apiKey = process.env.KIMI_API_KEY;
        selectedProvider = 'kimi';
      }

      if (apiKey && selectedProvider) {
        console.log(`🤖 Bulk AI Translation: ${selectedProvider.toUpperCase()}`);
        
        // Find texts needing AI translation
        const filledTranslations = new Set(
          (glossaryTerms || []).map((g: any) => `${g.translation_id}_${g.language_code}`)
        );

        for (let i = 0; i < data.length; i++) {
          const translationId = data[i].id;
          const koText = originalTexts[i];
          const emptyLanguages = (allLanguages || []).filter(
            lang => lang !== 'ko' && !filledTranslations.has(`${translationId}_${lang}`)
          ) as LanguageCode[];

          if ((emptyLanguages || []).length === 0) continue;

          try {
            const aiResults = await translateWithProvider(selectedProvider, {
              sourceText: koText,
              context: body.context || null,
              targetLanguages: emptyLanguages,
              glossaryTerms: glossaryTerms || [],
              apiKey,
            });

            for (const result of aiResults) {
              await adminClient
                .from('translation_results')
                .upsert({
                  translation_id: translationId,
                  language_code: result.languageCode,
                  translated_text: result.translatedText,
                  source_type: 'ai',
                }, {
                  onConflict: 'translation_id,language_code',
                });
            }
          } catch (aiError) {
            console.error(`AI translation error for "${koText}":`, aiError);
            warning = `${selectedProvider.toUpperCase()} 번역 중 오류가 발생했습니다.`;
          }
        }
      } else {
        warning = 'AI 번역을 사용할 수 없습니다. API 키를 설정해주세요.';
      }
    } catch (autoTransError) {
      console.error('Auto-translation error:', autoTransError);
      warning = '자동 번역 중 오류가 발생했습니다.';
    }

    // Create audit logs - fetch user profile for accurate name
    const { data: userProfile } = await adminClient
      .from('users')
      .select('name')
      .eq('id', user.id)
      .single();
    
    await adminClient.from('translation_audit_logs').insert(
      (data || []).map((t: any) => ({
        translation_id: t.id,
        user_id: user.id,
        user_name: userProfile?.name || null,
        user_email: user.email || 'unknown',
        action: 'create',
        new_value: t.source_text,
      }))
    );

    const response: any = {
      success: true,
      created: (data || []).length,
      translations: data,
      request_id: requestId,
    };
    
    if (warning) {
      response.warning = warning;
    }

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('Bulk create error:', error);
    return NextResponse.json(
      { error: '번역 일괄 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE - Bulk delete translations
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user } = await getAuthUser(supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json({ error: '삭제할 항목을 선택해주세요.' }, { status: 400 });
    }

    const { ids } = body;

    // Get old values for audit log
    const { data: oldData } = await supabase
      .from('translations')
      .select('id, source_text')
      .in('id', ids);

    // Delete translation results first (foreign key constraint)
    await supabase
      .from('translation_results')
      .delete()
      .in('translation_id', ids);

    // Delete translations
    const { data, error } = await supabase
      .from('translations')
      .delete()
      .in('id', ids)
      .select();

    if (error) throw error;

    // Create audit logs
    if (oldData) {
      await supabase.from('translation_audit_logs').insert(
        oldData.map((t: any) => ({
          translation_id: t.id,
          user_id: user.id,
          action: 'delete',
          old_value: t.source_text,
        }))
      );
    }

    return NextResponse.json({ success: true, deleted: data?.length || 0 });

  } catch (error) {
    console.error('Bulk delete error:', error);
    return NextResponse.json(
      { error: '번역 일괄 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// PATCH - Bulk update status
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user } = await getAuthUser(supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawBody = await request.json();
    const validation = validateAndSanitize(bulkUpdateSchema, rawBody);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { ids, status } = validation.data;

    // Get old values for audit log
    const { data: oldData } = await supabase
      .from('translations')
      .select('id, status')
      .in('id', ids);

    const { data, error } = await supabase
      .from('translations')
      .update({ status })
      .in('id', ids)
      .select();

    if (error) throw error;

    // Create audit logs
    if (data && oldData) {
      await supabase.from('translation_audit_logs').insert(
        data.map((t: any) => {
          const old = oldData.find((o: any) => o.id === t.id);
          return {
            translation_id: t.id,
            user_id: user.id,
            action: 'update',
            field_name: 'status',
            old_value: old?.status,
            new_value: status,
          };
        })
      );
    }

    return NextResponse.json({ success: true, updated: data.length });

  } catch (error) {
    console.error('Bulk update error:', error);
    return NextResponse.json(
      { error: '번역 상태 변경에 실패했습니다.' },
      { status: 500 }
    );
  }
}
