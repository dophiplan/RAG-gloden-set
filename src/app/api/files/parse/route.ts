import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProductCode } from '@/types';
import { getAuthUser } from '@/lib/api-auth';
import {
  processFiles,
  calculateUploadSummary,
  logUploadMetrics,
  FileUploadContext,
} from '@/services/file_upload_service';

/**
 * POST /api/files/parse
 * 
 * Parse uploaded files (PDF, images) and extract text content.
 * Refactored to use FileUploadService for better maintainability.
 * 
 * @param request - NextRequest with form data containing files
 * @returns NextResponse with parsing results
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Check authentication
    const supabase = await createClient();
    const { user } = await getAuthUser(supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get form data
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const scope = formData.get('scope') as 'SaaS' | 'Solution' | null;
    const version = formData.get('version') as string | null;
    const productCode = formData.get('product_code') as ProductCode | null;

    // Validate required fields
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: '파일을 업로드해주세요.' },
        { status: 400 }
      );
    }

    if (!scope) {
      return NextResponse.json(
        { error: 'Scope를 선택해주세요.' },
        { status: 400 }
      );
    }

    console.log('=== File Parse Start ===');
    console.log('Files count:', files.length);
    console.log('Scope:', scope);
    console.log('Version:', version);
    console.log('Product Code:', productCode);

    // Prepare upload context
    const context: FileUploadContext = {
      supabase,
      userId: user.id,
      productCode,
    };

    // Process all files using the service
    const results = await processFiles(files, context, { scope, version });

    // Calculate summary
    const summary = calculateUploadSummary(results);

    // Log metrics
    logUploadMetrics(startTime, results);

    console.log('=== File Parse End ===');

    return NextResponse.json({
      success: true,
      summary,
      results,
      scope,
      version,
      productCode,
      processingTime: ((Date.now() - startTime) / 1000).toFixed(2),
    });
  } catch (error) {
    console.error('File parsing error:', error);
    return NextResponse.json(
      { error: '파일 파싱 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
