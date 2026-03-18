/**
 * POST /api/migration/preview
 * 
 * 마이그레이션 미리보기 API
 * 업로드된 파일을 파싱하고 중복 여부를 체크하여 PreviewEntry 목록 반환
 * 
 * @see services/preview-service.ts - Business logic
 * @see services/duplicate-checker.ts - Duplicate checking
 * @see parsers/excel-parser.ts - Excel parsing
 * @see parsers/csv-parser.ts - CSV parsing
 * @see utils/language-mapping.ts - Language code utilities
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, parseUploadedFile, generatePreview } from './services/preview-service';
import { ProductCode } from '@/types';

const debug = process.env.NODE_ENV === 'development'
  ? (...args: unknown[]) => console.log(...args)
  : () => {};

/**
 * POST handler for migration preview
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const auth = await authenticateUser(request);
    if (!auth) {
      return NextResponse.json({ error: '인증이 필요하거나 권한이 부족합니다.' }, { status: 401 });
    }

    const { user, supabase } = auth;
    debug('[Preview] Authenticated:', user.email);

    // 2. Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const productCode = formData.get('product_code') as ProductCode | null;
    const fieldMappingsRaw = formData.get('field_mappings');
    const selectedVersion = formData.get('selected_version') as string | null;

    if (!file) {
      return NextResponse.json({ error: '파일이 필요합니다.' }, { status: 400 });
    }

    debug('[Preview] File:', file.name, 'Size:', file.size);

    // 3. Parse field mappings
    const fieldMappings = fieldMappingsRaw
      ? JSON.parse(fieldMappingsRaw as string)
      : null;

    // 4. Parse file
    const rows = await parseUploadedFile(file, fieldMappings, selectedVersion);
    debug('[Preview] Parsed rows:', rows.length);

    if (rows.length === 0) {
      return NextResponse.json({ error: '파일에 유효한 데이터가 없습니다.' }, { status: 400 });
    }

    // 5. Generate preview
    const result = await generatePreview(supabase, rows, productCode, fieldMappings);
    debug('[Preview] Generated:', result.summary);

    // 6. Return response
    return NextResponse.json({
      success: true,
      data: {
        entries: result.entries,
        summary: result.summary,
      },
    });

  } catch (error) {
    console.error('[Preview] Error:', error);
    return NextResponse.json(
      { error: '미리보기 생성 중 오류가 발생했습니다.', details: (error as Error).message },
      { status: 500 }
    );
  }
}
