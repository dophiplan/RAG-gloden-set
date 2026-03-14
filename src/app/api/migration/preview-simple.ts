// Simple test version - direct column mapping
import * as XLSX from 'xlsx';

interface SimpleFieldMappings {
  source: string;  // column name for source
  translations: Record<string, string>;  // lang_code -> column name
}

export function parseExcelSimple(
  buffer: ArrayBuffer,
  sheetName: string,
  mappings: SimpleFieldMappings
) {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const worksheet = workbook.Sheets[sheetName];
  
  const jsonData: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { 
    header: 1,
    blankrows: false,
    defval: ''
  });
  
  const headers = jsonData[0] as string[];
  console.log('[Simple] Headers:', headers);
  console.log('[Simple] Source mapping:', mappings.source);
  console.log('[Simple] Translation mappings:', mappings.translations);
  
  // Find column indexes
  const sourceIdx = headers.indexOf(mappings.source);
  const translationIdxs: Record<string, number> = {};
  
  for (const [lang, colName] of Object.entries(mappings.translations)) {
    const idx = headers.indexOf(colName);
    translationIdxs[lang] = idx;
    console.log(`[Simple] ${lang} -> ${colName} = index ${idx}`);
  }
  
  if (sourceIdx === -1) {
    throw new Error(`Source column "${mappings.source}" not found`);
  }
  
  const rows = [];
  for (let i = 1; i < jsonData.length; i++) {
    const rowData = jsonData[i] as string[];
    const sourceText = rowData[sourceIdx]?.toString().trim();
    
    if (!sourceText) continue;
    
    const row: any = {
      source_text: sourceText,
      translations: {}
    };
    
    for (const [lang, idx] of Object.entries(translationIdxs)) {
      if (idx !== -1) {
        const value = rowData[idx]?.toString().trim();
        if (value) {
          row.translations[lang] = value;
        }
      }
    }
    
    rows.push(row);
  }
  
  console.log(`[Simple] Parsed ${rows.length} rows`);
  console.log('[Simple] First row:', rows[0]);
  
  return rows;
}
