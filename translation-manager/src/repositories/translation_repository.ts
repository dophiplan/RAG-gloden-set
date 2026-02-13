import { SupabaseClient } from '@supabase/supabase-js';
import { Translation, TranslationStatus, ProductCode, PriorityLevel, Scope } from '@/types';

export interface TranslationFilters {
  status?: TranslationStatus;
  language?: string;
  search?: string;
  productCode?: ProductCode;
  requestId?: string;
  scope?: Scope;
  version?: string;
  createdAfter?: string;
  createdBefore?: string;
}

export interface TranslationCreateData {
  source_text: string;
  context?: string | null;
  version?: string | null;
  version_updated_at?: string | null;
  product_code?: ProductCode | null;
  scope?: Scope | null;
  priority?: PriorityLevel;
  completion_date?: string | null;
  user_id: string;
  status: TranslationStatus;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  count: number | null;
}

/**
 * Repository for Translation database operations
 * Encapsulates all direct Supabase queries for translations table
 */
export class TranslationRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Find a single translation by ID with related data
   */
  async findById(id: string): Promise<Translation | null> {
    const { data, error } = await this.supabase
      .from('translations')
      .select(`
        *,
        translation_results (*),
        translation_products (*),
        translation_platforms (*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to find translation: ${error.message}`);
    }

    return data;
  }

  /**
   * Find multiple translations with filters and pagination
   */
  async findMany(
    filters: TranslationFilters,
    pagination: PaginationParams
  ): Promise<PaginatedResult<Translation>> {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    // Build select statement with inner join if filtering by product
    const selectStatement = filters.productCode
      ? `
        *,
        translation_results (*),
        translation_products!inner (*)
      `
      : `
        *,
        translation_results (*),
        translation_products (*)
      `;

    let query = this.supabase
      .from('translations')
      .select(selectStatement, { count: 'exact' })
      .order('completion_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.language) {
      query = query.eq('translation_results.language_code', filters.language);
    }

    if (filters.productCode) {
      query = query.eq('translation_products.product_code', filters.productCode);
    }

    if (filters.requestId) {
      query = query.eq('request_id', filters.requestId);
    }

    if (filters.scope) {
      query = query.eq('scope', filters.scope);
    }

    if (filters.version) {
      query = query.ilike('version', `%${filters.version}%`);
    }

    if (filters.createdAfter) {
      query = query.gte('created_at', filters.createdAfter);
    }

    if (filters.createdBefore) {
      query = query.lte('created_at', filters.createdBefore);
    }

    if (filters.search) {
      // Search in both source_text and translated_text
      query = query.or(
        `source_text.ilike.%${filters.search}%,translation_results.translated_text.ilike.%${filters.search}%`
      );
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to find translations: ${error.message}`);
    }

    return { data: data || [], count };
  }

  /**
   * Create a new translation
   */
  async create(data: TranslationCreateData): Promise<Translation> {
    const { data: translation, error } = await this.supabase
      .from('translations')
      .insert(data)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create translation: ${error.message}`);
    }

    return translation;
  }

  /**
   * Update an existing translation
   */
  async update(id: string, updates: Partial<Translation>): Promise<Translation> {
    const { data, error } = await this.supabase
      .from('translations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update translation: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete a translation
   */
  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('translations')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete translation: ${error.message}`);
    }
  }

  /**
   * Bulk update translations
   */
  async bulkUpdateStatus(ids: string[], status: TranslationStatus): Promise<void> {
    const { error } = await this.supabase
      .from('translations')
      .update({ status, updated_at: new Date().toISOString() })
      .in('id', ids);

    if (error) {
      throw new Error(`Failed to bulk update translations: ${error.message}`);
    }
  }

  /**
   * Get translation IDs by filters (for audit queries)
   */
  async getIdsByFilter(filters: TranslationFilters): Promise<string[]> {
    let query = this.supabase
      .from('translations')
      .select('id');

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.productCode) {
      query = query.eq('product_code', filters.productCode);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get translation IDs: ${error.message}`);
    }

    return (data || []).map(t => t.id);
  }
}
