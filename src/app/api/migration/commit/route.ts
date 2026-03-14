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

// 제품 분류 자동 추가 함수
async function ensureProductCategory(
  adminClient: ReturnType<typeof createAdminClient>,
  category: string | undefined
): Promise<void> {
  if (!category?.trim()) return;
  
  const normalizedCode = category.trim().toLowerCase().replace(/\s+/g, '_');
  const normalizedName = category.trim();
  
  try {
    // scopes 테이블에 없으면 자동 추가
    const { error } = await adminClient
      .from('scopes')
      .upsert({
        code: normalizedCode,
        name: normalizedName,
        sort_order: 999,
        is_auto_generated: true,
        source: 'migration',
        type: 'product_category'
      }, { 
        onConflict: 'code',
        ignoreDuplicates: false // 업데이트 허용
      });
    
    if (error) {
      console.error('[Migration] Failed to ensure product category:', error);
    } else {
      console.log('[Migration] Product category ensured:', normalizedName);
    }
  } catch (err) {
    console.error('[Migration] Error ensuring product category:', err);
  }
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
  
  // Track start time for timeout detection
  const startTime = Date.now();
  const TIMEOUT_WARNING_MS = 25000; // Warn at 25 seconds (before typical 30s timeout)

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
          .maybeSingle();
        
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
      .maybeSingle();

    if (profileError) {
      console.error('[Migration] Failed to fetch user profile:', profileError);
      return NextResponse.json({ error: '사용자 정보를 가져올 수 없습니다.' }, { status: 500 });
    }

    // Check if user has admin or manager role (roles is an array)
    const userRoles = userProfile?.roles || [];
    if (!userRoles.includes('admin') && !userRoles.includes('manager') && !userRoles.includes('1st_master') && !userRoles.includes('master')) {
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
      // Simple mode temporarily disabled to prevent HTTP deadlock
      return NextResponse.json({ 
        error: '간단 모드는 현재 사용할 수 없습니다. 고급 모드를 사용해주세요.'
      }, { status: 503 });
    } else {
      // Advanced mode: Use provided entries
      const body = await request.json();
      entries = body.entries;
      product_code = body.product_code;
      version = body.version;
      
      // NEW: 선택 항목만 마이그레이션 (entry_ids가 제공되면 해당 항목만 필터링)
      const selectedIds: string[] | undefined = body.entry_ids;
      if (selectedIds && selectedIds.length > 0) {
        entries = entries.filter((e: CommitEntry) => selectedIds.includes(e.id));
        console.log(`[Migration] Filtered to ${entries.length} selected entries from ${body.entries.length} total`);
      }

      if (!entries || entries.length === 0) {
        return NextResponse.json({ error: '처리할 항목이 없습니다.' }, { status: 400 });
      }

      if (!product_code) {
        return NextResponse.json({ error: '제품을 선택해주세요.' }, { status: 400 });
      }
    }

    // Validate product_code exists in products table
    console.log('[Migration] Validating product_code:', product_code, 'type:', typeof product_code);
    
    // FIXED: Ensure product_code is a string and trim whitespace
    const normalizedProductCode = typeof product_code === 'string' ? product_code.trim() : String(product_code);
    
    if (!normalizedProductCode) {
      return NextResponse.json({ 
        error: '제품 코드가 유효하지 않습니다.',
        details: '제품 코드가 비어있거나 유효하지 않은 형식입니다.'
      }, { status: 400 });
    }
    
    const { data: productExists, error: productCheckError } = await adminClient
      .from('products')
      .select('code')
      .eq('code', normalizedProductCode)
      .maybeSingle();
    
    if (productCheckError) {
      console.error('[Migration] Failed to check product_code:', productCheckError);
      return NextResponse.json({ 
        error: '제품 코드 확인 중 오류가 발생했습니다.' 
      }, { status: 500 });
    }
    
    if (!productExists) {
      console.error(`[Migration] Product code "${normalizedProductCode}" does not exist in products table`);
      
      // DEBUG: List available products
      const { data: availableProducts } = await adminClient
        .from('products')
        .select('code, name')
        .limit(10);
      console.error('[Migration] Available products:', availableProducts);
      
      return NextResponse.json({ 
        error: '제품 코드가 존재하지 않습니다.',
        details: `입력하신 제품 코드 "${normalizedProductCode}"는 시스템에 등록되지 않은 코드입니다. 먼저 제품 관리에서 해당 제품을 추가해주세요.`,
        availableProducts: availableProducts?.map(p => p.code) || []
      }, { status: 400 });
    }
    
    // Use normalized product_code for all subsequent operations
    product_code = normalizedProductCode as ProductCode;

    // Log start of processing
    const glossaryEntries = entries.filter((e) => e.category === 'glossary');
    const translationEntries = entries.filter((e) => e.category === 'translation');
    console.log(`[Migration] Starting processing: ${entries.length} entries`);
    console.log(`[Migration] Glossary: ${glossaryEntries.length}, Translations: ${translationEntries.length}`);

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
    const { data: batch, error: batchError } = await adminClient
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

    // Process glossary entries
    for (let i = 0; i < glossaryEntries.length; i++) {
      const entry = glossaryEntries[i];

      if (entry.action === 'skip') {
        results.glossary.skipped++;
        continue;
      }

      try {
        // Progress logging every 10 entries
        if (i % 10 === 0) {
          console.log(`[Migration] Processing glossary entry ${i + 1}/${glossaryEntries.length}`);
        }

        // Check for timeout warning
        if (Date.now() - startTime > TIMEOUT_WARNING_MS) {
          console.warn(`[Migration] Approaching timeout! Processed ${i}/${glossaryEntries.length} glossary entries`);
        }

        // For each language, create or update glossary entry
        for (const [langCode, translation] of Object.entries(entry.translations)) {
          if (!translation?.trim()) continue;

          // Check if entry already exists - use maybeSingle() to handle no results gracefully
          const { data: existing, error: existingError } = await adminClient
            .from('glossary')
            .select('id, translation')
            .eq('term', entry.source_text)
            .eq('language_code', langCode)
            .maybeSingle();
          
          if (existingError) {
            console.error(`[Migration] Error checking existing glossary for "${entry.source_text}":`, existingError);
          }

          if (existing) {
            if (entry.action === 'overwrite') {
              // Update existing entry
              await adminClient
                .from('glossary')
                .update({
                  translation: translation.trim(),
                  context: entry.context || null,
                })
                .eq('id', existing.id);
              
              // Create audit log for glossary update (non-blocking)
              void adminClient.from('glossary_audit_logs').insert({
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
          const { data: glossaryData, error: glossaryError } = await adminClient
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
          const { data: glossaryProductData, error: glossaryProductError } = await adminClient
            .from('glossary_products')
            .insert({
              glossary_id: glossaryData.id,
              product_code: product_code,
              version: version || null,
              // Note: product_category column needs to be added to DB schema
              // product_category: entry.product_category || null,
            })
            .select()
            .single();
            
          if (glossaryProductError) throw new Error(glossaryProductError.message || 'Database error');
          
          // FIXED: Track created glossary_product ID for rollback
          createdIds.glossaryProducts.push(glossaryProductData.id);
          
          // Create audit log for glossary creation (non-blocking)
          void adminClient.from('glossary_audit_logs').insert({
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
        const errorMessage = error instanceof Error ? error.message : '가져오기 실패';
        
        // Check for FK constraint violation
        if (errorMessage.includes('violates foreign key constraint') || 
            errorMessage.includes('translation_products_product_code_fkey') ||
            errorMessage.includes('glossary_products_product_code_fkey')) {
          await rollbackOperations(adminClient, createdIds, batchId);
          return NextResponse.json({
            error: '제품 코드가 존재하지 않습니다.',
            details: `입력하신 제품 코드 "${product_code}"는 시스템에 등록되지 않은 코드입니다.`,
            results,
          }, { status: 400 });
        }
        
        results.glossary.errors.push({
          row: i + 1,
          message: errorMessage,
        });
        
        // FIXED: Rollback on error (Issue #6)
        await rollbackOperations(adminClient, createdIds, batchId);
        return NextResponse.json({
          error: '마이그레이션 중 오류가 발생했습니다. 변경사항이 롤백되었습니다.',
          details: errorMessage,
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

      // 각 translation entry 처리 전에 제품 분류 확인
      if (entry.product_category) {
        await ensureProductCategory(adminClient, entry.product_category);
      }

      try {
        // Progress logging every 10 entries
        if (i % 10 === 0) {
          console.log(`[Migration] Processing translation entry ${i + 1}/${translationEntries.length}`);
        }

        // Check for timeout warning
        if (Date.now() - startTime > TIMEOUT_WARNING_MS) {
          console.warn(`[Migration] Approaching timeout! Processed ${i}/${translationEntries.length} translation entries`);
        }

        // Check if translation already exists - use maybeSingle() to handle no results gracefully
        const { data: existing, error: existingError } = await adminClient
          .from('translations')
          .select('id, translation_results(*)')
          .eq('source_text', entry.source_text)
          .maybeSingle();
        
        if (existingError) {
          console.error(`[Migration] Error checking existing translation for "${entry.source_text}":`, existingError);
        }

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
                  await adminClient
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
                const { data: trData, error: trError } = await adminClient
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
            void adminClient.from('translation_audit_logs').insert({
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
        const { data: translation, error: translationError } = await adminClient
          .from('translations')
          .insert({
            source_text: entry.source_text,
            context: entry.context || null,
            status: 'reviewed', // 번역 완료 상태로 저장 (DB 제약조건: reviewed, deployed 등)
            version: version || null,
            version_updated_at: version ? new Date().toISOString() : null,
            product_code: product_code, // 제품 코드 설정
            user_id: userId,
            // Note: is_migrated column does not exist in DB yet
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
          }));

        if (translationResults.length > 0) {
          const { data: trResults, error: trError } = await adminClient
            .from('translation_results')
            .insert(translationResults)
            .select();
            
          if (trError) throw trError;
          
          // FIXED: Track created translation_result IDs for rollback
          trResults?.forEach((r) => createdIds.translationResults.push(r.id));
        }

        // Link to product
        console.log('[Migration] Linking translation to product:', { translation_id: translation.id, product_code });
        
        const { data: tpData, error: tpError } = await adminClient
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
          
        if (tpError) {
          console.error('[Migration] Failed to link translation to product:', {
            error: tpError,
            translation_id: translation.id,
            product_code,
          });
          throw new Error(tpError.message || 'Database error');
        }
        
        // FIXED: Track created translation_product ID for rollback
        createdIds.translationProducts.push(tpData.id);

        // Create audit log (non-blocking)
        void adminClient.from('translation_audit_logs').insert({
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
        const errorMessage = error instanceof Error ? error.message : '가져오기 실패';
        
        // Check for FK constraint violation
        if (errorMessage.includes('violates foreign key constraint') || 
            errorMessage.includes('translation_products_product_code_fkey') ||
            errorMessage.includes('glossary_products_product_code_fkey')) {
          await rollbackOperations(adminClient, createdIds, batchId);
          return NextResponse.json({
            error: '제품 코드가 존재하지 않습니다.',
            details: `입력하신 제품 코드 "${product_code}"는 시스템에 등록되지 않은 코드입니다.`,
            results,
          }, { status: 400 });
        }
        
        results.translations.errors.push({
          row: i + 1,
          message: errorMessage,
        });
        
        // FIXED: Rollback on error (Issue #6)
        await rollbackOperations(adminClient, createdIds, batchId);
        return NextResponse.json({
          error: '마이그레이션 중 오류가 발생했습니다. 변경사항이 롤백되었습니다.',
          details: errorMessage,
          results,
        }, { status: 500 });
      }
    }

    // Update batch status to completed
    if (batchId) {
      void adminClient.from('operation_batches').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      }).eq('id', batchId);
    }

    const processingTime = Date.now() - startTime;
    console.log(`[Migration] Completed processing ${entries.length} entries in ${processingTime}ms`);
    console.log(`[Migration] Results: Glossary created=${results.glossary.created}, skipped=${results.glossary.skipped}, errors=${results.glossary.errors.length}`);
    console.log(`[Migration] Results: Translations created=${results.translations.created}, updated=${results.translations.updated}, skipped=${results.translations.skipped}, errors=${results.translations.errors.length}`);

    return NextResponse.json({
      success: true,
      batchId,
      processingTimeMs: processingTime,
      ...results,
    });
  } catch (error) {
    console.error('Error committing migration:', error);
    
    // FIXED: Attempt rollback on unexpected error (Issue #6)
    if (batchId || createdIds.glossary.length > 0 || createdIds.translations.length > 0) {
      try {
        const adminClient = createAdminClient();
        await rollbackOperations(adminClient, createdIds, batchId);
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
  adminClient: ReturnType<typeof createAdminClient>,
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
      await adminClient.from('translation_results').delete().in('id', createdIds.translationResults);
    }
    
    // Delete translation_products
    if (createdIds.translationProducts.length > 0) {
      await adminClient.from('translation_products').delete().in('id', createdIds.translationProducts);
    }
    
    // Delete translations
    if (createdIds.translations.length > 0) {
      await adminClient.from('translations').delete().in('id', createdIds.translations);
    }
    
    // Delete glossary_products
    if (createdIds.glossaryProducts.length > 0) {
      await adminClient.from('glossary_products').delete().in('id', createdIds.glossaryProducts);
    }
    
    // Delete glossary
    if (createdIds.glossary.length > 0) {
      await adminClient.from('glossary').delete().in('id', createdIds.glossary);
    }
    
    // Update batch status to failed
    if (batchId) {
      await adminClient.from('operation_batches').update({
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
