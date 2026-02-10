import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProductCode } from '@/types';

interface CommitEntry {
  id: string;
  source_text: string;
  context?: string;
  translations: Record<string, string>;
  category: 'glossary' | 'translation';
  action: 'import' | 'skip' | 'merge' | 'overwrite';
}

// POST - Commit migration data
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // Get user profile for audit log
    const { data: userProfile } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', user.id)
      .single();

    const body = await request.json();
    const { entries, product_code, version } = body as {
      entries: CommitEntry[];
      product_code: ProductCode;
      version?: string;
    };

    if (!entries || entries.length === 0) {
      return NextResponse.json({ error: '처리할 항목이 없습니다.' }, { status: 400 });
    }

    if (!product_code) {
      return NextResponse.json({ error: '제품을 선택해주세요.' }, { status: 400 });
    }

    const results = {
      glossary: {
        created: 0,
        skipped: 0,
        errors: [] as { row: number; message: string }[],
      },
      translations: {
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [] as { row: number; message: string }[],
      },
    };

    // Separate entries by category
    const glossaryEntries = entries.filter((e) => e.category === 'glossary');
    const translationEntries = entries.filter((e) => e.category === 'translation');

    // Process glossary entries
    for (let i = 0; i < glossaryEntries.length; i++) {
      const entry = glossaryEntries[i];

      if (entry.action === 'skip') {
        results.glossary.skipped++;
        continue;
      }

      try {
        // For each language, create or update glossary entry
        for (const [langCode, translation] of Object.entries(entry.translations)) {
          if (!translation?.trim()) continue;

          // Check if entry already exists
          const { data: existing } = await supabase
            .from('glossary')
            .select('id, translation')
            .eq('term', entry.source_text)
            .eq('language_code', langCode)
            .single();

          if (existing) {
            if (entry.action === 'overwrite') {
              // Update existing entry
              await supabase
                .from('glossary')
                .update({
                  translation: translation.trim(),
                  context: entry.context || null,
                })
                .eq('id', existing.id);
            }
            // For 'merge', we keep the existing entry (skip)
            continue;
          }

          // Create new glossary entry
          const { data: glossaryData, error: glossaryError } = await supabase
            .from('glossary')
            .insert({
              term: entry.source_text,
              translation: translation.trim(),
              language_code: langCode,
              context: entry.context || null,
              user_id: user.id,
            })
            .select()
            .single();

          if (glossaryError) throw glossaryError;

          // Link to product
          await supabase.from('glossary_products').insert({
            glossary_id: glossaryData.id,
            product_code: product_code,
            version: version || null,
          });
        }

        results.glossary.created++;
      } catch (error: any) {
        console.error('Error importing glossary entry:', error);
        results.glossary.errors.push({
          row: i + 1,
          message: error.message || '가져오기 실패',
        });
      }
    }

    // Process translation entries
    for (let i = 0; i < translationEntries.length; i++) {
      const entry = translationEntries[i];

      if (entry.action === 'skip') {
        results.translations.skipped++;
        continue;
      }

      try {
        // Check if translation already exists
        const { data: existing } = await supabase
          .from('translations')
          .select('id, translation_results(*)')
          .eq('source_text', entry.source_text)
          .single();

        if (existing) {
          if (entry.action === 'merge' || entry.action === 'overwrite') {
            // Get existing language codes
            const existingLangCodes = new Set(
              existing.translation_results.map((tr: any) => tr.language_code)
            );

            // Add or update translation results
            for (const [langCode, translatedText] of Object.entries(entry.translations)) {
              if (!translatedText?.trim()) continue;

              if (existingLangCodes.has(langCode)) {
                if (entry.action === 'overwrite') {
                  // Update existing translation
                  const existingResult = existing.translation_results.find(
                    (tr: any) => tr.language_code === langCode
                  );
                  await supabase
                    .from('translation_results')
                    .update({
                      translated_text: translatedText.trim(),
                      reviewer_id: user.id,
                      reviewed_at: new Date().toISOString(),
                    })
                    .eq('id', existingResult.id);
                }
                // For 'merge', keep existing translation
              } else {
                // Add new language translation
                await supabase.from('translation_results').insert({
                  translation_id: existing.id,
                  language_code: langCode,
                  translated_text: translatedText.trim(),
                  reviewer_id: user.id,
                  reviewed_at: new Date().toISOString(),
                });
              }
            }

            // Create audit log for merge/overwrite
            await supabase.from('translation_audit_logs').insert({
              translation_id: existing.id,
              user_id: user.id,
              user_name: userProfile?.name,
              user_email: userProfile?.email || user.email,
              action: 'update',
              field_name: 'migration',
              new_value: `Data ${entry.action} from migration`,
            });

            results.translations.updated++;
          } else {
            results.translations.skipped++;
          }
          continue;
        }

        // Create new translation
        const { data: translation, error: translationError } = await supabase
          .from('translations')
          .insert({
            source_text: entry.source_text,
            context: entry.context || null,
            status: 'reviewed', // Migrated data is considered reviewed
            version: version || null,
            version_updated_at: version ? new Date().toISOString() : null,
            product_code: product_code,
            user_id: user.id,
            is_migrated: true,
          })
          .select()
          .single();

        if (translationError) throw translationError;

        // Create translation results for each language
        const translationResults = Object.entries(entry.translations)
          .filter(([_, text]) => text?.trim())
          .map(([langCode, text]) => ({
            translation_id: translation.id,
            language_code: langCode,
            translated_text: text.trim(),
            reviewer_id: user.id,
            reviewed_at: new Date().toISOString(),
          }));

        if (translationResults.length > 0) {
          await supabase.from('translation_results').insert(translationResults);
        }

        // Link to product
        await supabase.from('translation_products').insert({
          translation_id: translation.id,
          product_code: product_code,
          version: version || null,
          version_updated_at: version ? new Date().toISOString() : null,
        });

        // Create audit log
        await supabase.from('translation_audit_logs').insert({
          translation_id: translation.id,
          user_id: user.id,
          user_name: userProfile?.name,
          user_email: userProfile?.email || user.email,
          action: 'create',
          field_name: 'migration',
          new_value: 'Data migrated from Excel',
        });

        results.translations.created++;
      } catch (error: any) {
        console.error('Error importing translation entry:', error);
        results.translations.errors.push({
          row: i + 1,
          message: error.message || '가져오기 실패',
        });
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('Error committing migration:', error);
    return NextResponse.json(
      { error: '마이그레이션 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
