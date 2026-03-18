/**
 * CSV file parser for migration preview
 */

interface ParseCSVOptions {
  productCode: string;
  hasSourceColumn: boolean;
  sourceColumnName: string;
  fieldMapping: Record<string, string>;
}

interface ParsedRow {
  source_text: string;
  context?: string;
  [key: string]: string | undefined;
}

/**
 * Parse CSV content into structured rows
 */
export function parseCSV(
  content: string,
  options: ParseCSVOptions
): ParsedRow[] {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < headers.length) continue;

    const row: ParsedRow = {
      source_text: '',
      context: options.productCode,
    };

    // Map columns based on field mapping
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j].trim();
      const value = values[j]?.trim() || '';
      const mappedField = options.fieldMapping[header];

      if (mappedField === 'source_text') {
        row.source_text = value;
      } else if (mappedField?.startsWith('translation_')) {
        row[mappedField] = value;
      } else if (mappedField) {
        row[mappedField] = value;
      }
    }

    if (row.source_text) {
      rows.push(row);
    }
  }

  return rows;
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());

  return values;
}
