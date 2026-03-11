import { SupabaseClient } from '@supabase/supabase-js';
import { TranslationResult, LanguageCode } from '@/types';

export interface TranslationResultCreateData {
  translation_id: string;
  language_code: LanguageCode;
  translated_text: string;
  reviewer_id: string;
  reviewed_at: string;
  source_type?: 'glossary' | 'ai' | 'manual' | 'imported' | null;
  glossary_term_id?: string | null;
}

/**
 * Repository for TranslationResult database operations
 * Handles translations in different languages
 */
export class TranslationResultRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Find translation results by translation ID
   */
  async findByTranslationId(translationId: string): Promise<TranslationResult[]> {
    const { data, error } = await this.supabase
      .from('translation_results')
      .select('*')
      .eq('translation_id', translationId);

    if (error) {
      throw new Error(`Failed to find translation results: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Find a single translation result
   */
  async findOne(
    translationId: string,
    languageCode: LanguageCode
  ): Promise<TranslationResult | null> {
    const { data, error } = await this.supabase
      .from('translation_results')
      .select('*')
      .eq('translation_id', translationId)
      .eq('language_code', languageCode)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to find translation result: ${error.message}`);
    }

    return data;
  }

  /**
   * Find translation result by translation ID and language code (alias for findOne)
   */
  async findByTranslationAndLanguage(
    translationId: string,
    languageCode: LanguageCode
  ): Promise<TranslationResult | null> {
    return this.findOne(translationId, languageCode);
  }

  /**
   * Create a single translation result
   */
  async create(result: TranslationResultCreateData): Promise<TranslationResult> {
    const { data, error } = await this.supabase
      .from('translation_results')
      .insert(result)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create translation result: ${error.message}`);
    }

    return data;
  }

  /**
   * Create translation results (bulk insert)
   */
  async createMany(results: TranslationResultCreateData[]): Promise<TranslationResult[]> {
    if (results.length === 0) return [];

    const { data, error } = await this.supabase
      .from('translation_results')
      .insert(results)
      .select();

    if (error) {
      throw new Error(`Failed to create translation results: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Update a translation result
   */
  async update(
    translationId: string,
    languageCode: LanguageCode,
    updates: Partial<TranslationResult>
  ): Promise<TranslationResult> {
    const { data, error } = await this.supabase
      .from('translation_results')
      .update(updates)
      .eq('translation_id', translationId)
      .eq('language_code', languageCode)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update translation result: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete translation results by translation ID
   */
  async deleteByTranslationId(translationId: string): Promise<void> {
    const { error } = await this.supabase
      .from('translation_results')
      .delete()
      .eq('translation_id', translationId);

    if (error) {
      throw new Error(`Failed to delete translation results: ${error.message}`);
    }
  }

  /**
   * Upsert (insert or update) a translation result
   */
  async upsert(result: TranslationResultCreateData): Promise<TranslationResult> {
    const { data, error } = await this.supabase
      .from('translation_results')
      .upsert(
        {
          ...result,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'translation_id,language_code',
        }
      )
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to upsert translation result: ${error.message}`);
    }

    return data;
  }
}
