import { SupabaseClient } from '@supabase/supabase-js';
import { Translation, TranslationStatus, ProductCode, PriorityLevel, Scope } from '@/types';
import { OptimisticLockService } from '@/services/optimistic_lock_service';
import { LockCheckResult, LockCheckOptions } from '@/types/optimistic_lock';

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
 * Options for update with optimistic locking
 */
export interface UpdateWithLockOptions {
  /** Expected version number for version-based locking */
  expectedVersion?: number;
  /** Expected timestamp for timestamp-based locking */
  expectedTimestamp?: string;
  /** Skip lock check if true (for admin operations) */
  skipLockCheck?: boolean;
}

/**
 * Repository for Translation database operations
 * Encapsulates all direct Supabase queries for translations table
 * 
 * Now supports optimistic locking via updateWithLock method
 */
export class TranslationRepository {
  private lockService: OptimisticLockService;

  constructor(private supabase: SupabaseClient) {
    this.lockService = new OptimisticLockService(supabase);
  }

  /**
   * Find a single translation by ID with related data
   */
  async findById(id: string): Promise<Translation | null> {
    // First, get the translation
    const { data: translation, error: translationError } = await this.supabase
      .from('translations')
      .select('*')
      .eq('id', id)
      .single();

    if (translationError) {
      if (translationError.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to find translation: ${translationError.message}`);
    }

    // Then fetch related data separately
    const [resultsData, productsData, platformsData] = await Promise.all([
      this.supabase.from('translation_results').select('*').eq('translation_id', id),
      this.supabase.from('translation_products').select('*').eq('translation_id', id),
      this.supabase.from('translation_platforms').select('*').eq('translation_id', id),
    ]);

    return {
      ...translation,
      translation_results: resultsData.data || [],
      translation_products: productsData.data || [],
      translation_platforms: platformsData.data || [],
    } as Translation;
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
        translation_products!inner (*),
        translation_platforms (*)
      `
      : `
        *,
        translation_results (*),
        translation_products (*),
        translation_platforms (*)
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
   * 
   * Note: This method does NOT perform optimistic locking.
   * For updates with conflict detection, use updateWithLock instead.
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
   * Update a translation with optimistic locking
   * 
   * Checks for concurrent edits before updating. Supports both version-based
   * and timestamp-based locking for backward compatibility.
   * 
   * @param id Translation ID
   * @param updates Updates to apply
   * @param lockOptions Lock check options
   * @returns Updated translation
   * @throws Error with code 'EDIT_CONFLICT' if lock check fails
   * 
   * @example
   * ```typescript
   * // Timestamp-based (backward compatible with existing UI)
   * await repo.updateWithLock('123', updates, { 
   *   expectedTimestamp: '2026-02-13T10:00:00.000Z' 
   * });
   * 
   * // Version-based (more robust)
   * await repo.updateWithLock('123', updates, { expectedVersion: 5 });
   * ```
   */
  async updateWithLock(
    id: string,
    updates: Partial<Translation>,
    lockOptions: UpdateWithLockOptions = {}
  ): Promise<Translation> {
    const { expectedVersion, expectedTimestamp, skipLockCheck } = lockOptions;

    // Perform lock check unless skipped
    if (!skipLockCheck && (expectedVersion !== undefined || expectedTimestamp)) {
      const lockResult = await this.lockService.checkVersion({
        id,
        entityType: 'translation',
        expectedVersion,
        expectedTimestamp,
      });

      if (!lockResult.success) {
        const error = this.lockService.formatConflictError(lockResult);
        const err = new Error(error.message);
        (err as any).code = error.code;
        (err as any).details = error.details;
        throw err;
      }
    }

    // Proceed with update
    return this.update(id, updates);
  }

  /**
   * Check if a translation can be updated without conflicts
   * 
   * @param id Translation ID
   * @param expectedVersion Expected version number (optional)
   * @param expectedTimestamp Expected timestamp (optional)
   * @returns Lock check result
   */
  async checkVersion(
    id: string,
    expectedVersion?: number,
    expectedTimestamp?: string
  ): Promise<LockCheckResult> {
    return this.lockService.checkVersion({
      id,
      entityType: 'translation',
      expectedVersion,
      expectedTimestamp,
    });
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

  /**
   * Get the underlying lock service for advanced operations
   * 
   * @returns OptimisticLockService instance
   */
  getLockService(): OptimisticLockService {
    return this.lockService;
  }
}
