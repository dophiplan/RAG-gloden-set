import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extractTextFromPDF, extractAllText } from '@/lib/pdf/parser';
import { ProductCode } from '@/types';

// Maximum file size: 4.5MB (Vercel serverless function limit)
const MAX_FILE_SIZE = 4.5 * 1024 * 1024;

// Supported file types
const SUPPORTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
const SUPPORTED_FILE_TYPES = ['application/pdf', ...SUPPORTED_IMAGE_TYPES];

interface ParseResult {
  fileName: string;
  fileSize: number;
  fileType: string;
  success: boolean;
  texts?: string[];
  error?: string;
  issueId?: string;
}

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

    // Get form data
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const scope = formData.get('scope') as 'SaaS' | 'Solution' | null;
    const version = formData.get('version') as string | null;
    const productCode = formData.get('product_code') as ProductCode | null;

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

    const results: ParseResult[] = [];
    const startTime = Date.now();

    for (const file of files) {
      const result: ParseResult = {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        success: false,
      };

      try {
        // Check file size
        if (file.size > MAX_FILE_SIZE) {
          const sizeInMB = (file.size / 1024 / 1024).toFixed(2);
          result.error = `파일 크기는 4.5MB를 초과할 수 없습니다. (현재: ${sizeInMB}MB)`;

          // Create issue for oversized file
          const { data: issue } = await supabase
            .from('issues')
            .insert({
              product_code: productCode,
              issue_type: 'validation_error',
              description: `파일 크기 초과: ${file.name} (${sizeInMB}MB)`,
              file_names: [file.name],
              user_id: user.id,
              resolved: false,
            })
            .select()
            .single();

          if (issue) {
            result.issueId = issue.id;
          }

          results.push(result);
          continue;
        }

        // Check file type
        if (!SUPPORTED_FILE_TYPES.includes(file.type)) {
          result.error = '지원하지 않는 파일 형식입니다. (PDF, PNG, JPG, GIF, WEBP만 가능)';

          // Create issue for unsupported file type
          const { data: issue } = await supabase
            .from('issues')
            .insert({
              product_code: productCode,
              issue_type: 'validation_error',
              description: `지원하지 않는 파일 형식: ${file.name} (${file.type})`,
              file_names: [file.name],
              user_id: user.id,
              resolved: false,
            })
            .select()
            .single();

          if (issue) {
            result.issueId = issue.id;
          }

          results.push(result);
          continue;
        }

        console.log(`Processing: ${file.name} (${file.type})`);

        // Handle PDF files
        if (file.type === 'application/pdf') {
          try {
            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);

            // Extract text from PDF
            const rawText = await extractTextFromPDF(buffer);
            console.log(`PDF ${file.name} - Raw text length:`, rawText.length);

            // Extract quoted/tagged text
            const extractedTexts = extractAllText(rawText);
            console.log(`PDF ${file.name} - Extracted texts:`, extractedTexts.length);

            result.texts = extractedTexts.map(t => t.text);
            result.success = true;

            // If no text was extracted, create an issue
            if (extractedTexts.length === 0) {
              const { data: issue } = await supabase
                .from('issues')
                .insert({
                  product_code: productCode,
                  issue_type: 'pdf_parse_error',
                  description: `PDF 파일에서 텍스트를 추출하지 못했습니다: ${file.name}`,
                  file_names: [file.name],
                  user_id: user.id,
                  resolved: false,
                })
                .select()
                .single();

              if (issue) {
                result.issueId = issue.id;
              }
            }
          } catch (pdfError) {
            console.error(`Error parsing PDF ${file.name}:`, pdfError);
            result.error = 'PDF 파싱 중 오류가 발생했습니다.';

            // Create issue for PDF parse error
            const { data: issue } = await supabase
              .from('issues')
              .insert({
                product_code: productCode,
                issue_type: 'pdf_parse_error',
                description: `PDF 파싱 실패: ${file.name} - ${pdfError instanceof Error ? pdfError.message : '알 수 없는 오류'}`,
                file_names: [file.name],
                user_id: user.id,
                resolved: false,
              })
              .select()
              .single();

            if (issue) {
              result.issueId = issue.id;
            }
          }
        }

        // Handle image files
        else if (SUPPORTED_IMAGE_TYPES.includes(file.type)) {
          try {
            // For now, just store the file info and create a placeholder
            // Future: Integrate OCR service here
            result.texts = [];
            result.success = true;

            // Create issue for OCR placeholder
            const { data: issue } = await supabase
              .from('issues')
              .insert({
                product_code: productCode,
                issue_type: 'image_parse_error',
                description: `이미지 OCR 대기 중: ${file.name} (OCR 기능 추후 통합 예정)`,
                file_names: [file.name],
                user_id: user.id,
                resolved: false,
              })
              .select()
              .single();

            if (issue) {
              result.issueId = issue.id;
            }

            console.log(`Image ${file.name} - Stored for future OCR processing`);
          } catch (imageError) {
            console.error(`Error processing image ${file.name}:`, imageError);
            result.error = '이미지 처리 중 오류가 발생했습니다.';

            // Create issue for image processing error
            const { data: issue } = await supabase
              .from('issues')
              .insert({
                product_code: productCode,
                issue_type: 'image_parse_error',
                description: `이미지 처리 실패: ${file.name} - ${imageError instanceof Error ? imageError.message : '알 수 없는 오류'}`,
                file_names: [file.name],
                user_id: user.id,
                resolved: false,
              })
              .select()
              .single();

            if (issue) {
              result.issueId = issue.id;
            }
          }
        }
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        result.error = '파일 처리 중 오류가 발생했습니다.';

        // Create issue for general processing error
        const { data: issue } = await supabase
          .from('issues')
          .insert({
            product_code: productCode,
            issue_type: file.type === 'application/pdf' ? 'pdf_parse_error' : 'image_parse_error',
            description: `파일 처리 실패: ${file.name} - ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
            file_names: [file.name],
            user_id: user.id,
            resolved: false,
          })
          .select()
          .single();

        if (issue) {
          result.issueId = issue.id;
        }
      }

      results.push(result);
    }

    const endTime = Date.now();
    const processingTime = ((endTime - startTime) / 1000).toFixed(2);

    console.log('Processing time:', processingTime, 's');
    console.log('=== File Parse End ===');

    // Calculate summary
    const summary = {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      totalTexts: results.reduce((sum, r) => sum + (r.texts?.length || 0), 0),
    };

    return NextResponse.json({
      success: true,
      summary,
      results,
      scope,
      version,
      productCode,
      processingTime,
    });
  } catch (error) {
    console.error('File parsing error:', error);
    return NextResponse.json(
      { error: '파일 파싱 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
