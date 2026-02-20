import { SupabaseClient } from '@supabase/supabase-js';
import { ProductCode } from '@/types';
import {
  validateFileType,
  isImageFile,
  isPDFFile,
  getUnsupportedFileTypeError,
} from '@/lib/validation/file_type_validator';
import {
  validateFileSize,
  getOversizedFileError,
} from '@/lib/validation/file_size_validator';
import {
  parseAndValidatePDF,
  getEmptyPDFError,
  getPDFParseError,
  PDFValidationResult,
} from '@/lib/validation/pdf_content_validator';

/**
 * File Upload Service
 * 
 * Orchestrates file upload processing including:
 * - File type validation
 * - File size validation
 * - Content extraction (PDF, images)
 * - Issue creation for errors
 * 
 * This service replaces the monolithic route handler with
 * a more maintainable and testable structure.
 */

export interface FileParseResult {
  fileName: string;
  fileSize: number;
  fileType: string;
  success: boolean;
  texts?: string[];
  error?: string;
  issueId?: string | null;
}

export interface FileUploadContext {
  supabase: SupabaseClient;
  userId: string;
  productCode: ProductCode | null;
}

export interface ProcessFileOptions {
  scope: 'SaaS' | 'Solution';
  version?: string | null;
}

/**
 * Create issue for file processing error
 * 
 * @param context - Upload context with supabase client and user info
 * @param file - File being processed
 * @param issueType - Type of issue
 * @param description - Issue description
 * @returns Promise with created issue ID or null
 */
export async function createFileIssue(
  context: FileUploadContext,
  file: { name: string; type: string },
  issueType: string,
  description: string
): Promise<string | null> {
  try {
    const { data: issue } = await context.supabase
      .from('issues')
      .insert({
        product_code: context.productCode,
        issue_type: issueType,
        description,
        file_names: [file.name],
        user_id: context.userId,
        resolved: false,
      })
      .select()
      .single();

    return issue?.id || null;
  } catch (error) {
    console.error('Failed to create issue:', error);
    return null;
  }
}

/**
 * Process a single file
 * 
 * @param file - File to process
 * @param context - Upload context
 * @param options - Processing options
 * @returns Promise<FileParseResult>
 */
export async function processFile(
  file: File,
  context: FileUploadContext,
  options: ProcessFileOptions
): Promise<FileParseResult> {
  const result: FileParseResult = {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    success: false,
  };

  try {
    // Step 1: Validate file size
    const sizeValidation = validateFileSize(file.size);
    if (!sizeValidation.valid) {
      result.error = sizeValidation.error;
      result.issueId = await createFileIssue(
        context,
        file,
        'validation_error',
        `파일 크기 초과: ${file.name} (${sizeValidation.sizeInMB.toFixed(2)}MB)`
      );
      return result;
    }

    // Step 2: Validate file type
    const typeValidation = validateFileType(file.type);
    if (!typeValidation.valid) {
      result.error = typeValidation.error;
      result.issueId = await createFileIssue(
        context,
        file,
        'validation_error',
        `지원하지 않는 파일 형식: ${file.name} (${file.type})`
      );
      return result;
    }

    // Step 3: Process based on file type
    if (isPDFFile(file.type)) {
      return await processPDFFile(file, context, result);
    }

    if (isImageFile(file.type)) {
      return await processImageFile(file, context, result);
    }

    // Should not reach here if validation is correct
    result.error = getUnsupportedFileTypeError();
    return result;
  } catch (error) {
    console.error(`Error processing file ${file.name}:`, error);
    result.error = '파일 처리 중 오류가 발생했습니다.';
    result.issueId = await createFileIssue(
      context,
      file,
      file.type === 'application/pdf' ? 'pdf_parse_error' : 'image_parse_error',
      `파일 처리 실패: ${file.name} - ${error instanceof Error ? error.message : '알 수 없는 오류'}`
    );
    return result;
  }
}

/**
 * Process PDF file
 * 
 * @param file - PDF file
 * @param context - Upload context
 * @param result - Result object to populate
 * @returns Promise<FileParseResult>
 */
async function processPDFFile(
  file: File,
  context: FileUploadContext,
  result: FileParseResult
): Promise<FileParseResult> {
  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const pdfValidation = await parseAndValidatePDF(buffer, file.name);

    result.texts = pdfValidation.texts;
    result.success = pdfValidation.valid;

    // If no text was extracted, create an issue
    if (pdfValidation.empty) {
      result.issueId = await createFileIssue(
        context,
        file,
        'pdf_parse_error',
        `PDF 파일에서 텍스트를 추출하지 못했습니다: ${file.name}`
      );
    }

    return result;
  } catch (error) {
    console.error(`Error parsing PDF ${file.name}:`, error);
    result.error = getPDFParseError(error instanceof Error ? error : undefined);
    result.issueId = await createFileIssue(
      context,
      file,
      'pdf_parse_error',
      `PDF 파싱 실패: ${file.name} - ${error instanceof Error ? error.message : '알 수 없는 오류'}`
    );
    return result;
  }
}

/**
 * Process image file
 * 
 * @param file - Image file
 * @param context - Upload context
 * @param result - Result object to populate
 * @returns Promise<FileParseResult>
 */
async function processImageFile(
  file: File,
  context: FileUploadContext,
  result: FileParseResult
): Promise<FileParseResult> {
  try {
    // For now, just store the file info and create a placeholder
    // Future: Integrate OCR service here
    result.texts = [];
    result.success = true;

    // Create issue for OCR placeholder
    result.issueId = await createFileIssue(
      context,
      file,
      'image_parse_error',
      `이미지 OCR 대기 중: ${file.name} (OCR 기능 추후 통합 예정)`
    );

    return result;
  } catch (error) {
    console.error(`Error processing image ${file.name}:`, error);
    result.error = '이미지 처리 중 오류가 발생했습니다.';
    result.issueId = await createFileIssue(
      context,
      file,
      'image_parse_error',
      `이미지 처리 실패: ${file.name} - ${error instanceof Error ? error.message : '알 수 없는 오류'}`
    );
    return result;
  }
}

/**
 * Process multiple files
 * 
 * @param files - Array of files to process
 * @param context - Upload context
 * @param options - Processing options
 * @returns Promise<FileParseResult[]>
 */
export async function processFiles(
  files: File[],
  context: FileUploadContext,
  options: ProcessFileOptions
): Promise<FileParseResult[]> {
  const results: FileParseResult[] = [];

  for (const file of files) {
    const result = await processFile(file, context, options);
    results.push(result);
  }

  return results;
}

/**
 * Calculate upload summary
 * 
 * @param results - Array of parse results
 * @returns Summary object with statistics
 */
export function calculateUploadSummary(results: FileParseResult[]): {
  total: number;
  successful: number;
  failed: number;
  totalTexts: number;
} {
  return {
    total: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    totalTexts: results.reduce((sum, r) => sum + (r.texts?.length || 0), 0),
  };
}

/**
 * Log upload processing metrics
 * 
 * @param startTime - Start time in milliseconds
 * @param results - Parse results
 */
export function logUploadMetrics(
  startTime: number,
  results: FileParseResult[]
): void {
  const endTime = Date.now();
  const processingTime = ((endTime - startTime) / 1000).toFixed(2);
  const summary = calculateUploadSummary(results);

  console.log('=== File Parse Metrics ===');
  console.log('Processing time:', processingTime, 's');
  console.log('Total files:', summary.total);
  console.log('Successful:', summary.successful);
  console.log('Failed:', summary.failed);
  console.log('Total texts extracted:', summary.totalTexts);
  console.log('==========================');
}
