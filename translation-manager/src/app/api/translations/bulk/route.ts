import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { TranslationStatus, ProductCode, LanguageCode, Scope } from '@/types';
import { getAuthUser } from '@/lib/api-auth';
import { autoTranslate } from '@/lib/openai/auto-translate';
import { bulkCreateSchema, bulkUpdateSchema, validateAndSanitize, sanitizeText } from '@/lib/validation/schemas';
import { enforceRateLimit } from '@/lib/api/rate-limiter';

interface BulkUpdateInput {
  ids: string[];
  status: TranslationStatus;
}

interface BulkCreateInput {
  texts: string[];
  context?: string;
  version?: string;
  product_code?: ProductCode;
  scope?: Scope;
  priority?: string;
  languages?: LanguageCode[];
  completion_date?: string;
}

// POST - Bulk create translations
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, adminClient: authAdminClient } = await getAuthUser(supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check rate limit for bulk creation
    const rateLimitResult = await enforceRateLimit(user.id, 'bulk_create');
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    // Parse and validate request body
    const rawBody = await request.json();
    const validation = validateAndSanitize(bulkCreateSchema, rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const body = validation.data;

    // Generate unique request ID for this batch
    const requestId = crypto.randomUUID();

    // Always use admin client to bypass RLS for bulk operations
    let adminClient;
    try {
      adminClient = authAdminClient || createAdminClient();
    } catch (adminError) {
      console.error('❌ Failed to create admin client:', adminError);
      throw new Error('Failed to create admin client: ' + (adminError instanceof Error ? adminError.message : 'Unknown error'));
    }
    const db = adminClient;

    // Get user profile for audit log
    const { data: userProfile } = await db
      .from('users')
      .select('name, email')
      .eq('id', user.id)
      .single();

    const versionUpdatedAt = body.version ? new Date().toISOString() : null;

    // Store original texts for creating KO translation results
    // Already validated and trimmed by schema, but sanitize for safety
    const originalTexts = body.texts.map((text) => sanitizeText(text));

    const translations = originalTexts.map((text, index) => ({
      source_text: `key_${requestId.slice(0, 8)}_${index + 1}`, // Auto-generated key for developers
      context: body.context ? sanitizeText(body.context) : null,
      version: body.version ? sanitizeText(body.version) : null,
      version_updated_at: versionUpdatedAt,
      product_code: body.product_code || null,
      scope: body.scope || null,
      priority: body.priority || '중',
      user_id: user.id,
      status: 'pending' as const,
      request_id: requestId,
      completion_date: body.completion_date || null,
    }));

    const { data, error } = await db
      .from('translations')
      .insert(translations)
      .select();

    if (error) {
      console.error('Bulk insert error:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      console.error('Bulk insert returned no data');
      return NextResponse.json(
        { error: '번역 항목 생성에 실패했습니다.' },
        { status: 500 }
      );
    }

    // Create translation_products records if product_code is provided
    if (body.product_code && data && data.length > 0) {
      const translationProducts = data.map((t) => ({
        translation_id: t.id,
        product_code: body.product_code as ProductCode,
        version: body.version ? sanitizeText(body.version) : null,
        version_updated_at: versionUpdatedAt,
      }));

      const { error: productsError } = await db
        .from('translation_products')
        .insert(translationProducts);

      if (productsError) {
        console.error('Error creating translation_products:', productsError);
        // Don't fail the entire request, but log the error
      }
    }

    // Create translation_results for selected languages
    // Always include KO with the original text
    if (data && data.length > 0) {
      const languages = body.languages || [];
      // Ensure KO is always included
      const allLanguages = languages.includes('ko') ? languages : ['ko', ...languages];

      const translationResults = data.flatMap((translation, index) =>
        allLanguages.map(lang => ({
          translation_id: translation.id,
          language_code: lang,
          // Put original text in KO column, empty for other languages
          translated_text: lang === 'ko' ? originalTexts[index] : '',
        }))
      );

      const { error: resultsError } = await db
        .from('translation_results')
        .insert(translationResults);

      if (resultsError) {
        console.error('Error creating translation results:', resultsError);
        // Don't fail the whole operation, just log
      }

      // Auto-translate using glossary
      try {

        // Fetch glossary terms for the product (or all if no product)
        // Only use approved terms for auto-translation
        let glossaryQuery = db
          .from('glossary')
          .select('id, term, translation, language_code, product_code')
          .eq('approval_status', 'approved')
          .order('term', { ascending: false }); // Longer terms first for better matching

        if (body.product_code) {
          glossaryQuery = glossaryQuery.or(`product_code.eq.${body.product_code},product_code.is.null`);
        }

        const { data: glossaryTerms, error: glossaryError } = await glossaryQuery;

        if (glossaryError) {
          console.error('Glossary fetch error:', glossaryError);
        }

        // Declare updates outside the if block so it's accessible later
        const updates: Array<{
          translation_id: string;
          language_code: string;
          translated_text: string;
          source_type: string;
          glossary_term_id: string | null;
        }> = [];

        // Track hit count updates for batch processing
        const hitCountUpdates: Array<{ term: string; language_code: string }> = [];

        if (glossaryTerms && glossaryTerms.length > 0) {
          // For each translation, check for glossary matches and update

          for (let i = 0; i < data.length; i++) {
            const translationId = data[i].id;
            const koText = originalTexts[i];

            // Group glossary terms by language with term ID tracking
            const glossaryByLang = new Map<string, Map<string, { translation: string; id: string }>>();
            glossaryTerms.forEach(g => {
              if (!glossaryByLang.has(g.language_code)) {
                glossaryByLang.set(g.language_code, new Map());
              }
              glossaryByLang.get(g.language_code)!.set(g.term, {
                translation: g.translation,
                id: g.id,
              });
            });

            // For each language, check if the KO text matches any glossary term
            for (const lang of allLanguages) {
              if (lang === 'ko') continue; // Skip KO, it already has the original text

              const glossaryForLang = glossaryByLang.get(lang);
              if (!glossaryForLang) continue;

              // Priority 1: Exact match
              let matchedEntry = glossaryForLang.get(koText);
              let matchedTranslation = matchedEntry?.translation;
              let matchedGlossaryId = matchedEntry?.id || null;

              // Priority 2: If KO text is a single word/term found in glossary
              if (!matchedTranslation && koText.trim().length > 0) {
                matchedEntry = glossaryForLang.get(koText.trim());
                matchedTranslation = matchedEntry?.translation;
                matchedGlossaryId = matchedEntry?.id || null;
              }

              // Priority 3: Replace all glossary terms found in the text
              if (!matchedTranslation) {
                let translatedText = koText;
                let foundMatch = false;
                let firstMatchedId: string | null = null;

                // Sort terms by length (longest first) to avoid partial replacements
                const sortedTerms = Array.from(glossaryForLang.entries())
                  .sort((a, b) => b[0].length - a[0].length);

                for (const [term, entry] of sortedTerms) {
                  if (koText.includes(term)) {
                    translatedText = translatedText.replace(new RegExp(term, 'g'), entry.translation);
                    if (!foundMatch) {
                      firstMatchedId = entry.id; // Track the first matched term
                    }
                    foundMatch = true;
                  }
                }

                if (foundMatch) {
                  matchedTranslation = translatedText;
                  matchedGlossaryId = firstMatchedId;
                }
              }

              if (matchedTranslation) {
                updates.push({
                  translation_id: translationId,
                  language_code: lang,
                  translated_text: matchedTranslation,
                  source_type: 'glossary',
                  glossary_term_id: matchedGlossaryId,
                });

                // Collect hit count updates for batch processing
                hitCountUpdates.push({
                  term: koText,
                  language_code: lang
                });
              }
            }
          }

          // Batch increment hit counts in a single transaction
          if (hitCountUpdates.length > 0) {
            try {
              await db.rpc('batch_increment_glossary_hit_count', {
                p_updates: hitCountUpdates
              });
            } catch (hitCountError) {
              console.error('Error batch updating hit counts:', hitCountError);
              // Don't fail the whole operation
            }
          }

          // Batch update translation_results with glossary matches using upsert
          if (updates.length > 0) {
            try {
              await db
                .from('translation_results')
                .upsert(
                  updates.map(u => ({
                    translation_id: u.translation_id,
                    language_code: u.language_code,
                    translated_text: u.translated_text,
                    source_type: u.source_type,
                    glossary_term_id: u.glossary_term_id,
                  })),
                  {
                    onConflict: 'translation_id,language_code',
                    ignoreDuplicates: false
                  }
                );
            } catch (upsertError) {
              console.error('Error batch upserting translation results:', upsertError);
              // Fallback to sequential updates if upsert fails
              for (const update of updates) {
                await db
                  .from('translation_results')
                  .update({
                    translated_text: update.translated_text,
                    source_type: update.source_type,
                    glossary_term_id: update.glossary_term_id,
                  })
                  .eq('translation_id', update.translation_id)
                  .eq('language_code', update.language_code);
              }
            }
          }
        }

        // AI Translation fallback for empty translations
        try {

          // Get OpenAI API key with priority: organization > user > environment
          let apiKey: string | null = null;

          // Priority 1: Organization API key
          const { data: userProfile } = await db
            .from('users')
            .select('email')
            .eq('id', user.id)
            .single();

          if (userProfile?.email?.endsWith('@rsupport.com')) {
            const { data: orgSettings } = await db
              .from('organization_settings')
              .select('openai_api_key')
              .eq('domain', 'rsupport.com')
              .single();

            apiKey = orgSettings?.openai_api_key || null;
          }

          // Priority 2: Individual user API key
          if (!apiKey) {
            const { data: userSettings } = await db
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

          if (apiKey) {
            // Group updates by translation_id to track which were filled
            const filledTranslations = new Set(updates.map(u => `${u.translation_id}_${u.language_code}`));

            // Collect texts that need AI translation
            const aiTranslationNeeded: Array<{
              translationId: string;
              koText: string;
              languages: LanguageCode[];
            }> = [];

            for (let i = 0; i < data.length; i++) {
              const translationId = data[i].id;
              const koText = originalTexts[i];
              const emptyLanguages = allLanguages.filter(lang =>
                lang !== 'ko' && !filledTranslations.has(`${translationId}_${lang}`)
              ) as LanguageCode[];

              if (emptyLanguages.length > 0) {
                aiTranslationNeeded.push({
                  translationId,
                  koText,
                  languages: emptyLanguages,
                });
              }
            }

            if (aiTranslationNeeded.length > 0) {
              console.log(`🤖 AI translating ${aiTranslationNeeded.length} texts...`);

              // Collect all AI translation updates for batch processing
              const aiUpdates: Array<{
                translation_id: string;
                language_code: string;
                translated_text: string;
                source_type: string;
                glossary_term_id: null;
              }> = [];

              // Process in batches to avoid rate limits
              for (const item of aiTranslationNeeded) {
                try {
                  const aiResults = await autoTranslate({
                    sourceText: item.koText,
                    context: body.context || null,
                    targetLanguages: item.languages,
                    glossaryTerms: (glossaryTerms || []) as any,
                    apiKey,
                  });

                  // Collect AI translation results for batch update
                  for (const result of aiResults) {
                    aiUpdates.push({
                      translation_id: item.translationId,
                      language_code: result.languageCode,
                      translated_text: result.translatedText,
                      source_type: 'ai',
                      glossary_term_id: null,
                    });
                  }
                } catch (aiError) {
                  console.error('AI translation error for text:', item.koText.substring(0, 50), aiError);
                  // Continue with other texts even if one fails
                }
              }

              // Batch update all AI translations in a single upsert
              if (aiUpdates.length > 0) {
                try {
                  await db
                    .from('translation_results')
                    .upsert(aiUpdates, {
                      onConflict: 'translation_id,language_code',
                      ignoreDuplicates: false
                    });
                } catch (aiUpdateError) {
                  console.error('Error batch upserting AI translations:', aiUpdateError);
                  // Fallback to sequential updates if batch fails
                  for (const update of aiUpdates) {
                    try {
                      await db
                        .from('translation_results')
                        .update({
                          translated_text: update.translated_text,
                          source_type: update.source_type,
                          glossary_term_id: update.glossary_term_id,
                        })
                        .eq('translation_id', update.translation_id)
                        .eq('language_code', update.language_code);
                    } catch (err) {
                      console.error('Failed to update AI translation:', err);
                    }
                  }
                }
              }
            }
          }
        } catch (aiError) {
          console.error('❌ Error in AI auto-translation:', aiError);
          // Don't fail the whole operation
        }
      } catch (glossaryError) {
        console.error('❌ Error applying glossary auto-translation:', glossaryError);
        // Don't fail the whole operation
      }
    }

    // Create audit logs for all created translations
    if (data && data.length > 0) {
      const auditLogs = data.map((t) => ({
        translation_id: t.id,
        user_id: user.id,
        user_name: userProfile?.name,
        user_email: userProfile?.email || user.email,
        action: 'create' as const,
        new_value: t.source_text,
      }));

      await db.from('translation_audit_logs').insert(auditLogs);
    }

    return NextResponse.json({
      success: true,
      created: data.length,
      translations: data,
      request_id: requestId,
    }, { status: 201 });
  } catch (error) {
    console.error('❌ Error bulk creating translations:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      error: error
    });
    return NextResponse.json(
      {
        error: '번역을 일괄 생성하는데 실패했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
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

    // Check rate limit for bulk updates
    const rateLimitResult = await enforceRateLimit(user.id, 'bulk_update');
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    // Parse and validate request body
    const rawBody = await request.json();
    const validation = validateAndSanitize(bulkUpdateSchema, rawBody);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const body = validation.data;

    // Get user profile for audit log
    const { data: userProfile } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', user.id)
      .single();

    // Get old values for audit log
    const { data: oldData } = await supabase
      .from('translations')
      .select('id, status')
      .in('id', body.ids);

    const { data, error } = await supabase
      .from('translations')
      .update({ status: body.status })
      .in('id', body.ids)
      .select();

    if (error) throw error;

    // Create audit logs
    if (data && data.length > 0 && oldData) {
      const auditLogs = data.map((t) => {
        const old = oldData.find((o) => o.id === t.id);
        return {
          translation_id: t.id,
          user_id: user.id,
          user_name: userProfile?.name,
          user_email: userProfile?.email || user.email,
          action: 'update' as const,
          field_name: 'status',
          old_value: old?.status,
          new_value: body.status,
        };
      });

      await supabase.from('translation_audit_logs').insert(auditLogs);
    }

    return NextResponse.json({
      success: true,
      updated: data.length,
    });
  } catch (error) {
    console.error('Error bulk updating translations:', error);
    return NextResponse.json(
      { error: '번역 상태를 일괄 변경하는데 실패했습니다.' },
      { status: 500 }
    );
  }
}
