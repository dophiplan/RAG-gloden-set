/**
 * Excel file parser for migration preview
 * 
 * @deprecated This parser is too complex (400+ lines).
 * Consider splitting into smaller functions or using a streaming parser.
 */

import * as XLSX from 'xlsx';
import { detectLanguageByContent, extractLanguageCodeFromColumnName } from '../utils/language-mapping';

const debug = process.env.NODE_ENV === 'development' 
  ? (...args: unknown[]) => console.log(...args)
  : () => {};

interface FieldMappings {
  source: string | null;
  translations: string[];
  metadata: Record<string, string>;
}

interface ImportRow {
  source_text: string;
  context?: string;
  [key: string]: string | undefined;
}

/**
 * Parse Excel file into structured rows
 */
export async function parseExcel(
  file: File,
  selectedVersion: string | null,
  fieldMappings: FieldMappings | null
): Promise<ImportRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  const sheetName = selectSheet(workbook, selectedVersion);
  const worksheet = workbook.Sheets[sheetName];

  const jsonData: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { 
    header: 1,
    blankrows: false,
    defval: ''
  });

  if (!jsonData || jsonData.length < 2) {
    throw new Error('Excel 파일에 데이터가 없거나 헤더만 있습니다.');
  }

  const headers = jsonData[0] as string[];
  const columnMapping = buildColumnMapping(headers, jsonData, fieldMappings);

  return extractRows(jsonData, headers, columnMapping);
}

/**
 * Select appropriate sheet from workbook
 */
function selectSheet(workbook: XLSX.WorkBook, selectedVersion: string | null): string {
  if (selectedVersion && workbook.SheetNames.includes(selectedVersion)) {
    return selectedVersion;
  }
  if (workbook.SheetNames.length >= 1) {
    return workbook.SheetNames[0];
  }
  throw new Error('Excel 파일에 시트가 없습니다.');
}

/**
 * Build column mapping based on headers and field mappings
 */
function buildColumnMapping(
  headers: string[],
  jsonData: unknown[],
  fieldMappings: FieldMappings | null
): Record<string, number> {
  const columnMapping: Record<string, number> = {};

  if (fieldMappings?.source) {
    const sourceIndex = headers.findIndex(h => 
      h?.toString().trim() === fieldMappings.source || 
      h?.toString().trim().toLowerCase() === fieldMappings.source?.toLowerCase()
    );

    if (sourceIndex !== -1) {
      columnMapping['source'] = sourceIndex;
      processMetadataMappings(headers, fieldMappings, columnMapping, sourceIndex);
      processTranslationMappings(headers, jsonData, fieldMappings, columnMapping, sourceIndex);
    }
  } else {
    detectLanguagesBySampling(jsonData as unknown[][], headers, columnMapping, -1);
  }

  return columnMapping;
}

/**
 * Process metadata mappings (lang_XX, version)
 */
function processMetadataMappings(
  headers: string[],
  fieldMappings: FieldMappings,
  columnMapping: Record<string, number>,
  sourceIndex: number
): void {
  if (!fieldMappings.metadata) return;

  Object.entries(fieldMappings.metadata).forEach(([key, columnName]) => {
    if (!key.startsWith('lang_') || !columnName) return;

    const langCode = key.replace('lang_', '');
    const idx = headers.findIndex(h => h?.toString().trim() === columnName);

    if (idx !== -1 && idx !== sourceIndex) {
      columnMapping[`translation_${langCode}`] = idx;
    }
  });

  if (fieldMappings.metadata.version) {
    const versionIdx = headers.findIndex(h => 
      h?.toString().trim() === fieldMappings.metadata!.version
    );
    if (versionIdx !== -1) {
      columnMapping['version'] = versionIdx;
    }
  }
}

/**
 * Process translation field mappings with language detection
 */
function processTranslationMappings(
  headers: string[],
  jsonData: unknown[],
  fieldMappings: FieldMappings,
  columnMapping: Record<string, number>,
  sourceIndex: number
): void {
  const hasTranslationMapping = Object.keys(columnMapping).some(k => k.startsWith('translation_'));
  if (!hasTranslationMapping || !fieldMappings.translations?.length) return;

  const mappedLangs = new Set<string>();

  fieldMappings.translations.forEach((transField) => {
    if (!transField) return;

    const idx = headers.findIndex(h => {
      const headerStr = h?.toString().trim();
      if (!headerStr) return false;
      return headerStr === transField || headerStr.toLowerCase() === transField.toLowerCase();
    });

    if (idx === -1 || idx === sourceIndex) return;

    const langCode = detectLanguageFromColumn(jsonData as unknown[][], idx, transField);

    if (langCode && !mappedLangs.has(langCode)) {
      mappedLangs.add(langCode);
      columnMapping[`translation_${langCode}`] = idx;
    }
  });
}

/**
 * Detect language from column content
 */
function detectLanguageFromColumn(
  jsonData: unknown[][],
  colIdx: number,
  transField: string
): string | null {
  const sampleRows = jsonData.slice(1, Math.min(5, jsonData.length));
  const texts: string[] = [];

  for (const row of sampleRows) {
    const rowArray = row as (string | number | null | undefined)[];
    const val = rowArray[colIdx]?.toString().trim();
    if (val) texts.push(val);
  }

  for (const text of texts) {
    const langCode = detectLanguageByContent(text);
    if (langCode && langCode !== 'unknown') return langCode;
  }

  // Fallback to header name
  const directMatch = transField.match(/^(ko|en|ja|zh\-CN|zh\-TW|es|de|pt|fr)$/i);
  if (directMatch) {
    const matched = directMatch[0];
    return matched.startsWith('zh-') ? matched : matched.toLowerCase();
  }

  return extractLanguageCodeFromColumnName(transField);
}

/**
 * Detect languages by sampling column contents
 */
function detectLanguagesBySampling(
  jsonData: unknown[][],
  headers: string[],
  columnMapping: Record<string, number>,
  sourceIndex: number
): void {
  const sampleRows = jsonData.slice(1, Math.min(5, jsonData.length));
  const colCount = headers.length;

  for (let colIdx = 0; colIdx < colCount; colIdx++) {
    if (colIdx === sourceIndex) {
      columnMapping['source'] = colIdx;
      continue;
    }

    for (const row of sampleRows) {
      const rowArray = row as (string | number | null | undefined)[];
      const val = rowArray[colIdx]?.toString().trim();
      const langCode = detectLanguageByContent(val || '');

      if (langCode && langCode !== 'unknown') {
        columnMapping[`translation_${langCode}`] = colIdx;
        break;
      }
    }
  }
}

/**
 * Extract rows from parsed data based on column mapping
 */
function extractRows(
  jsonData: unknown[][],
  headers: string[],
  columnMapping: Record<string, number>
): ImportRow[] {
  const rows: ImportRow[] = [];

  for (let i = 1; i < jsonData.length; i++) {
    const row = jsonData[i] as (string | number | null | undefined)[];
    const importRow: ImportRow = { source_text: '' };

    if (columnMapping['source'] !== undefined) {
      importRow.source_text = row[columnMapping['source']]?.toString().trim() || '';
    }

    Object.entries(columnMapping).forEach(([key, colIdx]) => {
      if (key === 'source') return;
      importRow[key] = row[colIdx]?.toString().trim();
    });

    if (importRow.source_text) {
      rows.push(importRow);
    }
  }

  return rows;
}
