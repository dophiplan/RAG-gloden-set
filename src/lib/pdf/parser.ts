import { ExtractedText } from '@/types';

// pdf-parse는 서버 환경에서 동적으로 로드
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfParse: any = null;

async function loadPdfParse() {
  if (!pdfParse) {
    // 동적 import로 CommonJS 모듈 로드
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const module: any = await import('pdf-parse');
    pdfParse = module.default || module;
  }
  return pdfParse;
}

/**
 * Extract text from PDF buffer using pdf-parse
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const parse = await loadPdfParse();
    if (!parse) {
      throw new Error('PDF 파서를 로드할 수 없습니다');
    }
    const data = await parse(buffer);
    return data.text || '';
  } catch (error) {
    console.error('PDF text extraction failed:', error);
    throw new Error('PDF 파싱 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
  }
}

/**
 * Extract quoted text patterns from PDF content
 * Supports various quote styles including Korean quotes
 */
export function extractQuotedText(text: string): ExtractedText[] {
  const results: ExtractedText[] = [];
  const lines = text.split('\n');

  // Comprehensive quote patterns
  const quotePatterns = [
    // Standard ASCII single quotes U+0027
    /\'([^\']{2,})\'/g,
    // Standard ASCII double quotes U+0022
    /\"([^\"]{2,})\"/g,
    // Curly single quotes U+2018...U+2019
    /\u2018([^\u2019]{2,})\u2019/g,
    // Curly double quotes U+201C...U+201D
    /\u201C([^\u201D]{2,})\u201D/g,
    // Grave accent U+0060
    /\u0060([^\u0060]{2,})\u0060/g,
    // Acute accent U+00B4
    /\u00B4([^\u00B4]{2,})\u00B4/g,
    // Guillemets
    /\u00AB([^\u00BB]{2,})\u00BB/g,
    // Corner brackets 「」『』
    /\u300C([^\u300D]{2,})\u300D/g,
    /\u300E([^\u300F]{2,})\u300F/g,
    // Prime marks U+2032, U+2033
    /\u2032([^\u2032]{2,})\u2032/g,
    /\u2033([^\u2033]{2,})\u2033/g,
    // Modifier letter apostrophe U+02BC
    /\u02BC([^\u02BC]{2,})\u02BC/g,
    // Fullwidth quotes
    /\uFF07([^\uFF07]{2,})\uFF07/g,
    /\uFF02([^\uFF02]{2,})\uFF02/g,
    // Low-9 quotes U+201A U+201E
    /\u201A([^\u201B\u2019]{2,})[\u201B\u2019]/g,
    /\u201E([^\u201F\u201D]{2,})[\u201F\u201D]/g,
    // Mixed: opening curly with closing straight
    /\u2018([^\']{2,})\'/g,
    /\'([^\u2019]{2,})\u2019/g,
  ];

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    for (const pattern of quotePatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(line)) !== null) {
        const extractedText = match[1].trim();
        if (extractedText && extractedText.length > 0 && !isNumericOnly(extractedText)) {
          results.push({
            text: extractedText,
            lineNumber,
            matchType: 'single_quote',
          });
        }
      }
    }
  });

  // Remove duplicates while preserving order
  const seen = new Set<string>();
  return results.filter((item) => {
    if (seen.has(item.text)) {
      return false;
    }
    seen.add(item.text);
    return true;
  });
}

/**
 * Check if string contains only numbers and basic punctuation
 */
function isNumericOnly(text: string): boolean {
  return /^[\d\s.,;:]+$/.test(text);
}

/**
 * Extract text with optional tag patterns (for future use)
 * Supports {{TEXT:...}} or [TR]...[/TR] format
 */
export function extractTaggedText(text: string): ExtractedText[] {
  const results: ExtractedText[] = [];
  const lines = text.split('\n');

  const doubleBracePattern = /\{\{TEXT:([^}]+)\}\}/g;
  const trTagPattern = /\[TR\]([^\[]+)\[\/TR\]/g;

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    let match;
    while ((match = doubleBracePattern.exec(line)) !== null) {
      const extractedText = match[1].trim();
      if (extractedText) {
        results.push({
          text: extractedText,
          lineNumber,
          matchType: 'double_quote',
        });
      }
    }

    while ((match = trTagPattern.exec(line)) !== null) {
      const extractedText = match[1].trim();
      if (extractedText) {
        results.push({
          text: extractedText,
          lineNumber,
          matchType: 'double_quote',
        });
      }
    }
  });

  return results;
}

/**
 * Combined extraction: quotes and tags
 */
export function extractAllText(text: string): ExtractedText[] {
  const quoted = extractQuotedText(text);
  const tagged = extractTaggedText(text);

  // Merge and deduplicate
  const combined = [...quoted, ...tagged];
  const seen = new Set<string>();

  return combined.filter((item) => {
    if (seen.has(item.text)) {
      return false;
    }
    seen.add(item.text);
    return true;
  });
}
