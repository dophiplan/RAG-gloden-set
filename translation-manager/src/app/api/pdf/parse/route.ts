import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extractTextFromPDF, extractAllText } from '@/lib/pdf/parser';

// Maximum file size: 4.5MB (Vercel serverless function limit)
const MAX_FILE_SIZE = 4.5 * 1024 * 1024;

// Note: Body size limit is configured in next.config.ts (serverActions.bodySizeLimit: '50mb')

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // Get the file from form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'PDF 파일을 업로드해주세요.' },
        { status: 400 }
      );
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      const sizeInMB = (file.size / 1024 / 1024).toFixed(2);
      return NextResponse.json(
        { error: `파일 크기는 4.5MB를 초과할 수 없습니다. (현재: ${sizeInMB}MB)` },
        { status: 413 } // Payload Too Large
      );
    }

    // Check file type
    if (!file.type.includes('pdf')) {
      return NextResponse.json(
        { error: 'PDF 파일만 업로드 가능합니다.' },
        { status: 400 }
      );
    }

    // Log file info
    console.log('=== PDF Upload Start ===');
    console.log('File name:', file.name);
    console.log('File size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
    console.log('Memory before:', (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2), 'MB');

    const startTime = Date.now();

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Extract text from PDF
    const rawText = await extractTextFromPDF(buffer);
    console.log('Raw text length:', rawText.length);
    console.log('Raw text preview:', rawText.slice(0, 500));

    // Extract quoted/tagged text
    const extractedTexts = extractAllText(rawText);
    console.log('Extracted texts count:', extractedTexts.length);
    console.log('Extracted texts:', extractedTexts.slice(0, 5));

    const endTime = Date.now();
    const processingTime = ((endTime - startTime) / 1000).toFixed(2);
    console.log('Processing time:', processingTime, 's');
    console.log('Memory after:', (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2), 'MB');
    console.log('=== PDF Upload End ===');

    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileSize: file.size,
      fileSizeMB: (file.size / 1024 / 1024).toFixed(2),
      processingTime: processingTime,
      totalExtracted: extractedTexts.length,
      texts: extractedTexts,
      rawTextPreview: rawText.slice(0, 1000), // First 1000 chars for preview
    });
  } catch (error) {
    console.error('PDF parsing error:', error);
    return NextResponse.json(
      { error: 'PDF 파싱 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
