import { ExtractedText } from '@/types';

// unpdf 라이브러리 - pdf.js 기반, 더 나은 텍스트 추출
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractTextFn: any = null;

async function loadUnpdf() {
  if (!extractTextFn) {
    const unpdf = await import('unpdf');
    extractTextFn = unpdf.extractText;
  }
  return extractTextFn;
}

/**
 * Extract text from PDF buffer using unpdf
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const extract = await loadUnpdf();
    const uint8Array = new Uint8Array(buffer);
    const result = await extract(uint8Array);
    
    // text can be string or array of strings
    if (Array.isArray(result.text)) {
      return result.text.join('\n');
    }
    return result.text || '';
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
