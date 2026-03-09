import { extractTextFromPDF, extractAllText } from '@/lib/pdf/parser';

/**
 * PDF Content Validator
 * 
 * Validates PDF content extraction results.
 * Pure function - no side effects, easily testable.
 */

export interface PDFValidationResult {
  valid: boolean;
  rawTextLength: number;
  extractedTextCount: number;
  texts: string[];
  empty: boolean;
  error?: string;
}

export interface PDFParseOptions {
  minTextLength?: number;
  requireQuotedText?: boolean;
}

/**
 * Validate PDF content extraction
 * 
 * @param rawText - Raw text extracted from PDF
 * @param extractedTexts - Array of extracted text objects
 * @param options - Validation options
 * @returns PDFValidationResult with validation details
 * 
 * @example
 * validatePDFContent('Some text', [{ text: 'Some text', type: 'quoted' }])
 * // { valid: true, rawTextLength: 9, extractedTextCount: 1, texts: ['Some text'], empty: false }
 */
export function validatePDFContent(
  rawText: string,
  extractedTexts: Array<{ text: string; matchType?: string }>,
  options: PDFParseOptions = {}
): PDFValidationResult {
  const { minTextLength = 0 } = options;
  
  const texts = (extractedTexts || []).map(t => t.text);
  const empty = (texts || []).length === 0;
  const valid = rawText.length >= minTextLength;

  return {
    valid,
    rawTextLength: rawText.length,
    extractedTextCount: (texts || []).length,
    texts,
    empty,
    error: empty ? getEmptyPDFError() : undefined,
  };
}

/**
 * Check if PDF has any extractable text
 * 
 * @param extractedTexts - Array of extracted text objects
 * @returns boolean indicating if PDF has text
 */
export function hasExtractableText(
  extractedTexts: Array<{ text: string; matchType?: string }>
): boolean {
  return (extractedTexts || []).length > 0;
}

/**
 * Get error message for empty PDF
 * 
 * @returns Localized error message
 */
export function getEmptyPDFError(): string {
  return 'PDF 파일에서 텍스트를 추출하지 못했습니다.';
}

/**
 * Get error message for PDF parse error
 * 
 * @param error - Original error
 * @returns Localized error message with details
 */
export function getPDFParseError(error?: Error): string {
  if (error?.message) {
    return `PDF 파싱 실패: ${error.message}`;
  }
  return 'PDF 파싱 중 오류가 발생했습니다.';
}

/**
 * Parse and validate PDF buffer
 * 
 * @param buffer - PDF file buffer
 * @param fileName - Original file name for logging
 * @returns Promise<PDFValidationResult>
 * 
 * @example
 * const result = await parseAndValidatePDF(buffer, 'document.pdf');
 * if (result.valid) {
 *   console.log('Extracted texts:', result.texts);
 * }
 */
export async function parseAndValidatePDF(
  buffer: Buffer,
  fileName: string = 'unknown.pdf'
): Promise<PDFValidationResult> {
  try {
    // Extract raw text from PDF
    const rawText = await extractTextFromPDF(buffer);
    
    // Extract quoted/tagged text
    const extractedTexts = extractAllText(rawText);
    
    // Validate content
    return validatePDFContent(rawText, extractedTexts);
  } catch (error) {
    console.error(`PDF parsing error for ${fileName}:`, error);
    return {
      valid: false,
      rawTextLength: 0,
      extractedTextCount: 0,
      texts: [],
      empty: true,
      error: getPDFParseError(error instanceof Error ? error : undefined),
    };
  }
}

/**
 * Get summary of PDF extraction
 * 
 * @param results - Array of PDF validation results
 * @returns Summary object with statistics
 * 
 * @example
 * getPDFExtractionSummary([
 *   { valid: true, extractedTextCount: 5, texts: ['a', 'b', 'c', 'd', 'e'] },
 *   { valid: true, extractedTextCount: 2, texts: ['f', 'g'] },
 * ])
 * // { total: 2, successful: 2, failed: 0, totalTexts: 7 }
 */
export function getPDFExtractionSummary(
  results: Pick<PDFValidationResult, 'valid' | 'extractedTextCount'>[]
): {
  total: number;
  successful: number;
  failed: number;
  totalTexts: number;
} {
  return {
    total: (results || []).length,
    successful: (results || []).filter(r => r.valid && r.extractedTextCount > 0).length,
    failed: (results || []).filter(r => !r.valid || r.extractedTextCount === 0).length,
    totalTexts: results.reduce((sum, r) => sum + r.extractedTextCount, 0),
  };
}
