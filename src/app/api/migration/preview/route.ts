import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SUPPORTED_LANGUAGES, ProductCode } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import type { SupabaseClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

interface PreviewEntry {
  id: string;
  source_text: string;
  context?: string;
  product?: string;
  platform?: string;
  version?: string;
  key?: string;
  note?: string;
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
    const fieldMappingsRaw = formData.get('field_mappings') as string | null;
    // Empty string means "ALL" products (common terms)
    const productCode = productCodeRaw && productCodeRaw.trim() !== '' ? productCodeRaw as ProductCode : null;

    if (!file) {
      return NextResponse.json({ error: 'CSV 파일을 업로드해주세요.' }, { status: 400 });
    }

    // Parse field mappings
    let fieldMappings: { source: string | null; translations: string[]; metadata: Record<string, string> } | null = null;
    if (fieldMappingsRaw) {
      try {
        fieldMappings = JSON.parse(fieldMappingsRaw);
        console.log('[Preview API] Field mappings parsed:', fieldMappings);
      } catch (e) {
        console.error('[Preview API] Failed to parse field mappings:', e);
        return NextResponse.json(
          { error: '필드 매핑 정보를 파싱할 수 없습니다.', details: String(e) },
          { status: 400 }
        );
      }
    } else {
      console.log('[Preview API] No field mappings provided');
    }

    // Debug logging
    console.log('[Preview API] File name:', file.name);
    console.log('[Preview API] File size:', file.size);
    
    // Get selected version (sheet name)
    const selectedVersion = formData.get('version') as string | null;
    console.log('[Preview API] Selected version (sheet):', selectedVersion);
    
    let rows: ImportRow[];
    const fileName = file.name.toLowerCase();
    
    try {
      if (fileName.endsWith('.csv')) {
        // CSV 파일 처리
        const text = await file.text();
        console.log('[Preview API] Parsing as CSV');
        rows = parseCSV(text, fieldMappings);
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        // Excel 파일 처리
        console.log('[Preview API] Parsing as Excel');
        rows = await parseExcel(file, selectedVersion, fieldMappings);
      } else {
        return NextResponse.json(
          { error: '지원하지 않는 파일 형식입니다. CSV 또는 Excel(.xlsx, .xls) 파일을 업로드해주세요.' },
          { status: 400 }
        );
      }
      
      console.log('[Preview API] Parsed rows count:', rows.length);
      if (rows.length > 0) {
        console.log('[Preview API] First row:', rows[0]);
      }
    } catch (parseError) {
      console.error('[Preview API] Parse error:', parseError);
      return NextResponse.json(
        { error: '파일 파싱 중 오류가 발생했습니다.', details: parseError instanceof Error ? parseError.message : String(parseError) },
        { status: 400 }
      );
    }

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
        product: row.product || row.product_category || undefined,
        platform: row.platform || undefined,
        version: row.version || undefined,
        key: row.key || row.id || row.key_id || undefined,
        note: row.note || row.description || undefined,
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: '미리보기 중 오류가 발생했습니다.', details: errorMessage },
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

function parseCSV(
  text: string, 
  fieldMappings: { source: string | null; translations: string[]; metadata: Record<string, string> } | null
): ImportRow[] {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  console.log('[parseCSV] Total lines:', lines.length);
  
  if (lines.length < 2) {
    console.log('[parseCSV] Not enough lines (need at least header + 1 data row)');
    return [];
  }

  const header = parseCSVLine(lines[0]);
  console.log('[parseCSV] Header:', header);

  let sourceIndex: number;
  const columnMapping: Record<string, string> = {};

  if (fieldMappings && fieldMappings.source) {
    // Use field mappings from client
    console.log('[parseCSV] Looking for source field:', fieldMappings.source);
    sourceIndex = header.findIndex((h) => h.trim() === fieldMappings.source);
    console.log('[parseCSV] Source index found:', sourceIndex);
    
    if (sourceIndex === -1) {
      throw new Error(`원문 필드 "${fieldMappings.source}"를 찾을 수 없습니다. 사용 가능한 필드: ${header.join(', ')}`);
    }

    // Map translation fields
    console.log('[parseCSV] Mapping translations:', fieldMappings.translations);
    fieldMappings.translations.forEach((transField) => {
      const idx = header.findIndex((h) => h.trim() === transField);
      console.log(`[parseCSV] Looking for translation field "${transField}" at index:`, idx);
      if (idx !== -1) {
        // Extract language code from field name (e.g., "KO" from "KO Translation" or just "KO")
        const langMatch = transField.match(/^(ko|en|ja|zh-CN|zh-TW|es|de|pt|fr)/i);
        if (langMatch) {
          columnMapping[idx] = langMatch[0].toLowerCase();
          console.log(`[parseCSV] Mapped column ${idx} to language:`, langMatch[0].toLowerCase());
        } else {
          console.log(`[parseCSV] Could not extract language code from:`, transField);
        }
      } else {
        console.log(`[parseCSV] Translation field "${transField}" not found in header`);
      }
    });
    console.log('[parseCSV] Final column mapping:', columnMapping);

    // Map metadata fields
    Object.entries(fieldMappings.metadata).forEach(([key, fieldName]) => {
      const idx = header.findIndex((h) => h.trim() === fieldName);
      if (idx !== -1) {
        columnMapping[idx] = key;
      }
    });
  } else {
    // Legacy: Auto-detect columns
    sourceIndex = header.findIndex((h) => {
      const normalized = h.toLowerCase().trim();
      return normalized === 'source_text' ||
        normalized === 'source' ||
        normalized === '원문' ||
        normalized === '원문 (ko)';
    });

    if (sourceIndex === -1) {
      throw new Error('source_text 열을 찾을 수 없습니다.');
    }

    // Auto-detect language columns
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
  }

  // Parse rows
  const rows: ImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const sourceText = values[sourceIndex] || '';
    
    // Skip empty rows
    if (!sourceText.trim()) {
      continue;
    }
    
    const row: ImportRow = {
      source_text: sourceText,
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

  console.log('[parseCSV] Total parsed rows:', rows.length);
  if (rows.length > 0) {
    console.log('[parseCSV] Sample row:', rows[0]);
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
/**
 * Parse Excel file and return rows
 * Supports field mappings for column selection
 */
async function parseExcel(
  file: File, 
  selectedVersion: string | null,
  fieldMappings: { source: string | null; translations: string[]; metadata: Record<string, string> } | null
): Promise<ImportRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  
  console.log('[parseExcel] Available sheets:', workbook.SheetNames);
  console.log('[parseExcel] Selected version:', selectedVersion);
  
  // Determine which sheet to parse
  let sheetName: string;
  
  if (selectedVersion && workbook.SheetNames.includes(selectedVersion)) {
    // Use the selected version as the sheet name
    sheetName = selectedVersion;
  } else if (workbook.SheetNames.length === 1) {
    // If only one sheet, use it
    sheetName = workbook.SheetNames[0];
  } else if (workbook.SheetNames.length > 1) {
    // Multiple sheets but no selection - use first one (or could error)
    sheetName = workbook.SheetNames[0];
    console.log('[parseExcel] Warning: Multiple sheets found, using first sheet:', sheetName);
  } else {
    throw new Error('Excel 파일에 시트가 없습니다.');
  }
  
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error(`시트 "${sheetName}"를 찾을 수 없습니다.`);
  }
  
  // Convert to JSON with headers
  const jsonData: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { 
    header: 1,
    blankrows: false,
    defval: ''
  });
  
  if (!jsonData || jsonData.length < 2) {
    throw new Error('Excel 파일에 데이터가 없거나 헤더만 있습니다.');
  }
  
  const headers = jsonData[0] as string[];
  console.log('[parseExcel] Headers:', headers);
  console.log('[parseExcel] Total rows:', jsonData.length - 1);
  
  // Use field mappings if provided, otherwise auto-detect
  const columnMapping: Record<string, number> = {};
  
  if (fieldMappings && fieldMappings.source) {
    // Map source column
    const sourceIndex = headers.findIndex(h => 
      h?.toString().trim() === fieldMappings.source || 
      h?.toString().trim().toLowerCase() === fieldMappings.source?.toLowerCase()
    );
    
    if (sourceIndex === -1) {
      throw new Error(`원문 필드 "${fieldMappings.source}"를 찾을 수 없습니다. 사용 가능한 필드: ${headers.join(', ')}`);
    }
    columnMapping['source'] = sourceIndex;
    
    // Map translation columns - extract language code from column name or detect from sample data
    console.log('[parseExcel] Headers for mapping:', headers);
    fieldMappings.translations.forEach((field) => {
      if (field) {
        const fieldIndex = headers.findIndex(h => 
          h?.toString().trim() === field || 
          h?.toString().trim().toLowerCase() === field.toLowerCase()
        );
        console.log(`[parseExcel] Looking for field "${field}" -> found at index ${fieldIndex}`);
        if (fieldIndex !== -1) {
          let langCode: string;
          
          // 번역 언어 매핑 - 실제 데이터 2~3줄로 언어 감지
          const samples: string[] = [];
          for (let i = 1; i < jsonData.length && samples.length < 3; i++) {
            const rowData = jsonData[i] as (string | number | null | undefined)[];
            const value = rowData[fieldIndex]?.toString();
            if (value && value.trim()) {
              samples.push(value.trim());
            }
          }
          langCode = detectLanguageFromSamples(samples);
          
          // 중복 langCode 체크
          const mappingKey = `translation_${langCode}`;
          if (columnMapping[mappingKey] !== undefined) {
            console.log(`[parseExcel] WARNING: Duplicate langCode "${langCode}" for field "${field}". Previous field index: ${columnMapping[mappingKey]}, New: ${fieldIndex}`);
          }
          columnMapping[mappingKey] = fieldIndex;
          console.log(`[parseExcel] Mapped translation field "${field}" -> key: "${mappingKey}", index: ${fieldIndex}`);
        }
      }
    });
    
    // Map metadata columns
    Object.entries(fieldMappings.metadata).forEach(([key, field]) => {
      if (field) {
        const fieldIndex = headers.findIndex(h => 
          h?.toString().trim() === field || 
          h?.toString().trim().toLowerCase() === field.toLowerCase()
        );
        if (fieldIndex !== -1) {
          columnMapping[key] = fieldIndex;
        }
      }
    });
  } else {
    // Auto-detect columns
    headers.forEach((header, idx) => {
      if (!header) return;
      const normalized = header.toString().trim().toLowerCase();
      
      if (normalized === 'values' || normalized === 'source' || normalized === 'en' || 
          normalized === 'english' || normalized === 'source_text' || 
          normalized === '원문' || normalized === 'key' || 
          normalized === 'en-us' || normalized === 'en_us') {
        columnMapping['source'] = idx;
      } else if (normalized.startsWith('ko') || normalized.includes('korean') || 
                 normalized.includes('한국어') || normalized.includes('kor')) {
        columnMapping['translation_0'] = idx;
      } else if (normalized.startsWith('ja') || normalized.includes('japanese') || 
                 normalized.includes('日本語') || normalized.includes('jpn')) {
        columnMapping['translation_1'] = idx;
      } else if (normalized.includes('zh') || normalized.includes('chinese') || 
                 normalized.includes('中文')) {
        if (normalized.includes('tw') || normalized.includes('hk') || 
            normalized.includes('traditional') || normalized.includes('繁體')) {
          columnMapping['translation_3'] = idx;
        } else {
          columnMapping['translation_2'] = idx;
        }
      } else if (normalized.startsWith('es') || normalized.includes('spanish') || 
                 normalized.includes('español') || normalized.includes('spa')) {
        columnMapping['translation_4'] = idx;
      } else if (normalized.startsWith('fr') || normalized.includes('french') || 
                 normalized.includes('français') || normalized.includes('fra')) {
        columnMapping['translation_5'] = idx;
      } else if (normalized.startsWith('de') || normalized.includes('german') || 
                 normalized.includes('deutsch') || normalized.includes('deu')) {
        columnMapping['translation_6'] = idx;
      } else if (normalized === 'context' || normalized.includes('desc') || 
                 normalized.includes('description') || normalized.includes('설명')) {
        columnMapping['context'] = idx;
      } else if (normalized === 'platform' || normalized.includes('platform')) {
        columnMapping['platform'] = idx;
      } else if (normalized === 'product' || normalized.includes('product')) {
        columnMapping['product'] = idx;
      } else if (normalized === 'version' || normalized.includes('version')) {
        columnMapping['version'] = idx;
      }
    });
  }
  
  console.log('[parseExcel] Column mapping:', columnMapping);
  
  if (columnMapping['source'] === undefined) {
    throw new Error(`원문 필드를 찾을 수 없습니다. 사용 가능한 필드: ${headers.filter(h => h).join(', ')}`);
  }
  
  // Parse rows
  const rows: ImportRow[] = [];
  for (let i = 1; i < jsonData.length; i++) {
    const rowData = jsonData[i] as (string | number | null | undefined)[];
    const sourceText = rowData[columnMapping['source']]?.toString() || '';
    
    // Skip empty rows
    if (!sourceText.trim()) {
      continue;
    }
    
    const row: ImportRow = {
      source_text: sourceText,
    };
    
    // Add translations - key format is "translation_{langCode}" (e.g., "translation_ko")
    Object.entries(columnMapping).forEach(([key, idx]) => {
      if (key.startsWith('translation_')) {
        const value = rowData[idx]?.toString();
        if (value) {
          const langCode = key.replace('translation_', '');
          row[langCode] = value;
        }
      } else if (key !== 'source') {
        const value = rowData[idx]?.toString();
        if (value) {
          row[key] = value;
        }
      }
    });
    
    rows.push(row);
  }
  
  console.log('[parseExcel] Total parsed rows:', rows.length);
  if (rows.length > 0) {
    console.log('[parseExcel] Sample row:', rows[0]);
  }
  
  return rows;
}

/**
 * Extract language code from column name (for non-source fields)
 */
function extractLanguageCode(columnName: string): string {
  const normalized = columnName.toLowerCase().trim();
  
  // Common patterns
  if (normalized.includes('ko') || normalized.includes('korean')) return 'ko';
  if (normalized.includes('ja') || normalized.includes('japanese') || normalized.includes('日本語')) return 'ja';
  if (normalized.includes('zh-cn') || normalized.includes('hans') || normalized.includes('simplified') || normalized.includes('简体')) return 'zh-CN';
  if (normalized.includes('zh-tw') || normalized.includes('hant') || normalized.includes('traditional') || normalized.includes('繁體')) return 'zh-TW';
  if (normalized.includes('en') || normalized.includes('english')) return 'en';
  if (normalized.includes('es') || normalized.includes('spanish')) return 'es';
  if (normalized.includes('fr') || normalized.includes('french')) return 'fr';
  if (normalized.includes('de') || normalized.includes('german') || normalized.includes('deutsch')) return 'de';
  
  // Last segment fallback
  const segments = normalized.split(/[-_]/);
  const last = segments[segments.length - 1];
  if (/^[a-z]{2,3}$/.test(last)) return last;
  
  return normalized;
}


/**
 * Detect language from sample text data
 * Analyzes first 2-3 rows to determine the language
 */
function detectLanguageFromSamples(samples: string[]): string {
  if (samples.length === 0) return 'unknown';
  
  const combinedText = samples.join(' ');
  
  // 1. 명확한 문자셋 체크 (한국어, 일본어, 중국어)
  const hasKorean = /[\uAC00-\uD7AF]/.test(combinedText);  // 완성형 한글만 체크
  const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF]/.test(combinedText);  // 히라가나/가타칸나
  const hasChinese = /[\u4E00-\u9FFF]/.test(combinedText);  // 한자
  
  if (hasKorean) return 'ko';
  if (hasJapanese) return 'ja';
  if (hasChinese) return 'zh-CN';
  
  // 2. Latin 문자 비율로 영어 판단
  const latinChars = combinedText.match(/[a-zA-Z]/g) || [];
  const totalChars = combinedText.replace(/\s/g, '').length;
  const latinRatio = totalChars > 0 ? latinChars.length / totalChars : 0;
  
  if (latinRatio > 0.5) return 'en';
  
  return 'unknown';
}
