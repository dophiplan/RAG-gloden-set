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
    where?: 'glossary' | 'translation' | 'both';
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

// Android 리소스 폼 → 시스템 언어 코드 매핑
const ANDROID_RESOURCE_MAP: Record<string, string> = {
  // 기본값
  'values': 'en',           // 기본값은 영어
  
  // 아시아 언어
  'values-ko': 'ko',        // 한국어
  'values-ja': 'ja',        // 일본어
  'values-zh': 'zh-CN',     // 중국어 (기본)
  'values-zh-rCN': 'zh-CN', // 중국어 간체
  'values-zh-rHK': 'zh-HK', // 중국어 홍콩
  'values-zh-rTW': 'zh-TW', // 중국어 대만
  'values-th': 'th',        // 태국어
  'values-vi': 'vi',        // 베트남어
  'values-in': 'id',        // 인도네시아어
  'values-id': 'id',        // 인도네시아어
  'values-ms': 'ms',        // 말레이어
  'values-hi': 'hi',        // 힌디어
  
  // 유럽 언어
  'values-en': 'en',        // 영어
  'values-en-rUS': 'en',    // 영어 (미국)
  'values-en-rGB': 'en',    // 영어 (영국)
  'values-de': 'de',        // 독일어
  'values-fr': 'fr',        // 프랑스어
  'values-es': 'es',        // 스페인어
  'values-it': 'it',        // 이탈리아어
  'values-pt': 'pt',        // 포르투갈어
  'values-pt-rBR': 'pt',    // 포르투갈어 (브라질)
  'values-ru': 'ru',        // 러시아어
  'values-pl': 'pl',        // 폴란드어
  'values-tr': 'tr',        // 터키어
  'values-nl': 'nl',        // 네덜란드어
  'values-sv': 'sv',        // 스웨덴어
  'values-da': 'da',        // 덴ish어
  'values-fi': 'fi',        // 핀란드어
  'values-no': 'no',        // 노르웨이어
  'values-cs': 'cs',        // 체코어
  'values-el': 'el',        // 그리스어
  'values-hu': 'hu',        // 헝가리어
  'values-ro': 'ro',        // 루마니아어
  
  // 중동 언어
  'values-ar': 'ar',        // 아랍어
  'values-fa': 'fa',        // 페르시아어
  'values-he': 'he',        // 히브리어
  'values-iw': 'he',        // 히브리어 (구형 코드)
  
  // 기타
  'values-uk': 'uk',        // 우크라이나어
};

// 컬럼명을 시스템 언어 코드로 변환
function mapColumnToLangCode(column: string): string | null {
  // 1. Android 리소스 형식 직접 매핑 (values-ja, values-en 등)
  if (ANDROID_RESOURCE_MAP[column]) {
    return ANDROID_RESOURCE_MAP[column];
  }
  
  // 2. 순수 언어 코드 직접 매핑 (ja, en, ko 등)
  const directLangCodes: Record<string, string> = {
    'ko': 'ko', 'en': 'en', 'ja': 'ja', 'es': 'es', 'fr': 'fr', 
    'de': 'de', 'pt': 'pt', 'it': 'it', 'ru': 'ru', 'zh': 'zh-CN',
    'th': 'th', 'vi': 'vi', 'id': 'id', 'ms': 'ms', 'hi': 'hi',
    'pl': 'pl', 'tr': 'tr', 'nl': 'nl', 'sv': 'sv', 'da': 'da',
    'fi': 'fi', 'no': 'no', 'cs': 'cs', 'el': 'el', 'hu': 'hu',
    'ro': 'ro', 'ar': 'ar', 'fa': 'fa', 'he': 'he', 'uk': 'uk',
    'zh-cn': 'zh-CN', 'zh-tw': 'zh-TW', 'zh-hk': 'zh-HK',
    'zh-CN': 'zh-CN', 'zh-TW': 'zh-TW', 'zh-HK': 'zh-HK',
    'pt-BR': 'pt', 'en-US': 'en', 'en-GB': 'en',
  };
  
  const normalized = column.toLowerCase().trim();
  if (directLangCodes[normalized]) {
    return directLangCodes[normalized];
  }
  if (directLangCodes[column]) {
    return directLangCodes[column];
  }
  
  // 3. SUPPORTED_LANGUAGES에 있는지 확인
  if (Object.keys(SUPPORTED_LANGUAGES).includes(column)) {
    return column;
  }
  
  return null;
}

// 셀 내용으로 언어 자동 감지
function detectLanguageByContent(text: string): string | null {
  if (!text || text.trim().length === 0) return null;
  
  const sample = text.trim();
  
  // 한국어 (한글) - 유니코드 범위: U+AC00-U+D7A3, U+1100-U+11FF, U+3130-U+318F
  if (/[\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F]/.test(sample)) {
    return 'ko';
  }
  
  // 일본어 (히라가나/가타칸나) - 유니코드 범위: U+3040-U+309F, U+30A0-U+30FF
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(sample)) {
    return 'ja';
  }
  
  // 중국어 (간체/번체 한자) - CJK Unified Ideographs: U+4E00-U+9FFF
  // 참고: 한국어와 일본어도 한자를 쓰지만 위에서 먼저 체크함
  if (/[\u4E00-\u9FFF]/.test(sample)) {
    // 중국어 특유의 문자가 있으면 zh-CN, 없으면 일단 zh-CN으로 기본값
    return 'zh-CN';
  }
  
  // 스페인어 특수문자
  if (/[áéíóúñ¿¡]/i.test(sample)) {
    return 'es';
  }
  
  // 프랑스어 특수문자
  if (/[àâäæçéèêëïîôœùûüÿ]/i.test(sample)) {
    return 'fr';
  }
  
  // 독일어 특수문자
  if (/[äöüßÄÖÜ]/.test(sample)) {
    return 'de';
  }
  
  // 포르투갈어
  if (/[ãõçáéíóúâêîôûà]/i.test(sample)) {
    return 'pt';
  }
  
  // 영어 (기본값) - 알파벳만 있는 경우
  if (/^[a-zA-Z0-9\s\p{P}]+$/u.test(sample)) {
    return 'en';
  }
  
  return null;
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
    
    if (!userRoles.includes('admin') && !userRoles.includes('manager') && !userRoles.includes('1st_master') && !userRoles.includes('master')) {
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
        console.log('[Preview API] =======================================');
        console.log('[Preview API] Field mappings parsed:', JSON.stringify(fieldMappings, null, 2));
        console.log('[Preview API] Source:', fieldMappings?.source);
        console.log('[Preview API] Translations:', fieldMappings?.translations);
        console.log('[Preview API] Metadata:', fieldMappings?.metadata);
        console.log('[Preview API] Metadata.version:', fieldMappings?.metadata?.version);
        console.log('[Preview API] Metadata.product_category:', fieldMappings?.metadata?.product_category);
        console.log('[Preview API] =======================================');
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
    // productCode 전달로 Preview/Commit 일치성 확보
    const sourceTexts = rows
      .filter(row => row.source_text?.trim())
      .map(row => row.source_text.trim());
    
    const duplicateMap = await checkDuplicatesBatch(supabase, sourceTexts, productCode);

    for (const row of rows) {
      if (!row.source_text?.trim()) {
        continue;
      }

      const sourceText = row.source_text.trim();
      const context = row.context?.trim() || undefined;
      const productCategory = row.product_category?.trim() || undefined;

      // FIXED: 간단하고 확실한 언어 매핑
      const translations: Record<string, string> = {};
      
      // Row 객체에서 바로 읽기 (parseExcel에서 저장한 형태 그대로)
      // parseExcel은 row['ja'], row['en'], row['zh-CN'] 형태로 저장함
      const langKeys = Object.keys(row).filter(k => 
        k !== 'source_text' && 
        k !== 'context' && 
        k !== 'product_category' &&
        k !== 'product' &&
        k !== 'platform' &&
        k !== 'version' &&
        k !== 'key' &&
        k !== 'note' &&
        k !== 'id' &&
        k !== 'key_id'
      );
      
      console.log('[Preview API] Row source:', row.source_text?.substring(0, 30));
      console.log('[Preview API] Lang keys found:', langKeys);
      
      for (const key of langKeys) {
        const value = row[key]?.trim();
        if (value) {
          // 키가 이미 유효한 언어 코드(ja, en, zh-CN 등)라면 바로 사용
          // 아니라면 mapColumnToLangCode로 변환 시도
          let langCode = key;
          if (!validLanguages.includes(key)) {
            const mapped = mapColumnToLangCode(key);
            if (mapped) langCode = mapped;
          }
          translations[langCode] = value;
          console.log(`[Preview API] Added: translations[${langCode}] = ${value.substring(0, 20)}`);
        }
      }
      
      console.log('[Preview API] Final translations:', translations);
      console.log('[Preview API] translations type:', typeof translations);
      console.log('[Preview API] translations keys:', Object.keys(translations));
      console.log('[Preview API] translations is empty?', Object.keys(translations).length === 0);

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

      // product_category 매핑: 직접 값이거나 컬럼명일 수 있음
      const mappedProduct = fieldMappings?.metadata?.product_category 
        ? (row[fieldMappings.metadata.product_category] || fieldMappings.metadata.product_category)
        : (row.product || row.product_category || undefined);
      
      const mappedPlatform = fieldMappings?.metadata?.platform || (row.platform || undefined);
      
      // FIX: version은 metadata.version이 명시적으로 매핑된 경우에만 사용
      // 그렇지 않으면 undefined (자동으로 version이 들어가지 않도록)
      const mappedVersion = fieldMappings?.metadata?.version
        ? row[fieldMappings.metadata.version]
        : undefined;
      
      // DEBUG: Log for first few rows
      if (entries.length < 3) {
        console.log(`[Preview API DEBUG] Entry ${entries.length}:`, {
          'metadata.version': fieldMappings?.metadata?.version,
          'metadata.product_category': fieldMappings?.metadata?.product_category,
          'row[fieldMappings.metadata.version]': fieldMappings?.metadata?.version ? row[fieldMappings.metadata.version] : undefined,
          mappedVersion,
          mappedProduct,
          source_text: sourceText?.substring(0, 30)
        });
      }

      const existingInGlossary = duplicateStatus.where === 'glossary' || duplicateStatus.where === 'both';
      const existingInTranslation = duplicateStatus.where === 'translation' || duplicateStatus.where === 'both';

      entries.push({
        id: uuidv4(),
        source_text: sourceText,
        context,
        product: mappedProduct,
        platform: mappedPlatform,
        version: mappedVersion,
        product_category: mappedProduct || productCategory,
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

    // DEBUG: API 응답 직전 - entries와 translations 상세 확인
    console.log('[Preview API] === FINAL RESPONSE DEBUG ===');
    console.log('[Preview API] Total entries:', entries.length);
    if (entries.length > 0) {
      entries.forEach((entry, i) => {
        const transKeys = entry.translations ? Object.keys(entry.translations) : [];
        console.log(`[Preview API] Entry ${i} (${entry.source_text?.substring(0, 20)}...): translations keys = [${transKeys.join(', ')}]`);
        if (transKeys.length === 0) {
          console.log(`[Preview API] Entry ${i} translations object:`, entry.translations);
        }
      });
    }
    console.log('[Preview API] === END DEBUG ===');

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
// productCode가 제공되면 해당 제품 내에서만 중복 체크 (Preview/Commit 일치성)
async function checkDuplicatesBatch(
  supabase: SupabaseClient,
  sourceTexts: string[],
  productCode?: ProductCode | null
): Promise<Map<string, { status: 'exact' | 'similar' | 'new'; where?: 'glossary' | 'translation' | 'both'; existing_id?: string; existing_translations?: Record<string, string>; similarity?: number }>> {
  const result = new Map<string, { status: 'exact' | 'similar' | 'new'; where?: 'glossary' | 'translation' | 'both'; existing_id?: string; existing_translations?: Record<string, string>; similarity?: number }>();
  
  if (sourceTexts.length === 0) return result;

  // Glossary 중복 체크 (한 번의 쿼리로 모든 term 조회)
  // Note: glossary는 제품별 구분이 없으므로 전체 기준으로 체크
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

  // Translation 중복 체크
  // productCode가 제공되면 해당 제품에 속한 translation만 필터링
  let translationIdsInProduct: Set<string> | null = null;
  
  if (productCode) {
    const { data: productTranslations } = await supabase
      .from('translation_products')
      .select('translation_id')
      .eq('product_code', productCode);
    
    if (productTranslations && productTranslations.length > 0) {
      translationIdsInProduct = new Set(productTranslations.map(pt => pt.translation_id));
    } else {
      // 해당 제품에 번역이 없으면 빈 결과
      translationIdsInProduct = new Set();
    }
  }

  const { data: translationMatches } = await supabase
    .from('translations')
    .select('id, source_text, translation_results(language_code, translated_text)')
    .in('source_text', sourceTexts);

  const translationMap = new Map<string, { id: string; translations: Record<string, string> }>();
  if (translationMatches) {
    for (const t of translationMatches) {
      // 제품 코드 필터 적용: 해당 제품에 속한 translation만 포함
      if (translationIdsInProduct !== null && !translationIdsInProduct.has(t.id)) {
        continue;
      }
      
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

    if (glossaryMatch && translationMatch) {
      // 둘 다 있는 경우: where: 'both'
      result.set(sourceText, {
        status: 'exact',
        where: 'both',
        existing_id: glossaryMatch.id,
        existing_translations: glossaryMatch.translations,
      });
    } else if (glossaryMatch) {
      // glossary에만 있으면: where: 'glossary'
      result.set(sourceText, {
        status: 'exact',
        where: 'glossary',
        existing_id: glossaryMatch.id,
        existing_translations: glossaryMatch.translations,
      });
    } else if (translationMatch) {
      // translation에만 있으면: where: 'translation'
      result.set(sourceText, {
        status: 'exact',
        where: 'translation',
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
    // 🔒 null/undefined 안전 처리
    if (!fieldMappings.translations || fieldMappings.translations.length === 0) {
      console.log('[parseCSV] No translations to map');
    } else {
    fieldMappings.translations.forEach((transField) => {
      // 🔒 null/undefined 체크
      if (!transField || typeof transField !== 'string') {
        console.log('[parseCSV] Invalid translation field (null/undefined):', transField);
        return;
      }
      const idx = header.findIndex((h) => h && h.trim() === transField);
      console.log(`[parseCSV] Looking for translation field "${transField}" at index:`, idx);
      if (idx !== -1) {
        // 🔧 정규식 수정: zh-CN, zh-TW 하이픈 이스케이프
        const langMatch = transField.match(/^(ko|en|ja|zh\-CN|zh\-TW|es|de|pt|fr)/i);
        if (langMatch) {
          // zh-CN, zh-TW는 원래 대소문자 유지, 나머지는 소문자
          const matched = langMatch[0];
          const langCode = matched.startsWith('zh-') ? matched : matched.toLowerCase();
          columnMapping[idx] = langCode;
          console.log(`[parseCSV] Mapped column ${idx} to language:`, langCode);
        } else {
          console.log(`[parseCSV] Could not extract language code from:`, transField);
        }
      } else {
        console.log(`[parseCSV] Translation field "${transField}" not found in header`);
      }
    });
    }
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
  
  // === 원문 매핑 ===
  if (fieldMappings && fieldMappings.source) {
    // FieldMapping에 원문 지정됨
    const sourceIndex = headers.findIndex(h => 
      h?.toString().trim() === fieldMappings.source || 
      h?.toString().trim().toLowerCase() === fieldMappings.source?.toLowerCase()
    );
    if (sourceIndex !== -1) {
      columnMapping['source'] = sourceIndex;
      console.log(`[parseExcel] Source from FieldMapping: ${fieldMappings.source} -> index ${sourceIndex}`);
      
      // NEW: Process metadata.lang_XX (individual language mapping)
      if (fieldMappings.metadata) {
        Object.entries(fieldMappings.metadata).forEach(([key, columnName]) => {
          if (!key.startsWith('lang_') || !columnName || typeof columnName !== 'string') {
            return;
          }
          
          const langCode = key.replace('lang_', '');
          const idx = headers.findIndex(h => 
            h?.toString().trim() === columnName
          );
          
          if (idx !== -1 && idx !== sourceIndex) {
            columnMapping[`translation_${langCode}`] = idx;
            console.log(`[parseExcel] ✓ Mapped ${langCode} -> "${columnName}" at index ${idx}`);
          }
        });
      }
      
      // NEW: Process metadata.version
      if (fieldMappings.metadata?.version) {
        const versionIdx = headers.findIndex(h => 
          h?.toString().trim() === fieldMappings.metadata!.version
        );
        if (versionIdx !== -1) {
          columnMapping['version'] = versionIdx;
          console.log(`[parseExcel] ✓ Mapped version -> "${fieldMappings.metadata.version}" at index ${versionIdx}`);
        }
      }
      
      // FIX: 번역은 fieldMappings.translations가 명시적으로 있을 때만 처리
      // 자동 언어 감지(sampling)는 사용자 의도와 다를 수 있으므로 제거
      const hasTranslationMapping = Object.keys(columnMapping).some(k => k.startsWith('translation_'));
      if (hasTranslationMapping && fieldMappings.translations?.length) {
        // 번역이 명시적으로 매핑된 경우에만 처리
        console.log('[parseExcel] Processing fieldMappings.translations:', fieldMappings.translations);
        // 🔒 중복 언어 코드 추적
        const mappedLangs = new Set<string>();
        
        fieldMappings.translations?.forEach((transField) => {
          // 🔒 null/undefined 체크
          if (!transField || typeof transField !== 'string') {
            console.log('[parseExcel] Invalid translation field (null/undefined):', transField);
            return;
          }
          
          const idx = headers.findIndex(h => {
            const headerStr = h?.toString().trim();
            if (!headerStr) return false;
            return headerStr === transField || 
                   headerStr.toLowerCase() === transField.toLowerCase();
          });
          console.log(`[parseExcel] Looking for translation field "${transField}" at index:`, idx);
          
          if (idx !== -1 && idx !== sourceIndex) {
            // 🔧 콘텐츠 기반 언어 감지: 2~5번째 행 샘플링
            const sampleRows = jsonData.slice(1, Math.min(5, jsonData.length)) as (string | number | null | undefined)[][];
            const texts: string[] = [];
            
            for (const row of sampleRows) {
              const val = row[idx]?.toString().trim();
              if (val && val.length > 0) {
                texts.push(val);
              }
            }
            
            console.log(`[parseExcel] Column "${transField}" (idx=${idx}) sample texts:`, texts.slice(0, 3));
            
            // 콘텐츠로 언어 감지
            let langCode: string | null = null;
            if (texts.length > 0) {
              // 첫 번째 유효한 텍스트로 언어 감지
              for (const text of texts) {
                langCode = detectLanguageByContent(text);
                if (langCode && langCode !== 'unknown') {
                  console.log(`[parseExcel] Detected language "${langCode}" from text: "${text.substring(0, 30)}"`);
                  break;
                }
              }
            }
            
            // 콘텐츠 감지 실패 시에만 헤더 이름으로 시도
            if (!langCode || langCode === 'unknown') {
              const directMatch = transField.match(/^(ko|en|ja|zh\-CN|zh\-TW|es|de|pt|fr)$/i);
              if (directMatch) {
                const matched = directMatch[0];
                langCode = matched.startsWith('zh-') ? matched : matched.toLowerCase();
              } else {
                langCode = extractLanguageCodeFromColumnName(transField);
              }
              console.log(`[parseExcel] Fallback to header name detection: "${transField}" -> "${langCode}"`);
            }
            
            if (langCode && langCode !== 'unknown') {
              // 🔒 중복 언어 코드 체크
              if (mappedLangs.has(langCode)) {
                console.warn(`[parseExcel] Duplicate language code "${langCode}" detected for field "${transField}". Skipping.`);
                return;
              }
              mappedLangs.add(langCode);
              
              columnMapping[`translation_${langCode}`] = idx;
              console.log(`[parseExcel] Mapped translation_${langCode} -> column ${idx} (from content sampling)`);
            } else {
              console.log(`[parseExcel] Could not detect language for field:`, transField);
            }
          } else if (idx === sourceIndex) {
            console.log(`[parseExcel] Skipping field "${transField}" - same as source column`);
          } else {
            console.log(`[parseExcel] Translation field "${transField}" not found in headers`);
          }
        });
      }
    } else {
      throw new Error(`원문 필드 "${fieldMappings.source}"를 찾을 수 없습니다.`);
    }
  } else {
    // FieldMapping 없음 → 샘플링으로 언어 감지
    console.log('[parseExcel] No fieldMappings, using sampling...');
    detectLanguagesBySampling(jsonData, headers, columnMapping, -1);
  }
  
  // 샘플링 로직을 별도 함수로 분리
  function detectLanguagesBySampling(
    jsonData: unknown[], 
    headers: string[], 
    columnMapping: Record<string, number>, 
    sourceIndex: number
  ) {
    const sampleRows = jsonData.slice(1, Math.min(5, jsonData.length)) as (string | number | null | undefined)[][];
    const colCount = headers.length;
    const colLanguages: (string | null)[] = new Array(colCount).fill(null);
    
    // 각 컬럼의 언어 감지
    for (let colIdx = 0; colIdx < colCount; colIdx++) {
      if (colIdx === sourceIndex) {
        colLanguages[colIdx] = 'source';
        continue;
      }
      
      for (const row of sampleRows) {
        const val = row[colIdx]?.toString().trim();
        if (val && val.length > 0) {
          const detectedLang = detectLanguageByContent(val);
          if (detectedLang) {
            colLanguages[colIdx] = detectedLang;
            console.log(`[parseExcel] Column ${colIdx}: detected lang=${detectedLang}, sample="${val.substring(0, 30)}"`);
          }
          break;
        }
      }
    }
    
    // 원문(source) 설정: 첫 번째로 감지된 언어
    let firstLangIdx = -1;
    for (let i = 0; i < colCount; i++) {
      if (colLanguages[i] && colLanguages[i] !== 'unknown' && colLanguages[i] !== 'source') {
        firstLangIdx = i;
        columnMapping['source'] = i;
        console.log(`[parseExcel] Source (first lang): column ${i} -> ${colLanguages[i]}`);
        break;
      }
    }
    
    // 번역 컬럼 매핑
    const usedLangs = new Set<string>();
    if (columnMapping['source'] !== undefined) {
      const sourceLang = colLanguages[columnMapping['source']];
      if (sourceLang && sourceLang !== 'unknown') {
        usedLangs.add(sourceLang);
      }
    }
    
    for (let colIdx = 0; colIdx < colCount; colIdx++) {
      if (colIdx === columnMapping['source']) continue;
      
      const lang = colLanguages[colIdx];
      if (lang && lang !== 'unknown' && !usedLangs.has(lang)) {
        columnMapping[`translation_${lang}`] = colIdx;
        usedLangs.add(lang);
        console.log(`[parseExcel] Translation: column ${colIdx} -> ${lang}`);
      }
    }
  }
  
  // === 메타데이터 매핑 ===
  if (fieldMappings && fieldMappings.metadata) {
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
  }
  
  if (!columnMapping['source']) {
    // 자동 매핑: Android 리소스 형식(values-xxx) 및 일반 컬럼명 지원
    headers.forEach((header, idx) => {
      if (!header) return;
      const normalized = header.toString().trim().toLowerCase();
      
      // Android 리소스 형식에서 언어 코드 추출 헬퍼
      const getAndroidLang = (prefix: string) => {
        if (normalized === `values-${prefix}`) return true;
        if (normalized.startsWith(`${prefix}-`)) return true;
        return false;
      };
      
      // 원문 필드 (한국어 또는 Android 기본값)
      if (normalized === 'values-ko' || normalized === 'ko' || 
          normalized === 'source' || normalized === 'source_text' || 
          normalized === '원문' || normalized === 'key' ||
          normalized.includes('korean') || normalized.includes('한국어') || normalized.includes('kor')) {
        columnMapping['source'] = idx;
      } 
      // 영어 (기본값)
      else if (normalized === 'values' || normalized === 'values-en' || normalized === 'en' || 
               normalized === 'english' || normalized === 'en-us' || normalized === 'en_us' ||
               normalized.includes('english') || normalized.includes('영어')) {
        columnMapping['translation_en'] = idx;
      } 
      // 일본어
      else if (getAndroidLang('ja') || normalized === 'ja' || 
               normalized.includes('japanese') || normalized.includes('日本語') || normalized.includes('jpn')) {
        columnMapping['translation_ja'] = idx;
      } 
      // 중국어
      else if (normalized.includes('zh') || normalized.includes('chinese') || normalized.includes('中文')) {
        if (normalized.includes('tw') || normalized.includes('hk') || normalized.includes('rTW') ||
            normalized.includes('traditional') || normalized.includes('繁體')) {
          columnMapping['translation_zh-TW'] = idx;
        } else {
          columnMapping['translation_zh-CN'] = idx;
        }
      } 
      // 스페인어
      else if (getAndroidLang('es') || normalized === 'es' || 
               normalized.includes('spanish') || normalized.includes('español') || normalized.includes('spa')) {
        columnMapping['translation_es'] = idx;
      } 
      // 프랑스어
      else if (getAndroidLang('fr') || normalized === 'fr' || 
               normalized.includes('french') || normalized.includes('français') || normalized.includes('fra')) {
        columnMapping['translation_fr'] = idx;
      } 
      // 독일어
      else if (getAndroidLang('de') || normalized === 'de' || 
               normalized.includes('german') || normalized.includes('deutsch') || normalized.includes('deu')) {
        columnMapping['translation_de'] = idx;
      }
      // 이탈리아어
      else if (getAndroidLang('it') || normalized === 'it' || 
               normalized.includes('italian') || normalized.includes('italiano')) {
        columnMapping['translation_it'] = idx;
      }
      // 러시아어
      else if (getAndroidLang('ru') || normalized === 'ru' || 
               normalized.includes('russian') || normalized.includes('русский')) {
        columnMapping['translation_ru'] = idx;
      }
      // 포르투갈어
      else if (getAndroidLang('pt') || normalized === 'pt' || 
               normalized.includes('portuguese') || normalized.includes('português')) {
        columnMapping['translation_pt'] = idx;
      }
      // 기타 메타데이터
      else if (normalized === 'context' || normalized.includes('desc') || 
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
  
  console.log('[parseExcel] === FINAL Column mapping ===:', columnMapping);
  console.log('[parseExcel] Column mapping keys:', Object.keys(columnMapping));
  console.log('[parseExcel] Has source?', columnMapping['source'] !== undefined);
  console.log('[parseExcel] Translation keys:', Object.keys(columnMapping).filter(k => k.startsWith('translation_')));
  
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
        const langCode = key.replace('translation_', '');
        console.log(`[parseExcel] Mapping key: ${key}, langCode: ${langCode}, idx: ${idx}, value: ${value?.substring(0, 20)}`);
        if (value) {
          row[langCode] = value;
        }
      } else if (key !== 'source') {
        const value = rowData[idx]?.toString();
        if (value) {
          row[key] = value;
        }
      }
    });
    
    console.log('[parseExcel] Row created:', row);
    rows.push(row);
  }
  
  console.log('[parseExcel] Total parsed rows:', rows.length);
  if (rows.length > 0) {
    console.log('[parseExcel] Sample row:', rows[0]);
    console.log('[parseExcel] Sample row keys:', Object.keys(rows[0]));
  }
  
  return rows;
}

function extractLanguageCodeFromColumnName(columnName: string): string {
  const normalized = columnName.toLowerCase().trim();
  
  // 🔧 Android resource 패턴 처리: values-ko, values-en, values-ja, ...
  const valuesMatch = normalized.match(/^values-([a-z]{2})(?:-([a-zA-Z]+))?$/);
  if (valuesMatch) {
    const lang = valuesMatch[1];
    const region = valuesMatch[2];
    if (lang === 'zh' && region) {
      // values-zh-rCN → zh-CN, values-zh-rTW → zh-TW
      return region.toLowerCase() === 'rcn' ? 'zh-CN' : 
             region.toLowerCase() === 'rtw' ? 'zh-TW' : 
             `zh-${region.toUpperCase()}`;
    }
    return lang; // values-ko → ko, values-en → en
  }
  
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
  
  // 🔧 일반적인 로케일 패턴 처리: ko-KR, en-US, ja-JP, ...
  const localeMatch = normalized.match(/^([a-z]{2})[-_][a-z]{2}$/i);
  if (localeMatch) {
    const lang = localeMatch[1].toLowerCase();
    // zh-CN, zh-TW는 이미 위에서 처리됨
    if (lang === 'zh') return 'zh-CN'; // 기본값으로 간체
    return lang;
  }
  
  // 🔧 언더스코어 접두사 패턴: _ko, _en, _ja, ...
  const underscoreMatch = normalized.match(/^_(\w+)$/);
  if (underscoreMatch) {
    const code = underscoreMatch[1].toLowerCase();
    if (code.startsWith('zh')) return code.includes('tw') || code.includes('hk') || code.includes('hant') ? 'zh-TW' : 'zh-CN';
    return code.substring(0, 2); // _korean → ko
  }
  
  // 🔧 점 접두사 패턴: .ko, .en, .ja, ... (iOS-style)
  const dotMatch = normalized.match(/^\.(\w+)$/);
  if (dotMatch) {
    const code = dotMatch[1].toLowerCase();
    if (code.startsWith('zh')) return code.includes('tw') || code.includes('hk') || code.includes('hant') ? 'zh-TW' : 'zh-CN';
    return code.substring(0, 2);
  }
  
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
