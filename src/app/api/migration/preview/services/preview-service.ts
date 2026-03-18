/**
 * Migration Preview Service
 * Handles business logic for migration preview
 */

import { NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ProductCode } from '@/types';
import { checkDuplicatesBatch } from './duplicate-checker';
import { parseExcel } from '../parsers/excel-parser';
import { parseCSV } from '../parsers/csv-parser';

const debug = process.env.NODE_ENV === 'development'
  ? (...args: unknown[]) => console.log(...args)
  : () => {};

interface PreviewEntry {
  id: string;
  source_text: string;
  translations: Record<string, string>;
  status: 'exact' | 'similar' | 'new';
  where?: 'glossary' | 'translation' | 'both';
  existing_id?: string;
  word_count: number;
}

interface PreviewResult {
  entries: PreviewEntry[];
  summary: {
    total: number;
    new: number;
    exact: number;
    similar: number;
  };
}

/**
 * Authenticate user and check permissions
 */
export async function authenticateUser(request: NextRequest): Promise<{
  user: { id: string; email: string };
  supabase: SupabaseClient;
} | null> {
  const supabase = await createClient();
  let { data: { user }, error: authError } = await supabase.auth.getUser();

  // Development bypass
  if ((authError || !user) && process.env.NODE_ENV === 'development') {
    const adminClient = createAdminClient();
    const { data: existingUser } = await adminClient
      .from('users')
      .select('id, email')
      .eq('email', process.env.DEV_BYPASS_EMAIL || 'admin@example.com')
      .single();

    if (existingUser) {
      user = { id: existingUser.id, email: existingUser.email } as typeof user;
      authError = null;
    }
  }

  if (authError || !user) return null;

  // Check permissions
  const adminClient = createAdminClient();
  const { data: userProfile } = await adminClient
    .from('users')
    .select('roles')
    .eq('id', user.id)
    .single();

  const userRoles = userProfile?.roles || [];
  const hasPermission = ['admin', 'manager', '1st_master', 'master'].some(r => userRoles.includes(r));

  if (!hasPermission) return null;

  return { user: { id: user.id, email: user.email || '' }, supabase: adminClient };
}

/**
 * Parse uploaded file based on type
 */
export async function parseUploadedFile(
  file: File,
  fieldMappings: { source: string | null; translations: string[]; metadata: Record<string, string> } | null,
  selectedVersion: string | null
): Promise<Array<{ source_text: string; context?: string; [key: string]: string | undefined }>> {
  const fileType = file.name.toLowerCase();

  if (fileType.endsWith('.csv') || fileType.endsWith('.txt')) {
    const content = await file.text();
    return parseCSV(content, {
      productCode: '',
      hasSourceColumn: true,
      sourceColumnName: fieldMappings?.source || 'source_text',
      fieldMapping: fieldMappings?.metadata || {},
    });
  }

  if (fileType.endsWith('.xlsx') || fileType.endsWith('.xls')) {
    return parseExcel(file, selectedVersion, fieldMappings);
  }

  throw new Error('지원하지 않는 파일 형식입니다. CSV, TXT, XLSX 파일만 지원됩니다.');
}

/**
 * Generate preview entries from parsed rows
 */
export async function generatePreview(
  supabase: SupabaseClient,
  rows: Array<{ source_text: string; context?: string; [key: string]: string | undefined }>,
  productCode: ProductCode | null,
  _fieldMappings: { source: string | null; translations: string[]; metadata: Record<string, string> } | null
): Promise<PreviewResult> {
  const entries: PreviewEntry[] = [];
  const summary = { total: 0, new: 0, exact: 0, similar: 0 };

  // Extract source texts for batch duplicate check
  const sourceTexts = rows.map(row => row.source_text).filter(Boolean);
  const duplicateResults = await checkDuplicatesBatch(supabase, sourceTexts, productCode);

  for (const row of rows) {
    if (!row.source_text) continue;

    const dupResult = duplicateResults.get(row.source_text);
    const translations: Record<string, string> = {};

    // Extract translations from row
    Object.entries(row).forEach(([key, value]) => {
      if (key.startsWith('translation_') && value) {
        const langCode = key.replace('translation_', '');
        translations[langCode] = value;
      }
    });

    const entry: PreviewEntry = {
      id: crypto.randomUUID(),
      source_text: row.source_text,
      translations,
      status: dupResult?.status || 'new',
      where: dupResult?.where,
      existing_id: dupResult?.existing_id,
      word_count: row.source_text.split(/\s+/).length,
    };

    entries.push(entry);
    summary.total++;

    if (entry.status === 'new') summary.new++;
    else if (entry.status === 'exact') summary.exact++;
    else if (entry.status === 'similar') summary.similar++;
  }

  return { entries, summary };
}
