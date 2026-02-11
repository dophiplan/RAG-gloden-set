import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SUPPORTED_LANGUAGES, ProductCode } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import type { SupabaseClient } from '@supabase/supabase-js';

interface PreviewEntry {
  id: string;
  source_text: string;
  context?: string;
  translations: Record<string, string>;
  suggested_category: 'glossary' | 'translation';
  word_count: number;
  duplicate_status: {
    status: 'exact' | 'similar' | 'new';
    similarity?: number;
    existing_id?: string;
    existing_translations?: Record<string, string>;
  };
}

interface ImportRow {
  source_text: string;
  context?: string;
  [key: string]: string | undefined;
}

// POST - Preview migration data
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const productCodeRaw = formData.get('product_code') as string | null;
    // Empty string means "ALL" products (common terms)
    const productCode = productCodeRaw && productCodeRaw.trim() !== '' ? productCodeRaw as ProductCode : null;

    if (!file) {
      return NextResponse.json({ error: 'CSV 파일을 업로드해주세요.' }, { status: 400 });
    }

    const text = await file.text();
    const rows = parseCSV(text);

    if (rows.length === 0) {
      return NextResponse.json({ error: '유효한 데이터가 없습니다.' }, { status: 400 });
    }

    const entries: PreviewEntry[] = [];
    const validLanguages = Object.keys(SUPPORTED_LANGUAGES);
    let glossarySuggested = 0;
    let translationSuggested = 0;
    let exactMatches = 0;
    let similarMatches = 0;
    let newEntries = 0;

    for (const row of rows) {
      if (!row.source_text?.trim()) {
        continue;
      }

      const sourceText = row.source_text.trim();
      const context = row.context?.trim() || undefined;

      // Extract translations from language columns
      const translations: Record<string, string> = {};
      for (const langCode of validLanguages) {
        if (row[langCode]?.trim()) {
          translations[langCode] = row[langCode]!.trim();
        }
      }

      // Calculate word count (for auto-classification)
      const wordCount = sourceText.split(/\s+/).length;
      const suggestedCategory: 'glossary' | 'translation' = wordCount <= 3 ? 'glossary' : 'translation';

      if (suggestedCategory === 'glossary') {
        glossarySuggested++;
      } else {
        translationSuggested++;
      }

      // Check for duplicates
      const duplicateStatus = await checkDuplicates(supabase, sourceText, suggestedCategory, translations);

      if (duplicateStatus.status === 'exact') {
        exactMatches++;
      } else if (duplicateStatus.status === 'similar') {
        similarMatches++;
      } else {
        newEntries++;
      }

      entries.push({
        id: uuidv4(),
        source_text: sourceText,
        context,
        translations,
        suggested_category: suggestedCategory,
        word_count: wordCount,
        duplicate_status: duplicateStatus,
      });
    }

    return NextResponse.json({
      entries,
      summary: {
        total: entries.length,
        glossary_suggested: glossarySuggested,
        translation_suggested: translationSuggested,
        exact_matches: exactMatches,
        similar_matches: similarMatches,
        new_entries: newEntries,
      },
    });
  } catch (error) {
    console.error('Error previewing migration:', error);
    return NextResponse.json(
      { error: '미리보기 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

async function checkDuplicates(
  supabase: SupabaseClient,
  sourceText: string,
  category: 'glossary' | 'translation',
  translations: Record<string, string>
) {
  if (category === 'glossary') {
    // Check in glossary table
    // For glossary, check if the term exists in any language
    const { data: existing } = await supabase
      .from('glossary')
      .select('id, term, translation, language_code')
      .eq('term', sourceText)
      .limit(1);

    if (existing && existing.length > 0) {
      // Exact match found
      const existingTranslations: Record<string, string> = {};

      // Fetch all translations for this term
      const { data: allTranslations } = await supabase
        .from('glossary')
        .select('language_code, translation')
        .eq('term', sourceText);

      if (allTranslations) {
        interface GlossaryTranslation {
          language_code: string;
          translation: string;
        }
        allTranslations.forEach((t: GlossaryTranslation) => {
          existingTranslations[t.language_code] = t.translation;
        });
      }

      return {
        status: 'exact' as const,
        existing_id: existing[0].id,
        existing_translations: existingTranslations,
      };
    }

    // Check for similar terms (fuzzy matching)
    const { data: similarTerms } = await supabase
      .from('glossary')
      .select('id, term, translation, language_code')
      .ilike('term', `%${sourceText}%`)
      .neq('term', sourceText)
      .limit(3);

    if (similarTerms && similarTerms.length > 0) {
      const similarity = calculateSimilarity(sourceText, similarTerms[0].term);
      if (similarity > 0.7) {
        return {
          status: 'similar' as const,
          similarity,
          existing_id: similarTerms[0].id,
        };
      }
    }
  } else {
    // Check in translations table
    const { data: existing } = await supabase
      .from('translations')
      .select('id, source_text, translation_results(*)')
      .eq('source_text', sourceText)
      .single();

    if (existing) {
      // Exact match found
      const existingTranslations: Record<string, string> = {};
      if (existing.translation_results) {
        interface TranslationResultItem {
          language_code: string;
          translated_text: string;
        }
        existing.translation_results.forEach((tr: TranslationResultItem) => {
          existingTranslations[tr.language_code] = tr.translated_text;
        });
      }

      return {
        status: 'exact' as const,
        existing_id: existing.id,
        existing_translations: existingTranslations,
      };
    }

    // Check for similar translations
    const { data: similarTranslations } = await supabase
      .from('translations')
      .select('id, source_text')
      .ilike('source_text', `%${sourceText.substring(0, 20)}%`)
      .neq('source_text', sourceText)
      .limit(3);

    if (similarTranslations && similarTranslations.length > 0) {
      const similarity = calculateSimilarity(sourceText, similarTranslations[0].source_text);
      if (similarity > 0.7) {
        return {
          status: 'similar' as const,
          similarity,
          existing_id: similarTranslations[0].id,
        };
      }
    }
  }

  return {
    status: 'new' as const,
  };
}

function calculateSimilarity(str1: string, str2: string): number {
  // Simple Levenshtein distance-based similarity
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  return maxLen === 0 ? 1 : 1 - distance / maxLen;
}

function parseCSV(text: string): ImportRow[] {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];

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

  // Create column mapping
  const columnMapping: Record<string, string> = {};
  header.forEach((h, idx) => {
    const normalized = h.toLowerCase().trim();

    if (normalized === '설명' || normalized === 'description' || normalized === '문맥' || normalized === 'context') {
      columnMapping[idx] = 'context';
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

    // Map other columns
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
