import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { SUPPORTED_LANGUAGES, ProductCode } from '@/types';

// Debug logging helper - only in development
const debug = process.env.NODE_ENV === 'development' 
  ? (...args: unknown[]) => console.log(...args)
  : () => {};
const debugError = process.env.NODE_ENV === 'development'
  ? (...args: unknown[]) => console.error(...args) 
  : () => {};
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
  product_category?: string;
  translations: Record<string, string>;
  suggested_category: 'glossary' | 'translation';
  word_count: number;
  duplicate_status: {
    status: 'exact' | 'similar' | 'new';
    similarity?: number;
    existing_id?: string;
    existing_translations?: Record<string, string>;
  };
  category?: 'glossary' | 'translation';
  existing_in_glossary: boolean;
  existing_in_translation: boolean;
}

interface ImportRow {
  source_text: string;
  context?: string;
  product_category?: string;
  [key: string]: string | undefined;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    let { data: { user }, error: authError } = await supabase.auth.getUser();

    // Development mode: fetch a real user from DB for bypass
    if ((authError || !user) && process.env.NODE_ENV === 'development' && process.env.ALLOW_AUTH_BYPASS === 'true') {
      debug('[Preview] DEV MODE: Attempting auth bypass');
      
      try {
        const adminClient = createAdminClient();
        const { data: existingUser } = await adminClient
          .from('users')
          .select('id, email')
          .eq('email', process.env.DEV_BYPASS_EMAIL || 'admin@example.com')
          .single();
        
        if (existingUser) {
          console.warn('[SECURITY] Auth bypass used in development mode', {
            endpoint: 'preview',
            userEmail: existingUser.email,
            timestamp: new Date().toISOString()
          });
          debug('[Preview] DEV MODE: Using existing user from DB:', existingUser.email);
          user = { id: existingUser.id, email: existingUser.email } as typeof user;
          authError = null;
        }
      } catch (bypassError) {
        debugError('[Preview] DEV MODE: Bypass failed:', bypassError);
      }
    }

    if (authError || !user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // FIXED: User permission validation (Issue #7)
    // Use admin client to bypass RLS for user role lookup
    debug('[Preview] Auth check - User ID:', user.id, 'Email:', user.email);
    
    let userProfile;
    let profileError;
    
    try {
      const adminClient = createAdminClient();
      debug('[Preview] Admin client created successfully');
      
      const result = await adminClient
        .from('users')
        .select('roles')
        .eq('id', user.id)
        .single();
      
      userProfile = result.data;
      profileError = result.error;
      
      debug('[Preview] User profile query result:', { userProfile, profileError });
    } catch (err) {
      debugError('[Preview] Exception during user profile fetch:', err);
      return NextResponse.json({ 
        error: '사용자 정보를 가져올 수 없습니다.', 
        details: err instanceof Error ? err.message : 'Unknown error' 
      }, { status: 500 });
    }

    if (profileError) {
      debugError('[Preview] Failed to fetch user profile:', profileError);
      return NextResponse.json({ error: '사용자 정보를 가져올 수 없습니다.', details: profileError }, { status: 500 });
    }

    // Check if user has admin or manager role (roles is an array)
    const userRoles = userProfile?.roles || [];
    debug('[Preview] User roles check:', { userId: user.id, userRoles, userProfile });
    
    if (!userRoles.includes('admin') && !userRoles.includes('manager') && !userRoles.includes('1st_master')) {
      debugError('[Preview] Permission denied. User roles:', userRoles);
      return NextResponse.json({ error: '권한이 부족합니다.', details: { roles: userRoles } }, { status: 403 });
    }
    // FIXED: End of permission validation

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const productCodeRaw = formData.get('product_code') as string | null;
    const fieldMappingsRaw = formData.get('field_mappings') as string | null;
    const productCode = productCodeRaw && productCodeRaw.trim() !== '' ? productCodeRaw as ProductCode : null;

    if (!file) {
      return NextResponse.json({ error: 'CSV 파일을 업로드해주세요.' }, { status: 400 });
    }

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

    console.log('[Preview API] File name:', file.name);
    console.log('[Preview API] File size:', file.size);
    
    const selectedVersion = formData.get('version') as string | null;
    console.log('[Preview API] Selected version (sheet):', selectedVersion);
    
    let rows: ImportRow[];
    const fileName = file.name.toLowerCase();
    
    try {
      if (fileName.endsWith('.csv')) {
        const text = await file.text();
        console.log('[Preview API] Parsing as CSV');
        rows = parseCSV(text, fieldMappings);
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
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

    // FIXED: N+1 쿼리 최적화 - 모든 중복 체크를 한 번에 수행
    const sourceTexts = rows
      .filter(row => row.source_text?.trim())
      .map(row => row.source_text.trim());
    
    const duplicateMap = await checkDuplicatesBatch(supabase, sourceTexts);

    for (const row of rows) {
      if (!row.source_text?.trim()) {
        continue;
      }

      const sourceText = row.source_text.trim();
      const context = row.context?.trim() || undefined;
      const productCategory = row.product_category?.trim() || undefined;

      const translations: Record<string, string> = {};
      for (const langCode of validLanguages) {
        if (row[langCode]?.trim()) {
          translations[langCode] = row[langCode]!.trim();
        }
      }

      const wordCount = sourceText.split(/\s+/).length;
      const suggestedCategory: 'glossary' | 'translation' = wordCount <= 3 ? 'glossary' : 'translation';

      if (suggestedCategory === 'glossary') {
        glossarySuggested++;
      } else {
        translationSuggested++;
      }

      // FIXED: Map에서 중복 상태 조회 (N+1 방지)
      const duplicateStatus = duplicateMap.get(sourceText) || { status: 'new' as const };

      if (duplicateStatus.status === 'exact') {
        exactMatches++;
      } else if (duplicateStatus.status === 'similar') {
        similarMatches++;
      } else {
        newEntries++;
      }

      const mappedProduct = fieldMappings?.metadata?.product_category 
        ? row[fieldMappings.metadata.product_category] 
        : (row.product || row.product_category || undefined);
      
      const mappedPlatform = fieldMappings?.metadata?.platform || (row.platform || undefined);
      
      const mappedVersion = fieldMappings?.metadata?.version
        ? row[fieldMappings.metadata.version]
        : (row.version || undefined);

      const existingInGlossary = duplicateStatus.status === 'exact' && suggestedCategory === 'glossary';
      const existingInTranslation = duplicateStatus.status === 'exact' && suggestedCategory === 'translation';

      entries.push({
        id: uuidv4(),
        source_text: sourceText,
        context,
        product: mappedProduct,
        platform: mappedPlatform,
        version: mappedVersion,
        product_category: productCategory,
        key: row.key || row.id || row.key_id || undefined,
        note: row.note || row.description || undefined,
        translations,
        suggested_category: suggestedCategory,
        word_count: wordCount,
        duplicate_status: duplicateStatus,
        category: 'translation',
        existing_in_glossary: existingInGlossary,
        existing_in_translation: existingInTranslation,
      });
    }

    const duplicateGlossary = entries.filter(e => e.existing_in_glossary).length;
    const duplicateTranslation = entries.filter(e => e.existing_in_translation).length;
    const newGlossarySelected = entries.filter(e => e.suggested_category === 'glossary' && !e.existing_in_glossary).length;
    const newTranslation = entries.filter(e => !e.existing_in_glossary && !e.existing_in_translation && e.suggested_category === 'translation').length;

    return NextResponse.json({
      entries,
      summary: {
        total: entries.length,
        duplicate_glossary: duplicateGlossary,
        new_glossary_selected: newGlossarySelected,
        duplicate_translation: duplicateTranslation,
        new_translation: newTranslation,
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

// FIXED: N+1 쿼리 최적화 - 배치로 중복 체크
async function checkDuplicatesBatch(
  supabase: SupabaseClient,
  sourceTexts: string[]
): Promise<Map<string, { status: 'exact' | 'similar' | 'new'; existing_id?: string; existing_translations?: Record<string, string>; similarity?: number }>> {
  const result = new Map<string, { status: 'exact' | 'similar' | 'new'; existing_id?: string; existing_translations?: Record<string, string>; similarity?: number }>();
  
  if (sourceTexts.length === 0) return result;

  // Glossary 중복 체크 (한 번의 쿼리로 모든 term 조회)
  const { data: glossaryMatches } = await supabase
    .from('glossary')
    .select('id, term, translation, language_code')
    .in('term', sourceTexts);

  const glossaryMap = new Map<string, { id: string; translations: Record<string, string> }>();
  if (glossaryMatches) {
    for (const g of glossaryMatches) {
      if (!glossaryMap.has(g.term)) {
        glossaryMap.set(g.term, { id: g.id, translations: {} });
      }
      glossaryMap.get(g.term)!.translations[g.language_code] = g.translation;
    }
  }

  // Translation 중복 체크 (한 번의 쿼리로 모든 source_text 조회)
  const { data: translationMatches } = await supabase
    .from('translations')
    .select('id, source_text, translation_results(language_code, translated_text)')
    .in('source_text', sourceTexts);

  const translationMap = new Map<string, { id: string; translations: Record<string, string> }>();
  if (translationMatches) {
    for (const t of translationMatches) {
      const translations: Record<string, string> = {};
      if (t.translation_results) {
        for (const tr of t.translation_results as { language_code: string; translated_text: string }[]) {
          translations[tr.language_code] = tr.translated_text;
        }
      }
      translationMap.set(t.source_text, { id: t.id, translations });
    }
  }

  // 결과 조합
  for (const sourceText of sourceTexts) {
    const glossaryMatch = glossaryMap.get(sourceText);
    const translationMatch = translationMap.get(sourceText);

    if (glossaryMatch) {
      result.set(sourceText, {
        status: 'exact',
        existing_id: glossaryMatch.id,
        existing_translations: glossaryMatch.translations,
      });
    } else if (translationMatch) {
      result.set(sourceText, {
        status: 'exact',
        existing_id: translationMatch.id,
        existing_translations: translationMatch.translations,
      });
    } else {
      result.set(sourceText, { status: 'new' });
    }
  }

  return result;
}

// 기존 단일 체크 함수는 유지 (하위 호환성)
async function checkDuplicates(
  supabase: SupabaseClient,
  sourceText: string,
  category: 'glossary' | 'translation',
  translations: Record<string, string>
) {
  const batchResult = await checkDuplicatesBatch(supabase, [sourceText]);
  return batchResult.get(sourceText) || { status: 'new' as const };
}

function calculateSimilarity(str1: string, str2: string): number {
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
    console.log('[parseCSV] Looking for source field:', fieldMappings.source);
    sourceIndex = header.findIndex((h) => h.trim() === fieldMappings.source);
    console.log('[parseCSV] Source index found:', sourceIndex);
    
    if (sourceIndex === -1) {
      throw new Error(`원문 필드 "${fieldMappings.source}"를 찾을 수 없습니다. 사용 가능한 필드: ${header.join(', ')}`);
    }

    console.log('[parseCSV] Mapping translations:', fieldMappings.translations);
    fieldMappings.translations.forEach((transField) => {
      const idx = header.findIndex((h) => h.trim() === transField);
      console.log(`[parseCSV] Looking for translation field "${transField}" at index:`, idx);
      if (idx !== -1) {
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

    Object.entries(fieldMappings.metadata).forEach(([key, fieldName]) => {
      const idx = header.findIndex((h) => h.trim() === fieldName);
      if (idx !== -1) {
        columnMapping[idx] = key;
      }
    });
  } else {
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

    header.forEach((h, idx) => {
      const normalized = h.toLowerCase().trim();

      if (normalized === '설명' || normalized === 'description' || normalized === '문맥' || normalized === 'context') {
        columnMapping[idx] = 'context';
      } else if (normalized === 'product_category' || normalized === 'product category' || normalized === '제품분류') {
        columnMapping[idx] = 'product_category';
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

  const rows: ImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const sourceText = values[sourceIndex] || '';
    
    if (!sourceText.trim()) {
      continue;
    }
    
    const row: ImportRow = {
      source_text: sourceText,
    };

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

async function parseExcel(
  file: File, 
  selectedVersion: string | null,
  fieldMappings: { source: string | null; translations: string[]; metadata: Record<string, string> } | null
): Promise<ImportRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  
  console.log('[parseExcel] Available sheets:', workbook.SheetNames);
  console.log('[parseExcel] Selected version:', selectedVersion);
  
  let sheetName: string;
  
  if (selectedVersion && workbook.SheetNames.includes(selectedVersion)) {
    sheetName = selectedVersion;
  } else if (workbook.SheetNames.length === 1) {
    sheetName = workbook.SheetNames[0];
  } else if (workbook.SheetNames.length > 1) {
    sheetName = workbook.SheetNames[0];
    console.log('[parseExcel] Warning: Multiple sheets found, using first sheet:', sheetName);
  } else {
    throw new Error('Excel 파일에 시트가 없습니다.');
  }
  
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error(`시트 "${sheetName}"를 찾을 수 없습니다.`);
  }
  
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
  
  const columnMapping: Record<string, number> = {};
  
  if (fieldMappings && fieldMappings.source) {
    const sourceIndex = headers.findIndex(h => 
      h?.toString().trim() === fieldMappings.source || 
      h?.toString().trim().toLowerCase() === fieldMappings.source?.toLowerCase()
    );
    
    if (sourceIndex === -1) {
      throw new Error(`원문 필드 "${fieldMappings.source}"를 찾을 수 없습니다. 사용 가능한 필드: ${headers.join(', ')}`);
    }
    columnMapping['source'] = sourceIndex;
    
    console.log('[parseExcel] Headers for mapping:', headers);
    fieldMappings.translations.forEach((field) => {
      if (field) {
        const fieldIndex = headers.findIndex(h => 
          h?.toString().trim() === field || 
          h?.toString().trim().toLowerCase() === field.toLowerCase()
        );
        console.log(`[parseExcel] Looking for field "${field}" -> found at index ${fieldIndex}`);
        if (fieldIndex !== -1) {
          let langCode = extractLanguageCodeFromColumnName(field);
          
          if (langCode === 'unknown') {
            const samples: string[] = [];
            for (let i = 1; i < jsonData.length && samples.length < 3; i++) {
              const rowData = jsonData[i] as (string | number | null | undefined)[];
              const value = rowData[fieldIndex]?.toString();
              if (value && value.trim()) {
                samples.push(value.trim());
              }
            }
            langCode = detectLanguageFromSamples(samples);
            console.log(`[parseExcel] Field "${field}" - detected from data: ${langCode}`);
          } else {
            console.log(`[parseExcel] Field "${field}" - extracted from column name: ${langCode}`);
          }
          
          const mappingKey = `translation_${langCode}`;
          if (columnMapping[mappingKey] !== undefined) {
            console.log(`[parseExcel] WARNING: Duplicate langCode "${langCode}" for field "${field}". Previous field index: ${columnMapping[mappingKey]}, New: ${fieldIndex}`);
          }
          columnMapping[mappingKey] = fieldIndex;
          console.log(`[parseExcel] Mapped translation field "${field}" -> key: "${mappingKey}", index: ${fieldIndex}`);
        }
      }
    });
    
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
      } else if (normalized === 'product_category' || normalized.includes('product category') || normalized.includes('제품분류')) {
        columnMapping['product_category'] = idx;
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
  
  const rows: ImportRow[] = [];
  for (let i = 1; i < jsonData.length; i++) {
    const rowData = jsonData[i] as (string | number | null | undefined)[];
    const sourceText = rowData[columnMapping['source']]?.toString() || '';
    
    if (!sourceText.trim()) {
      continue;
    }
    
    const row: ImportRow = {
      source_text: sourceText,
    };
    
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

function extractLanguageCodeFromColumnName(columnName: string): string {
  const normalized = columnName.toLowerCase().trim();
  
  if (normalized === 'ko' || normalized === 'kor') return 'ko';
  if (normalized.includes('korean') || normalized.includes('한국어') || normalized.includes('한글')) return 'ko';
  
  if (normalized === 'en' || normalized === 'eng') return 'en';
  if (normalized === 'english' || normalized.includes('영어')) return 'en';
  if (/^en[-_].*$/.test(normalized)) return 'en';
  
  if (normalized === 'ja' || normalized === 'jpn') return 'ja';
  if (normalized.includes('japanese') || normalized.includes('일본어') || normalized.includes('日本語')) return 'ja';
  
  if (normalized === 'zh-cn' || normalized === 'zh_cn' || normalized === 'zh-hans' || normalized === 'zh_hans') return 'zh-CN';
  if (normalized.includes('chinese simplified') || normalized.includes('중국어 간체') || normalized.includes('중국어(간체)') || normalized.includes('中文(简体)') || normalized.includes('簡體')) return 'zh-CN';
  if (normalized === 'zh' && normalized.includes('간체')) return 'zh-CN';
  
  if (normalized === 'zh-tw' || normalized === 'zh_tw' || normalized === 'zh-hant' || normalized === 'zh_hant' || normalized === 'zh-hk') return 'zh-TW';
  if (normalized.includes('chinese traditional') || normalized.includes('중국어 번체') || normalized.includes('중국어(번체)') || normalized.includes('中文(繁體)') || normalized.includes('繁體')) return 'zh-TW';
  if (normalized === 'zh' && normalized.includes('번체')) return 'zh-TW';
  if (normalized.includes('taiwan') || normalized.includes('hong kong') || normalized.includes('대만') || normalized.includes('홍콩')) return 'zh-TW';
  
  if (normalized === 'es' || normalized === 'spa') return 'es';
  if (normalized.includes('spanish') || normalized.includes('español') || normalized.includes('스페인어')) return 'es';
  
  if (normalized === 'fr' || normalized === 'fra') return 'fr';
  if (normalized.includes('french') || normalized.includes('français') || normalized.includes('프랑스어')) return 'fr';
  
  if (normalized === 'de' || normalized === 'deu' || normalized === 'ger') return 'de';
  if (normalized.includes('german') || normalized.includes('deutsch') || normalized.includes('독일어')) return 'de';
  
  if (normalized === 'pt' || normalized === 'por') return 'pt';
  if (normalized.includes('portuguese') || normalized.includes('português') || normalized.includes('포르투갈어')) return 'pt';
  
  return 'unknown';
}

function detectLanguageFromSamples(samples: string[]): string {
  if (samples.length === 0) return 'unknown';
  
  const combinedText = samples.join(' ');
  
  const hasKorean = /[\uAC00-\uD7AF]/.test(combinedText);
  const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF]/.test(combinedText);
  const hasChinese = /[\u4E00-\u9FFF]/.test(combinedText);
  
  if (hasKorean) return 'ko';
  if (hasJapanese) return 'ja';
  if (hasChinese) return 'zh-CN';
  
  const latinChars = combinedText.match(/[a-zA-Z]/g) || [];
  const totalChars = combinedText.replace(/\s/g, '').length;
  const latinRatio = totalChars > 0 ? latinChars.length / totalChars : 0;
  
  if (latinRatio > 0.5) return 'en';
  
  return 'unknown';
}
