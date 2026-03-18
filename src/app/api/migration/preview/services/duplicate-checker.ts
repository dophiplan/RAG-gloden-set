/**
 * Duplicate checking service for migration preview
 * Supports both SQLite and Supabase modes
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { ProductCode } from '@/types';
import { isSQLiteMode, getSQLiteConnection } from '@/lib/api/sqlite-helper';

interface DuplicateResult {
  status: 'exact' | 'similar' | 'new';
  where?: 'glossary' | 'translation' | 'both';
  existing_id?: string;
  existing_translations?: Record<string, string>;
  similarity?: number;
}

interface GlossaryMatch {
  id: string;
  term: string;
  translation: string;
  language_code: string;
}

interface TranslationMatch {
  id: string;
  source_text: string;
}

interface TranslationResult {
  language_code: string;
  translated_text: string;
}

const CHUNK_SIZE = 500;

/**
 * Check duplicates for multiple source texts in batch
 * Optimized for N+1 query problem
 */
export async function checkDuplicatesBatch(
  supabase: SupabaseClient,
  sourceTexts: string[],
  productCode?: ProductCode | null
): Promise<Map<string, DuplicateResult>> {
  const result = new Map<string, DuplicateResult>();

  if (sourceTexts.length === 0) return result;

  if (isSQLiteMode()) {
    return checkDuplicatesSQLite(sourceTexts, productCode);
  }

  return checkDuplicatesSupabase(supabase, sourceTexts, productCode);
}

/**
 * Check duplicates using SQLite
 */
async function checkDuplicatesSQLite(
  sourceTexts: string[],
  productCode?: ProductCode | null
): Promise<Map<string, DuplicateResult>> {
  const result = new Map<string, DuplicateResult>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = await getSQLiteConnection() as any;

  const glossaryMap = await fetchGlossaryMatchesSQLite(db, sourceTexts);
  const translationIdsInProduct = productCode 
    ? await fetchProductTranslationIdsSQLite(db, productCode)
    : null;
  const translationMap = await fetchTranslationMatchesSQLite(
    db, 
    sourceTexts, 
    translationIdsInProduct
  );

  combineResults(result, sourceTexts, glossaryMap, translationMap);
  return result;
}

/**
 * Fetch glossary matches from SQLite
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchGlossaryMatchesSQLite(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  sourceTexts: string[]
): Promise<Map<string, { id: string; translations: Record<string, string> }>> {
  const glossaryMap = new Map<string, { id: string; translations: Record<string, string> }>();

  for (let i = 0; i < sourceTexts.length; i += CHUNK_SIZE) {
    const chunk = sourceTexts.slice(i, i + CHUNK_SIZE);
    const placeholders = chunk.map(() => '?').join(',');

    const glossaryMatches = db.all(`
      SELECT id, term, translation, language_code 
      FROM glossary 
      WHERE term IN (${placeholders})
    `, chunk) as GlossaryMatch[];

    for (const g of glossaryMatches) {
      if (!glossaryMap.has(g.term)) {
        glossaryMap.set(g.term, { id: g.id, translations: {} });
      }
      glossaryMap.get(g.term)!.translations[g.language_code] = g.translation;
    }
  }

  return glossaryMap;
}

/**
 * Fetch product translation IDs from SQLite
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchProductTranslationIdsSQLite(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  productCode: ProductCode
): Promise<Set<string>> {
  const productTranslations = db.all(
    'SELECT translation_id FROM translation_products WHERE product_code = ?',
    [productCode]
  ) as { translation_id: string }[];

  return new Set(productTranslations.map((pt: { translation_id: string }) => pt.translation_id));
}

/**
 * Fetch translation matches from SQLite
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchTranslationMatchesSQLite(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  sourceTexts: string[],
  translationIdsInProduct: Set<string> | null
): Promise<Map<string, { id: string; translations: Record<string, string> }>> {
  const translationMap = new Map<string, { id: string; translations: Record<string, string> }>();

  for (let i = 0; i < sourceTexts.length; i += CHUNK_SIZE) {
    const chunk = sourceTexts.slice(i, i + CHUNK_SIZE);
    const placeholders = chunk.map(() => '?').join(',');

    const translationMatches = db.all(`
      SELECT id, source_text 
      FROM translations 
      WHERE source_text IN (${placeholders})
    `, chunk) as TranslationMatch[];

    for (const t of translationMatches) {
      if (translationIdsInProduct !== null && !translationIdsInProduct.has(t.id)) {
        continue;
      }

      const trResults = db.all(
        'SELECT language_code, translated_text FROM translation_results WHERE translation_id = ?',
        [t.id]
      ) as TranslationResult[];

      const translations: Record<string, string> = {};
      for (const tr of trResults) {
        translations[tr.language_code] = tr.translated_text;
      }
      translationMap.set(t.source_text, { id: t.id, translations });
    }
  }

  return translationMap;
}

/**
 * Check duplicates using Supabase
 */
async function checkDuplicatesSupabase(
  supabase: SupabaseClient,
  sourceTexts: string[],
  productCode?: ProductCode | null
): Promise<Map<string, DuplicateResult>> {
  const result = new Map<string, DuplicateResult>();

  const glossaryMap = await fetchGlossaryMatchesSupabase(supabase, sourceTexts);
  const translationIdsInProduct = productCode
    ? await fetchProductTranslationIdsSupabase(supabase, productCode)
    : null;
  const translationMap = await fetchTranslationMatchesSupabase(
    supabase,
    sourceTexts,
    translationIdsInProduct
  );

  combineResults(result, sourceTexts, glossaryMap, translationMap);
  return result;
}

/**
 * Fetch glossary matches from Supabase
 */
async function fetchGlossaryMatchesSupabase(
  supabase: SupabaseClient,
  sourceTexts: string[]
): Promise<Map<string, { id: string; translations: Record<string, string> }>> {
  const glossaryMap = new Map<string, { id: string; translations: Record<string, string> }>();

  const { data: glossaryMatches } = await supabase
    .from('glossary')
    .select('id, term, translation, language_code')
    .in('term', sourceTexts);

  if (glossaryMatches) {
    for (const g of glossaryMatches) {
      if (!glossaryMap.has(g.term)) {
        glossaryMap.set(g.term, { id: g.id, translations: {} });
      }
      glossaryMap.get(g.term)!.translations[g.language_code] = g.translation;
    }
  }

  return glossaryMap;
}

/**
 * Fetch product translation IDs from Supabase
 */
async function fetchProductTranslationIdsSupabase(
  supabase: SupabaseClient,
  productCode: ProductCode
): Promise<Set<string>> {
  const { data: productTranslations } = await supabase
    .from('translation_products')
    .select('translation_id')
    .eq('product_code', productCode);

  if (productTranslations && productTranslations.length > 0) {
    return new Set(productTranslations.map(pt => pt.translation_id));
  }

  return new Set();
}

/**
 * Fetch translation matches from Supabase
 */
async function fetchTranslationMatchesSupabase(
  supabase: SupabaseClient,
  sourceTexts: string[],
  translationIdsInProduct: Set<string> | null
): Promise<Map<string, { id: string; translations: Record<string, string> }>> {
  const translationMap = new Map<string, { id: string; translations: Record<string, string> }>();

  const { data: translationMatches } = await supabase
    .from('translations')
    .select('id, source_text, translation_results(language_code, translated_text)')
    .in('source_text', sourceTexts);

  if (translationMatches) {
    for (const t of translationMatches) {
      if (translationIdsInProduct !== null && !translationIdsInProduct.has(t.id)) {
        continue;
      }

      const translations: Record<string, string> = {};
      if (t.translation_results) {
        for (const tr of t.translation_results as { language_code: string; translated_text: string }[]) {
          translations[tr.language_code] = tr.translated_text;
        }
      }
      translationMap.set(t.source_text, { id: t.id, translations });
    }
  }

  return translationMap;
}

/**
 * Combine glossary and translation matches into final result
 */
function combineResults(
  result: Map<string, DuplicateResult>,
  sourceTexts: string[],
  glossaryMap: Map<string, { id: string; translations: Record<string, string> }>,
  translationMap: Map<string, { id: string; translations: Record<string, string> }>
): void {
  for (const sourceText of sourceTexts) {
    const glossaryMatch = glossaryMap.get(sourceText);
    const translationMatch = translationMap.get(sourceText);

    if (glossaryMatch && translationMatch) {
      result.set(sourceText, {
        status: 'exact',
        where: 'both',
        existing_id: glossaryMatch.id,
        existing_translations: glossaryMatch.translations,
      });
    } else if (glossaryMatch) {
      result.set(sourceText, {
        status: 'exact',
        where: 'glossary',
        existing_id: glossaryMatch.id,
        existing_translations: glossaryMatch.translations,
      });
    } else if (translationMatch) {
      result.set(sourceText, {
        status: 'exact',
        where: 'translation',
        existing_id: translationMatch.id,
        existing_translations: translationMatch.translations,
      });
    } else {
      result.set(sourceText, { status: 'new' });
    }
  }
}

/**
 * Check duplicate for single source text (backward compatibility)
 */
export async function checkDuplicates(
  supabase: SupabaseClient,
  sourceText: string,
  _category: 'glossary' | 'translation',
  _translations: Record<string, string>
): Promise<DuplicateResult> {
  const batchResult = await checkDuplicatesBatch(supabase, [sourceText]);
  return batchResult.get(sourceText) || { status: 'new' };
}
