/**
 * Glossary Service
 * 
 * Business logic layer for glossary operations.
 * Wraps GlossaryRepository and adds bulk operation support.
 * 
 * @example
 * ```typescript
 * const service = new GlossaryService(supabase);
 * 
 * // Bulk create
 * const terms = await service.createBulk(
 *   [{ term: 'API', translation: 'API', ... }],
 *   { id: 'user-1', email: 'admin@example.com' }
 * );
 * ```
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { 
  GlossaryRepository, 
  GlossaryCreateData, 
  GlossaryUpdateData,
  GlossaryTerm,
  UserInfo 
} from '@/repositories/glossary_repository';
import type { PaginatedResult } from '@/repositories/translation_repository';

export interface BulkResult {
  id: string;
  success: boolean;
  error?: string;
}

export interface RevertResult {
  id: string;
  reverted: boolean;
  oldValue?: string;
  error?: string;
}

export interface SearchParams {
  productCode?: string;
  languageCode?: string;
  status?: 'pending' | 'approved' | 'rejected';
  search?: string;
  page?: number;
  limit?: number;
}



export class GlossaryService {
  private repository: GlossaryRepository;

  constructor(private supabase: SupabaseClient) {
    this.repository = new GlossaryRepository(supabase);
  }

  /**
   * Bulk create glossary terms
   */
  async createBulk(
    items: GlossaryCreateData[],
    userInfo: UserInfo
  ): Promise<{ terms: GlossaryTerm[]; errors: BulkResult[] }> {
    const errors: BulkResult[] = [];
    const createdTerms: GlossaryTerm[] = [];

    // Validate items
    for (const item of items) {
      if (!item.term || !item.translation) {
        errors.push({
          id: 'unknown',
          success: false,
          error: 'term and translation are required',
        });
      }
    }

    if (errors.length > 0) {
      return { terms: [], errors };
    }

    // Create terms one by one (Repository handles audit)
    for (const item of items) {
      try {
        const term = await this.repository.create(item, userInfo);
        createdTerms.push(term);
      } catch (error) {
        errors.push({
          id: 'unknown',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { terms: createdTerms, errors };
  }

  /**
   * Bulk update glossary terms
   */
  async updateBulk(
    items: Array<{ id: string } & GlossaryUpdateData>,
    userInfo: UserInfo
  ): Promise<BulkResult[]> {
    const results: BulkResult[] = [];

    for (const item of items) {
      try {
        await this.repository.updateWithAudit(item.id, item, userInfo);
        results.push({ id: item.id, success: true });
      } catch (error) {
        results.push({
          id: item.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Bulk delete glossary terms
   */
  async deleteBulk(
    ids: string[],
    userInfo: UserInfo
  ): Promise<number> {
    let deletedCount = 0;

    for (const id of ids) {
      try {
        await this.repository.deleteWithAudit(id, userInfo);
        deletedCount++;
      } catch (error) {
        console.error(`[GlossaryService] Failed to delete term ${id}:`, error);
        // Continue with other items
      }
    }

    return deletedCount;
  }

  /**
   * Revert glossary terms to previous values
   */
  async revertBulk(
    ids: string[],
    userInfo: UserInfo
  ): Promise<RevertResult[]> {
    const results: RevertResult[] = [];

    for (const id of ids) {
      try {
        // Get latest audit log for this term
        const auditLogs = await this.repository.getAuditHistory(id, 1);
        
        if (auditLogs.length === 0) {
          results.push({
            id,
            reverted: false,
            error: 'No audit history found',
          });
          continue;
        }

        const latestLog = auditLogs[0];
        
        if (!latestLog.old_value) {
          results.push({
            id,
            reverted: false,
            error: 'No previous value to revert to',
          });
          continue;
        }

        // Revert to old value
        await this.repository.updateWithAudit(
          id,
          { translation: latestLog.old_value },
          userInfo
        );

        results.push({
          id,
          reverted: true,
          oldValue: latestLog.old_value,
        });
      } catch (error) {
        results.push({
          id,
          reverted: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Search glossary terms with filters
   */
  async search(params: SearchParams): Promise<PaginatedResult<GlossaryTerm>> {
    const { 
      productCode, 
      languageCode, 
      status, 
      search, 
      page = 1, 
      limit = 20 
    } = params;

    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('glossary')
      .select('*', { count: 'exact' });

    if (productCode) {
      query = query.eq('product_code', productCode);
    }

    if (languageCode) {
      query = query.eq('language_code', languageCode);
    }

    if (status) {
      query = query.eq('approval_status', status);
    }

    if (search) {
      query = query.or(`term.ilike.%${search}%,translation.ilike.%${search}%`);
    }

    query = query.range(offset, offset + limit - 1);
    query = query.order('term', { ascending: true });

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to search glossary: ${error.message}`);
    }

    return {
      data: (data || []) as GlossaryTerm[],
      count: count || 0,
    };
  }

  /**
   * Get audit history for a term
   */
  async getAuditHistory(termId: string): Promise<ReturnType<GlossaryRepository['getAuditHistory']>> {
    return this.repository.getAuditHistory(termId);
  }
}
