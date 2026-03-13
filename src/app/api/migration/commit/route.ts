import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { ProductCode } from '@/types';

interface CommitEntry {
  id: string;
  source_text: string;
  context?: string;
  product_category?: string;
  translations: Record<string, string>;
  category: 'glossary' | 'translation';
  action: 'import' | 'skip' | 'merge' | 'overwrite';
}

// POST - Commit migration data
export async function POST(request: NextRequest) {
  // FIXED: Track created IDs for rollback
  const createdIds = {
    glossary: [] as string[],
    glossaryProducts: [] as string[],
    translations: [] as string[],
    translationProducts: [] as string[],
    translationResults: [] as string[],
  };
  
  let batchId: string | null = null;

  try {
    const supabase = await createClient();
    let { data: { user }, error: authError } = await supabase.auth.getUser();

    // Development mode: fetch a real user from DB for bypass
    if ((authError || !user) && process.env.NODE_ENV === 'development' && process.env.ALLOW_AUTH_BYPASS === 'true') {
      console.log('[Migration] DEV MODE: Attempting auth bypass');
      
      try {
        const adminClient = createAdminClient();
        const { data: existingUser } = await adminClient
          .from('users')
          .select('id, email')
          .eq('email', process.env.DEV_BYPASS_EMAIL || 'admin@example.com')
          .single();
        
        if (existingUser) {
          console.warn('[SECURITY] Auth bypass used in development mode', {
            endpoint: 'commit',
            userEmail: existingUser.email,
            timestamp: new Date().toISOString()
          });
          console.log('[Migration] DEV MODE: Using existing user from DB:', existingUser.email);
          user = { id: existingUser.id, email: existingUser.email } as typeof user;
          authError = null;
        }
      } catch (bypassError) {
        console.error('[Migration] DEV MODE: Bypass failed:', bypassError);
      }
    }

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // FIXED: User permission validation (Issue #7)
    // Use admin client to bypass RLS for user role lookup
    const adminClient = createAdminClient();
    const { data: userProfile, error: profileError } = await adminClient
      .from('users')
      .select('roles, name, email')
      .eq('id', user!.id)
      .single();

    if (profileError) {
      console.error('[Migration] Failed to fetch user profile:', profileError);
      return NextResponse.json({ error: '사용자 정보를 가져올 수 없습니다.' }, { status: 500 });
    }

    // Check if user has admin or manager role (roles is an array)
    const userRoles = userProfile?.roles || [];
    if (!userRoles.includes('admin') && !userRoles.includes('manager') && !userRoles.includes('1st_master')) {
      return NextResponse.json({ error: '권한이 부족합니다.' }, { status: 403 });
    }
    // FIXED: End of permission validation

    const userId = user!.id;
    const userEmail = user!.email;

    // Check if this is simple mode (FormData) or advanced mode (JSON)
    const conte[기밀마스킹]ype = request.headers.get('content-type');
    const isSimpleMode = conte[기밀마스킹]ype?.includes('multipart/form-data');

    let entries: CommitEntry[];
    let product_code: ProductCode;
    let version: string | undefined;

    if (isSimpleMode) {
      // Simple mode: Parse file and auto-process
      const formData = await request.formData();
      const file = formData.get('file') as File;
      product_code = formData.get('product_code') as ProductCode;

      if (!file) {
        return NextResponse.json({ error: '파일을 선택해주세요.' }, { status: 400 });
      }

      if (!product_code) {
        return NextResponse.json({ error: '제품을 선택해주세요.' }, { status: 400 });
      }

      // Parse the file and create entries (reuse preview logic)
      const previewFormData = new FormData();
      previewFormData.append('file', file);
      previewFormData.append('product_code', product_code);

      // Call preview internally
      const baseUrl = request.nextUrl.origin;
      const previewResponse = await fetch(`${baseUrl}/api/migration/preview`, {
        method: 'POST',
        body: previewFormData,
        headers: {
          // Forward auth headers
          cookie: request.headers.get('cookie') || '',
        },
      });

      if (!previewResponse.ok) {
        const error = await previewResponse.json();
        console.error('❌ [간단 모드 API] Preview 실패:', error);
        return NextResponse.json({ error: error.error || '파일 처리 중 오류가 발생했습니다.' }, { status: 400 });
      }

      const previewData = await previewResponse.json();

      // Auto-process: import new items, skip exact duplicates
      interface PreviewEntry {
        suggested_category: 'glossary' | 'translation';
        duplicate_status: { status: string };
        product?: string;
        [key: string]: unknown;
      }
      entries = previewData.entries.map((entry: PreviewEntry) => ({
        ...entry,
        category: entry.suggested_category,
        action: entry.duplicate_status.status === 'exact' ? 'skip' : 'import',
        product_category: entry.product,
      }));
    } else {
      // Advanced mode: Use provided entries
      const body = await request.json();
      entries = body.entries;
      product_code = body.product_code;
      version = body.version;

      if (!entries || entries.length === 0) {
        return NextResponse.json({ error: '처리할 항목이 없습니다.' }, { status: 400 });
      }

      if (!product_code) {
        return NextResponse.json({ error: '제품을 선택해주세요.' }, { status: 400 });
      }
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
    
    // Create operation batch for rollback support
    const { data: batch, error: batchError } = await supabase
      .from('operation_batches')
      .insert({
        operation_type: 'migration',
        user_id: userId,
        user_name: userProfile?.name,
        description: `Migration to ${product_code}${version ? ` (v${version})` : ''}`,
        affected_count: entries.filter(e => e.action !== 'skip').length,
        status: 'running',
      })
      .select()
      .single();
    
    if (batchError) {
      console.error('[Migration] Failed to create batch:', batchError);
      // Continue without batch - rollback won't be available
    }
    
    batchId = batch?.id || null;

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
              
              // Create audit log for glossary update (non-blocking)
              void supabase.from('glossary_audit_logs').insert({
                glossary_term_id: existing.id,
                user_id: userId,
                user_name: userProfile?.name,
                user_email: userProfile?.email || userEmail,
                action: 'update',
                field_name: 'translation',
                old_value: existing.translation,
                new_value: translation.trim(),
                batch_operation_id: batchId,
              }).then(({ error }) => {
                if (error) {
                  console.error('[Audit Log] Failed to log glossary update:', error);
                }
              });
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
              user_id: userId,
            })
            .select()
            .single();

          if (glossaryError) throw new Error(glossaryError.message || 'Database error');
          
          // FIXED: Track created ID for rollback (Issue #6)
          createdIds.glossary.push(glossaryData.id);

          // Link to product
          const { data: glossaryProductData, error: glossaryProductError } = await supabase
            .from('glossary_products')
            .insert({
              glossary_id: glossaryData.id,
              product_code: product_code,
              version: version || null,
              product_category: entry.product_category || null,
            })
            .select()
            .single();
            
          if (glossaryProductError) throw new Error(glossaryProductError.message || 'Database error');
          
          // FIXED: Track created glossary_product ID for rollback
          createdIds.glossaryProducts.push(glossaryProductData.id);
          
          // Create audit log for glossary creation (non-blocking)
          void supabase.from('glossary_audit_logs').insert({
            glossary_term_id: glossaryData.id,
            user_id: userId,
            user_name: userProfile?.name,
            user_email: userProfile?.email || userEmail,
            action: 'create',
            field_name: 'migration',
            new_value: 'Glossary term migrated from Excel',
            batch_operation_id: batchId,
          }).then(({ error }) => {
            if (error) {
              console.error('[Audit Log] Failed to log glossary creation:', error);
            }
          });
        }

        results.glossary.created++;
      } catch (error) {
        console.error('Error importing glossary entry:', error);
        results.glossary.errors.push({
          row: i + 1,
          message: error instanceof Error ? error.message : '가져오기 실패',
        });
        
        // FIXED: Rollback on error (Issue #6)
        await rollbackOperations(supabase, createdIds, batchId);
        return NextResponse.json({
          error: '마이그레이션 중 오류가 발생했습니다. 변경사항이 롤백되었습니다.',
          details: error instanceof Error ? error.message : 'Unknown error',
          results,
        }, { status: 500 });
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
            interface TranslationResultItem {
              language_code: string;
            }
            const existingLangCodes = new Set(
              existing.translation_results.map((tr: TranslationResultItem) => tr.language_code)
            );

            // Add or update translation results
            for (const [langCode, translatedText] of Object.entries(entry.translations)) {
              if (!translatedText?.trim()) continue;

              if (existingLangCodes.has(langCode)) {
                if (entry.action === 'overwrite') {
                  // Update existing translation
                  interface TranslationResultWithId extends TranslationResultItem {
                    id: string;
                  }
                  const existingResult = existing.translation_results.find(
                    (tr: TranslationResultWithId) => tr.language_code === langCode
                  );
                  await supabase
                    .from('translation_results')
                    .update({
                      translated_text: translatedText.trim(),
                      reviewer_id: userId,
                      reviewed_at: new Date().toISOString(),
                    })
                    .eq('id', existingResult.id);
                }
                // For 'merge', keep existing translation
              } else {
                // Add new language translation
                const { data: trData, error: trError } = await supabase
                  .from('translation_results')
                  .insert({
                    translation_id: existing.id,
                    language_code: langCode,
                    translated_text: translatedText.trim(),
                    reviewer_id: userId,
                    reviewed_at: new Date().toISOString(),
                  })
                  .select()
                  .single();
                  
                if (trError) throw new Error(trError.message || 'Database error');
                
                // FIXED: Track created translation_result ID for rollback
                createdIds.translationResults.push(trData.id);
              }
            }

            // Create audit log for merge/overwrite (non-blocking)
            void supabase.from('translation_audit_logs').insert({
              translation_id: existing.id,
              user_id: userId,
              user_name: userProfile?.name,
              user_email: userProfile?.email || userEmail,
              action: 'update',
              field_name: 'migration',
              new_value: `Data ${entry.action} from migration`,
              batch_operation_id: batchId,
            }).then(({ error }) => {
              if (error) {
                console.error('[Audit Log] Failed to log migration update:', error);
              }
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
            status: 'completed', // 번역 완료 상태로 저장
            version: version || null,
            version_updated_at: version ? new Date().toISOString() : null,
            product_code: product_code, // 제품 코드 설정
            user_id: userId,
            // Note: is_migrated column needs to be added to DB schema
            // is_migrated: true,
          })
          .select()
          .single();

        if (translationError) throw new Error(translationError.message || 'Database error');
        
        // FIXED: Track created translation ID for rollback
        createdIds.translations.push(translation.id);

        // Create translation results for each language
        const translationResults = Object.entries(entry.translations)
          .filter(([_, text]) => text?.trim())
          .map(([langCode, text]) => ({
            translation_id: translation.id,
            language_code: langCode,
            translated_text: text.trim(),
            reviewer_id: userId,
            reviewed_at: new Date().toISOString(),
            status: 'completed', // 번역 완료 상태
          }));

        if (translationResults.length > 0) {
          const { data: trResults, error: trError } = await supabase
            .from('translation_results')
            .insert(translationResults)
            .select();
            
          if (trError) throw trError;
          
          // FIXED: Track created translation_result IDs for rollback
          trResults?.forEach((r) => createdIds.translationResults.push(r.id));
        }

        // Link to product
        const { data: tpData, error: tpError } = await supabase
          .from('translation_products')
          .insert({
            translation_id: translation.id,
            product_code: product_code,
            version: version || null,
            version_updated_at: version ? new Date().toISOString() : null,
            product_category: entry.product_category || null,
          })
          .select()
          .single();
          
        if (tpError) throw new Error(tpError.message || 'Database error');
        
        // FIXED: Track created translation_product ID for rollback
        createdIds.translationProducts.push(tpData.id);

        // Create audit log (non-blocking)
        void supabase.from('translation_audit_logs').insert({
          translation_id: translation.id,
          user_id: userId,
          user_name: userProfile?.name,
          user_email: userProfile?.email || userEmail,
          action: 'create',
          field_name: 'migration',
          new_value: 'Data migrated from Excel',
          batch_operation_id: batchId,
        }).then(({ error }) => {
          if (error) {
            console.error('[Audit Log] Failed to log migration creation:', error);
          }
        });

        results.translations.created++;
      } catch (error) {
        console.error('Error importing translation entry:', error);
        results.translations.errors.push({
          row: i + 1,
          message: error instanceof Error ? error.message : '가져오기 실패',
        });
        
        // FIXED: Rollback on error (Issue #6)
        await rollbackOperations(supabase, createdIds, batchId);
        return NextResponse.json({
          error: '마이그레이션 중 오류가 발생했습니다. 변경사항이 롤백되었습니다.',
          details: error instanceof Error ? error.message : 'Unknown error',
          results,
        }, { status: 500 });
      }
    }

    // Update batch status to completed
    if (batchId) {
      void supabase.from('operation_batches').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      }).eq('id', batchId);
    }

    return NextResponse.json({
      success: true,
      batchId,
      ...results,
    });
  } catch (error) {
    console.error('Error committing migration:', error);
    
    // FIXED: Attempt rollback on unexpected error (Issue #6)
    if (batchId || createdIds.glossary.length > 0 || createdIds.translations.length > 0) {
      try {
        const supabase = await createClient();
        await rollbackOperations(supabase, createdIds, batchId);
      } catch (rollbackError) {
        console.error('[Migration] Rollback failed:', rollbackError);
      }
    }
    
    return NextResponse.json(
      { error: '마이그레이션 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// FIXED: Rollback function for transaction support (Issue #6)
async function rollbackOperations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  createdIds: {
    glossary: string[];
    glossaryProducts: string[];
    translations: string[];
    translationProducts: string[];
    translationResults: string[];
  },
  batchId: string | null
) {
  console.log('[Migration] Starting rollback...');
  
  try {
    // Delete in reverse order of creation to respect foreign keys
    
    // Delete translation_results
    if (createdIds.translationResults.length > 0) {
      await supabase.from('translation_results').delete().in('id', createdIds.translationResults);
    }
    
    // Delete translation_products
    if (createdIds.translationProducts.length > 0) {
      await supabase.from('translation_products').delete().in('id', createdIds.translationProducts);
    }
    
    // Delete translations
    if (createdIds.translations.length > 0) {
      await supabase.from('translations').delete().in('id', createdIds.translations);
    }
    
    // Delete glossary_products
    if (createdIds.glossaryProducts.length > 0) {
      await supabase.from('glossary_products').delete().in('id', createdIds.glossaryProducts);
    }
    
    // Delete glossary
    if (createdIds.glossary.length > 0) {
      await supabase.from('glossary').delete().in('id', createdIds.glossary);
    }
    
    // Update batch status to failed
    if (batchId) {
      await supabase.from('operation_batches').update({
        status: 'failed',
        completed_at: new Date().toISOString(),
      }).eq('id', batchId);
    }
    
    console.log('[Migration] Rollback completed successfully');
  } catch (error) {
    console.error('[Migration] Rollback error:', error);
    throw error;
  }
}
