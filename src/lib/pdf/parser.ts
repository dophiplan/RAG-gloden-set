import { ExtractedText } from '@/types';

// unpdf 라이브러리는 서버 환경에서 WASM 로딩 문제가 있어 동적 임포트 사용
let extractText: typeof import('unpdf').extractText | null = null;

async function loadUnpdf() {
  if (!extractText) {
    try {
      const unpdf = await import('unpdf');
      extractText = unpdf.extractText;
    } catch (error) {
      console.error('Failed to load unpdf:', error);
      throw new Error('PDF 라이브러리 로딩 실패');
    }
  }
  return extractText;
}

/**
 * Extract text from PDF buffer using unpdf
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  console.log('=== extractTextFromPDF called ===');
  console.log('Buffer size:', buffer.length);
  
  try {
    console.log('Loading unpdf library...');
    const extract = await loadUnpdf();
    if (!extract) {
      throw new Error('PDF 라이브러리를 로드할 수 없습니다');
    }
    console.log('Unpdf loaded successfully');
    
    const uint8Array = new Uint8Array(buffer);
    console.log('Converting to Uint8Array, size:', uint8Array.length);
    
    console.log('Calling extractText...');
    const result = await extract(uint8Array);
    console.log('Extract result:', { hasText: !!result.text, isArray: Array.isArray(result.text) });
    
    // text can be string or array of strings
    if (Array.isArray(result.text)) {
      return result.text.join('\n');
    }
    return result.text || '';
  } catch (error) {
    console.error('=== PDF text extraction failed ===');
    console.error('Error type:', typeof error);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Extract quoted text patterns from PDF content
 * Supports various quote styles including Korean quotes
 */
export function extractQuotedText(text: string): ExtractedText[] {
  const results: ExtractedText[] = [];
  const lines = text.split('\n');

  // Debug: Log character codes for lines that look like they have quotes
  console.log('=== extractQuotedText called ===');
  console.log('Total lines:', (lines || []).length);

  // Find lines that might have quotes by looking for Korean text patterns
  const potentialQuoteLines = (lines || []).filter((line, idx) => {
    // Lines that start with a quote-like character
    if (idx < 30) {
      const firstChar = line.charCodeAt(0);
      const hasQuoteLikeChar = (
        firstChar === 0x27 ||   // '
        firstChar === 0x22 ||   // "
        firstChar === 0x2018 || // '
        firstChar === 0x2019 || // '
        firstChar === 0x201C || // "
        firstChar === 0x201D || // "
        firstChar === 0x60 ||   // `
        firstChar === 0xB4     // ´
      );
      if (hasQuoteLikeChar || line.includes("'") || line.includes("'")) {
        console.log(`Line ${idx}: "${line.substring(0, 50)}" | First char code: U+${firstChar.toString(16).toUpperCase().padStart(4, '0')}`);
        // Log all character codes for short lines
        if (line.length < 30) {
          const codes = [...line].map((c, i) => `${i}:U+${c.charCodeAt(0).toString(16).toUpperCase()}`).join(' ');
          console.log(`  Codes: ${codes}`);
        }
      }
      return hasQuoteLikeChar;
    }
    return false;
  });

  console.log('Lines starting with quote-like char:', (potentialQuoteLines || []).length);

  // Comprehensive quote patterns - explicit patterns to avoid escaping issues
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

  console.log('Using', (quotePatterns || []).length, 'quote patterns');

  (lines || []).forEach((line, index) => {
    const lineNumber = index + 1;

    for (const pattern of quotePatterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(line)) !== null) {
        const extractedText = match[1].trim();
        if (extractedText && extractedText.length > 0 && !isNumericOnly(extractedText)) {
          console.log(`Match found on line ${lineNumber}: "${extractedText}"`);
          results.push({
            text: extractedText,
            lineNumber,
            matchType: 'single_quote',
          });
        }
      }
    }
  });

  console.log('Total matches before dedup:', results.length);

  // Remove duplicates while preserving order
  const seen = new Set<string>();
  return (results || []).filter((item) => {
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

  return (combined || []).filter((item) => {
    if (seen.has(item.text)) {
      return false;
    }
    seen.add(item.text);
    return true;
  });
}
