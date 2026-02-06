import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SUPPORTED_LANGUAGES, ProductCode } from '@/types';

interface ImportRow {
  source_text: string;
  context?: string;
  status?: string;
  scope?: 'SaaS' | 'Solution';
  dev_code?: string;
  [key: string]: string | undefined;
}

// POST - Import translations from CSV
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

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const productCode = formData.get('product_code') as ProductCode | null;
    const version = formData.get('version') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'CSV 파일을 업로드해주세요.' }, { status: 400 });
    }

    if (!productCode) {
      return NextResponse.json({ error: '제품을 선택해주세요.' }, { status: 400 });
    }

    const text = await file.text();
    const rows = parseCSV(text);

    if (rows.length === 0) {
      return NextResponse.json({ error: '유효한 데이터가 없습니다.' }, { status: 400 });
    }

    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    const validLanguages = Object.keys(SUPPORTED_LANGUAGES);
    const versionUpdatedAt = version ? new Date().toISOString() : null;

    for (const row of rows) {
      if (!row.source_text?.trim()) {
        results.skipped++;
        continue;
      }

      try {
        // Check if translation already exists
        const { data: existing } = await supabase
          .from('translations')
          .select('id, version')
          .eq('source_text', row.source_text.trim())
          .single();

        if (existing) {
          // Version-based accumulation: Update version and add to translation_products
          if (version && version !== existing.version) {
            // Update the translation's version
            const { error: updateError } = await supabase
              .from('translations')
              .update({
                version: version.trim(),
                version_updated_at: versionUpdatedAt,
              })
              .eq('id', existing.id);

            if (updateError) throw updateError;

            // Check if product link already exists
            const { data: existingProduct } = await supabase
              .from('translation_products')
              .select('id')
              .eq('translation_id', existing.id)
              .eq('product_code', productCode)
              .single();

            // Add to translation_products if not already linked
            if (!existingProduct) {
              await supabase.from('translation_products').insert({
                translation_id: existing.id,
                product_code: productCode,
                version: version?.trim() || null,
                version_updated_at: versionUpdatedAt,
              });
            }

            // Create audit log
            await supabase.from('translation_audit_logs').insert({
              translation_id: existing.id,
              user_id: user.id,
              user_name: userProfile?.name,
              user_email: userProfile?.email || user.email,
              action: 'update',
              field_name: 'version',
              old_value: existing.version,
              new_value: version,
            });

            results.updated++;
          } else {
            results.skipped++;
          }
          continue;
        }

        // Validate status
        const status = ['pending', 'reviewed', 'deployed'].includes(row.status || '')
          ? row.status
          : 'pending';

        // Parse scope from category
        const scope = row.scope === 'SaaS' || row.scope === 'Solution' ? row.scope : null;

        // Create translation
        const { data: translation, error: insertError } = await supabase
          .from('translations')
          .insert({
            source_text: row.source_text.trim(),
            context: row.context?.trim() || null,
            status,
            version: version?.trim() || null,
            version_updated_at: versionUpdatedAt,
            product_code: productCode,
            scope,
            dev_code: row.dev_code?.trim() || null,
            user_id: user.id,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Create translation_products link
        if (productCode && version) {
          await supabase.from('translation_products').insert({
            translation_id: translation.id,
            product_code: productCode,
            version: version.trim(),
            version_updated_at: versionUpdatedAt,
          });
        }

        // Create audit log
        await supabase.from('translation_audit_logs').insert({
          translation_id: translation.id,
          user_id: user.id,
          user_name: userProfile?.name,
          user_email: userProfile?.email || user.email,
          action: 'create',
          new_value: row.source_text.trim(),
        });

        // Insert translation results for each language column
        const translationResults = [];
        for (const langCode of validLanguages) {
          if (row[langCode]?.trim()) {
            translationResults.push({
              translation_id: translation.id,
              language_code: langCode,
              translated_text: row[langCode]!.trim(),
            });
          }
        }

        if (translationResults.length > 0) {
          const { error: resultsError } = await supabase
            .from('translation_results')
            .insert(translationResults);

          if (resultsError) {
            console.error('Error inserting results:', resultsError);
          }
        }

        results.created++;
      } catch (error) {
        console.error('Error importing row:', error);
        results.errors.push(`"${row.source_text.slice(0, 30)}..." - 가져오기 실패`);
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('Error importing translations:', error);
    return NextResponse.json(
      { error: '가져오기 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

function parseCSV(text: string): ImportRow[] {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  // Parse header with enhanced field mapping
  const header = parseCSVLine(lines[0]);

  // Find source_text column
  const sourceIndex = header.findIndex((h) => {
    const normalized = h.toLowerCase().trim();
    return normalized === 'source_text' ||
      normalized === 'source' ||
      normalized === '원문' ||
      normalized === '원문 (ko)';
  });

  if (sourceIndex === -1) {
    throw new Error('source_text 열을 찾을 수 없습니다.');
  }

  // Create column mapping for enhanced fields
  const columnMapping: Record<string, string> = {};
  header.forEach((h, idx) => {
    const normalized = h.toLowerCase().trim();

    // Map Korean headers to English field names
    if (normalized === '분류' || normalized === 'category') {
      columnMapping[idx] = 'scope';
    } else if (normalized === 'key' || normalized === 'dev_code') {
      columnMapping[idx] = 'dev_code';
    } else if (normalized === '설명' || normalized === 'description' || normalized === '문맥' || normalized === 'context') {
      columnMapping[idx] = 'context';
    } else if (normalized === '상태' || normalized === 'status') {
      columnMapping[idx] = 'status';
    } else if (normalized === 'english' || normalized === 'en') {
      columnMapping[idx] = 'en';
    } else if (normalized === '日本語' || normalized === 'ja' || normalized === 'japanese') {
      columnMapping[idx] = 'ja';
    } else if (normalized === '中文(简体)' || normalized === 'zh-cn' || normalized === 'chinese simplified') {
      columnMapping[idx] = 'zh-CN';
    } else if (normalized === '中文(繁體)' || normalized === 'zh-tw' || normalized === 'chinese traditional') {
      columnMapping[idx] = 'zh-TW';
    } else if (normalized === '한국어' || normalized === 'ko' || normalized === 'korean') {
      columnMapping[idx] = 'ko';
    } else if (normalized === 'español' || normalized === 'es' || normalized === 'spanish') {
      columnMapping[idx] = 'es';
    } else if (normalized === 'français' || normalized === 'fr' || normalized === 'french') {
      columnMapping[idx] = 'fr';
    } else if (normalized === 'deutsch' || normalized === 'de' || normalized === 'german') {
      columnMapping[idx] = 'de';
    }
  });

  // Parse rows
  const rows: ImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: ImportRow = {
      source_text: values[sourceIndex] || '',
    };

    // Map other columns using the enhanced mapping
    Object.keys(columnMapping).forEach((idx) => {
      const numIdx = parseInt(idx);
      if (numIdx !== sourceIndex && values[numIdx]) {
        const fieldName = columnMapping[idx];
        row[fieldName] = values[numIdx];
      }
    });

    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}
