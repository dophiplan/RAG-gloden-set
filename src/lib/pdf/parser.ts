import { ExtractedText } from '@/types';

// pdf-parse v1.1.1 - 서버에서만 동작
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfParse: any = null;

async function loadPdfParse() {
  if (!pdfParse) {
    // 서버 환경에서만 동적 로드
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const module: any = await import('pdf-parse');
    pdfParse = module.default || module;
  }
  return pdfParse;
}

/**
 * Extract text from PDF buffer using pdf-parse v1.1.1
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const parse = await loadPdfParse();
    const data = await parse(buffer);
    return data.text || '';
  } catch (error) {
    console.error('PDF text extraction failed:', error);
    throw new Error('PDF 파싱 실패: ' + (error instanceof Error ? error.message : '알 수 없는 오류'));
  }
}

/**
 * Extract quoted text patterns from PDF content
 */
export function extractQuotedText(text: string): ExtractedText[] {
  const results: ExtractedText[] = [];
  const lines = text.split('\n');

  const quotePatterns = [
    /\'([^\']{2,})\'/g,
    /\"([^\"]{2,})\"/g,
    /\u2018([^\u2019]{2,})\u2019/g,
    /\u201C([^\u201D]{2,})\u201D/g,
    /\u300C([^\u300D]{2,})\u300D/g,
    /\u300E([^\u300F]{2,})\u300F/g,
  ];

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    for (const pattern of quotePatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(line)) !== null) {
        const extractedText = match[1].trim();
        if (extractedText && extractedText.length > 0 && !isNumericOnly(extractedText)) {
          results.push({ text: extractedText, lineNumber, matchType: 'single_quote' });
        }
      }
    }
  });

  const seen = new Set<string>();
  return results.filter((item) => {
    if (seen.has(item.text)) return false;
    seen.add(item.text);
    return true;
  });
}

function isNumericOnly(text: string): boolean {
  return /^[\d\s.,;:]+$/.test(text);
}

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
      if (extractedText) results.push({ text: extractedText, lineNumber, matchType: 'double_quote' });
    }
    while ((match = trTagPattern.exec(line)) !== null) {
      const extractedText = match[1].trim();
      if (extractedText) results.push({ text: extractedText, lineNumber, matchType: 'double_quote' });
    }
  });

  return results;
}

export function extractAllText(text: string): ExtractedText[] {
  const quoted = extractQuotedText(text);
  const tagged = extractTaggedText(text);
  const combined = [...quoted, ...tagged];
  const seen = new Set<string>();
  return combined.filter((item) => {
    if (seen.has(item.text)) return false;
    seen.add(item.text);
    return true;
  });
}
