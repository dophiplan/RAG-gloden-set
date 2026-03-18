import { NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { SUPPORTED_LANGUAGES, ProductCode } from '@/types';
import { apiSuccess, apiUnauthorized, apiBadRequest, apiInternalError } from '@/lib/api/response';
import { getAuthUser } from '@/lib/api-auth';

/** CSV 임포트 행 데이터 인터페이스 */
interface ImportRow {
  source_text: string;
  context?: string;
  status?: string;
  scope?: 'SaaS' | 'Solution';
  dev_code?: string;
  [key: string]: string | undefined;
}

/** 임포트 결과 인터페이스 */
interface ImportResults {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

/**
 * POST - CSV 파일로 번역 데이터 임포트
 * @param request - NextRequest 객체
 * @returns API 응답
 */
export async function POST(request: NextRequest) {
  try {
    // 인증 클라이언트로 사용자 인증
    const authClient = await createClient();
    const { user, error: authError } = await getAuthUser(authClient);

    if (authError || !user) {
      return apiUnauthorized();
    }

    // Admin 클라이언트로 DB 작업 (RLS 우회)
    const adminClient = createAdminClient();

    // 사용자 프로필 정보 조회 (감사 로그용)
    const { data: userProfile } = await adminClient
      .from('users')
      .select('name, email')
      .eq('id', user.id)
      .single();

    // FormData 파싱
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const productCode = formData.get('product_code') as ProductCode | null;
    const version = formData.get('version') as string | null;

    // 필수 필드 검증
    if (!file) {
      return apiBadRequest('CSV 파일을 업로드해주세요.');
    }

    if (!productCode) {
      return apiBadRequest('제품을 선택해주세요.');
    }

    // CSV 파일 파싱
    const text = await file.text();
    const rows = parseCSV(text);

    if (rows.length === 0) {
      return apiBadRequest('유효한 데이터가 없습니다.');
    }

    // 임포트 결과 초기화
    const results: ImportResults = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    const validLanguages = Object.keys(SUPPORTED_LANGUAGES);
    const versionUpdatedAt = version ? new Date().toISOString() : null;

    // 각 행 처리
    for (const row of rows) {
      if (!row.source_text?.trim()) {
        results.skipped++;
        continue;
      }

      try {
        await processImportRow({
          row,
          adminClient,
          user,
          userProfile,
          productCode,
          version,
          versionUpdatedAt,
          validLanguages,
          results,
        });
      } catch (error) {
        console.error('Error importing row:', error);
        results.errors.push(`"${row.source_text.slice(0, 30)}..." - 가져오기 실패`);
      }
    }

    return apiSuccess({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('Error importing translations:', error);
    return apiInternalError('가져오기 중 오류가 발생했습니다.');
  }
}

/** 행 처리 함수 파라미터 인터페이스 */
interface ProcessRowParams {
  row: ImportRow;
  adminClient: ReturnType<typeof createAdminClient>;
  user: { id: string; email?: string };
  userProfile: { name?: string; email?: string } | null;
  productCode: ProductCode;
  version: string | null;
  versionUpdatedAt: string | null;
  validLanguages: string[];
  results: ImportResults;
}

/**
 * 단일 임포트 행 처리
 * @param params - 처리 파라미터
 */
async function processImportRow(params: ProcessRowParams): Promise<void> {
  const {
    row,
    adminClient,
    user,
    userProfile,
    productCode,
    version,
    versionUpdatedAt,
    validLanguages,
    results,
  } = params;

  // 기존 번역 데이터 조회
  const { data: existing } = await adminClient
    .from('translations')
    .select('id, version')
    .eq('source_text', row.source_text.trim())
    .single();

  // 기존 데이터가 있으면 버전 기반 업데이트
  if (existing) {
    await handleExistingTranslation({
      existing,
      adminClient,
      user,
      userProfile,
      productCode,
      version,
      versionUpdatedAt,
      results,
    });
    return;
  }

  // 새 번역 데이터 생성
  await createNewTranslation({
    row,
    adminClient,
    user,
    userProfile,
    productCode,
    version,
    versionUpdatedAt,
    validLanguages,
    results,
  });
}

/** 기존 번역 처리 파라미터 인터페이스 */
interface HandleExistingParams {
  existing: { id: string; version: string | null };
  adminClient: ReturnType<typeof createAdminClient>;
  user: { id: string; email?: string };
  userProfile: { name?: string; email?: string } | null;
  productCode: ProductCode;
  version: string | null;
  versionUpdatedAt: string | null;
  results: ImportResults;
}

/**
 * 기존 번역 데이터 처리 (버전 기반 누적)
 * @param params - 처리 파라미터
 */
async function handleExistingTranslation(params: HandleExistingParams): Promise<void> {
  const {
    existing,
    adminClient,
    user,
    userProfile,
    productCode,
    version,
    versionUpdatedAt,
    results,
  } = params;

  // 버전이 다륾면 업데이트
  if (version && version !== existing.version) {
    // 번역 버전 업데이트
    const { error: updateError } = await adminClient
      .from('translations')
      .update({
        version: version.trim(),
        version_updated_at: versionUpdatedAt,
      })
      .eq('id', existing.id);

    if (updateError) throw updateError;

    // 제품 연결 확인
    const { data: existingProduct } = await adminClient
      .from('translation_products')
      .select('id')
      .eq('translation_id', existing.id)
      .eq('product_code', productCode)
      .single();

    // 새 제품 연결 추가
    if (!existingProduct) {
      await adminClient.from('translation_products').insert({
        translation_id: existing.id,
        product_code: productCode,
        version: version?.trim() || null,
        version_updated_at: versionUpdatedAt,
      });
    }

    // 감사 로그 생성 (논블로킹)
    void adminClient.from('translation_audit_logs').insert({
      translation_id: existing.id,
      user_id: user.id,
      user_name: userProfile?.name,
      user_email: userProfile?.email || user.email,
      action: 'update',
      field_name: 'version',
      old_value: existing.version,
      new_value: version,
    }).then(({ error }) => {
      if (error) {
        console.error('[Audit Log] Failed to log import version update:', error);
      }
    });

    results.updated++;
  } else {
    results.skipped++;
  }
}

/** 새 번역 생성 파라미터 인터페이스 */
interface CreateNewParams {
  row: ImportRow;
  adminClient: ReturnType<typeof createAdminClient>;
  user: { id: string; email?: string };
  userProfile: { name?: string; email?: string } | null;
  productCode: ProductCode;
  version: string | null;
  versionUpdatedAt: string | null;
  validLanguages: string[];
  results: ImportResults;
}

/**
 * 새 번역 데이터 생성
 * @param params - 생성 파라미터
 */
async function createNewTranslation(params: CreateNewParams): Promise<void> {
  const {
    row,
    adminClient,
    user,
    userProfile,
    productCode,
    version,
    versionUpdatedAt,
    validLanguages,
    results,
  } = params;

  // 상태 검증
  const status = ['pending', 'reviewed', 'deployed'].includes(row.status || '')
    ? row.status
    : 'pending';

  // 범위 파싱
  const scope = row.scope === 'SaaS' || row.scope === 'Solution' ? row.scope : null;

  // 번역 데이터 생성
  const { data: translation, error: insertError } = await adminClient
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

  // 제품 연결 생성
  if (productCode && version) {
    await adminClient.from('translation_products').insert({
      translation_id: translation.id,
      product_code: productCode,
      version: version.trim(),
      version_updated_at: versionUpdatedAt,
    });
  }

  // 감사 로그 생성 (논블로킹)
  void adminClient.from('translation_audit_logs').insert({
    translation_id: translation.id,
    user_id: user.id,
    user_name: userProfile?.name,
    user_email: userProfile?.email || user.email,
    action: 'create',
    new_value: row.source_text.trim(),
  }).then(({ error }) => {
    if (error) {
      console.error('[Audit Log] Failed to log import creation:', error);
    }
  });

  // 번역 결과 삽입
  await insertTranslationResults({
    translationId: translation.id,
    row,
    validLanguages,
    adminClient,
  });

  results.created++;
}

/** 번역 결과 삽입 파라미터 인터페이스 */
interface InsertResultsParams {
  translationId: string;
  row: ImportRow;
  validLanguages: string[];
  adminClient: ReturnType<typeof createAdminClient>;
}

/**
 * 언어별 번역 결과 삽입
 * @param params - 삽입 파라미터
 */
async function insertTranslationResults(params: InsertResultsParams): Promise<void> {
  const { translationId, row, validLanguages, adminClient } = params;

  const translationResults = [];
  for (const langCode of validLanguages) {
    if (row[langCode]?.trim()) {
      translationResults.push({
        translation_id: translationId,
        language_code: langCode,
        translated_text: row[langCode]!.trim(),
      });
    }
  }

  if (translationResults.length > 0) {
    const { error: resultsError } = await adminClient
      .from('translation_results')
      .insert(translationResults);

    if (resultsError) {
      console.error('Error inserting results:', resultsError);
    }
  }
}

/**
 * CSV 텍스트 파싱
 * @param text - CSV 텍스트
 * @returns 파싱된 행 배열
 */
function parseCSV(text: string): ImportRow[] {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  // 헤더 파싱
  const header = parseCSVLine(lines[0]);

  // source_text 컬럼 찾기
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

  // 컬럼 매핑 생성
  const columnMapping: Record<string, string> = {};
  header.forEach((h, idx) => {
    const normalized = h.toLowerCase().trim();

    // 한국어 헤더를 영문 필드명으로 매핑
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

  // 행 파싱
  const rows: ImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: ImportRow = {
      source_text: values[sourceIndex] || '',
    };

    // 매핑된 컬럼 적용
    Object.keys(columnMapping).forEach((idx) => {
      const numIdx = parseInt(idx, 10);
      if (numIdx !== sourceIndex && values[numIdx]) {
        const fieldName = columnMapping[idx];
        row[fieldName] = values[numIdx];
      }
    });

    rows.push(row);
  }

  return rows;
}

/**
 * CSV 라인 파싱 (큰따옴표 처리 지원)
 * @param line - CSV 라인
 * @returns 파싱된 필드 배열
 */
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
