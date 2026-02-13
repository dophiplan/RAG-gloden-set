import { SupabaseClient } from '@supabase/supabase-js';
import { LanguageCode, ProductCode } from '@/types';

export interface GlossaryTerm {
  id: string;
  term: string;
  translation: string;
  language_code: LanguageCode;
  context?: string | null;
  product_code?: ProductCode | null;
  approval_status: 'pending' | 'approved' | 'rejected';
  hit_count: number;
  created_at: string;
  updated_at: string;
}

export interface GlossaryMatchFilters {
  term: string;
  languageCodes: LanguageCode[];
  productCode?: ProductCode;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
}

/**
 * Repository for Glossary database operations
 * Handles term matching and glossary lookups
 */
export class GlossaryRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Find exact matches in glossary for auto-fill
   */
  async findExactMatches(filters: GlossaryMatchFilters): Promise<GlossaryTerm[]> {
    let query = this.supabase
      .from('glossary')
      .select('*')
      .eq('term', filters.term)
      .in('language_code', filters.languageCodes);

    // Default to approved only unless specified
    if (filters.approvalStatus) {
      query = query.eq('approval_status', filters.approvalStatus);
    } else {
      query = query.eq('approval_status', 'approved');
    }

    // Filter by product code (match specific product or null/global terms)
    if (filters.productCode) {
      query = query.or(`product_code.eq.${filters.productCode},product_code.is.null`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Glossary] Failed to find exact matches:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Increment hit count for a glossary term (non-blocking)
   */
  async incrementHitCount(term: string, languageCode: LanguageCode): Promise<void> {
    try {
      const { error } = await this.supabase.rpc('increment_glossary_hit_count', {
        p_term: term,
        p_language_code: languageCode,
      });

      if (error) {
        console.error('[Glossary] Failed to increment hit count:', error);
        // Don't throw - hit count update failure should not break the main operation
      }
    } catch (error) {
      console.error('[Glossary] Unexpected error incrementing hit count:', error);
      // Don't throw - hit count update failure should not break the main operation
    }
  }

  /**
   * Find glossary term by ID
   */
  async findById(id: string): Promise<GlossaryTerm | null> {
    const { data, error } = await this.supabase
      .from('glossary')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to find glossary term: ${error.message}`);
    }

    return data;
  }

  /**
   * Search glossary terms with filters
   */
  async search(
    searchTerm: string,
    filters: {
      languageCode?: LanguageCode;
      productCode?: ProductCode;
      approvalStatus?: 'pending' | 'approved' | 'rejected';
    }
  ): Promise<GlossaryTerm[]> {
    let query = this.supabase
      .from('glossary')
      .select('*')
      .or(`term.ilike.%${searchTerm}%,translation.ilike.%${searchTerm}%`);

    if (filters.languageCode) {
      query = query.eq('language_code', filters.languageCode);
    }

    if (filters.productCode) {
      query = query.eq('product_code', filters.productCode);
    }

    if (filters.approvalStatus) {
      query = query.eq('approval_status', filters.approvalStatus);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to search glossary: ${error.message}`);
    }

    return data || [];
  }
}
