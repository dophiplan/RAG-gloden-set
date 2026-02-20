/**
 * Glossary Repository
 * 
 * Provides data access for glossary terms with integrated audit logging.
 * Uses the AuditLogDecorator pattern for automatic audit trail creation.
 * 
 * @example
 * ```typescript
 * const repo = new GlossaryRepository(supabase);
 * 
 * // Create with audit log
 * const term = await repo.create({
 *   term: 'User',
 *   translation: '사용자',
 *   product_code: 'RC'
 * }, userInfo);
 * 
 * // Update with audit log
 * await repo.updateWithAudit('term-id', {
 *   translation: '유저'
 * }, userInfo);
 * ```
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface GlossaryTerm {
  id: string;
  term: string;
  translation: string;
  context?: string | null;
  language_code: string;
  product_code?: string | null;
  user_id?: string | null;
  source_type?: string | null;
  imported_at?: string | null;
  approval_status?: 'pending' | 'approved' | 'rejected' | null;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GlossaryCreateData {
  term: string;
  translation: string;
  context?: string | null;
  language_code?: string;
  product_code?: string | null;
  product_codes?: string[];
  source_type?: string;
  approval_status?: 'pending' | 'approved' | 'rejected';
}

export interface GlossaryUpdateData {
  term?: string;
  translation?: string;
  context?: string | null;
  product_code?: string | null;
  approval_status?: 'pending' | 'approved' | 'rejected';
}

export interface UserInfo {
  id: string;
  name?: string | null;
  email: string;
}

export interface GlossaryAuditLog {
  id: string;
  glossary_term_id: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Repository for Glossary database operations with audit logging
 */
export class GlossaryRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Find a glossary term by ID
   */
  async findById(id: string): Promise<GlossaryTerm | null> {
    const { data, error } = await this.supabase
      .from('glossary')
      .select(`
        *,
        glossary_products (product_code)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to find glossary term: ${error.message}`);
    }

    return data;
  }

  /**
   * Find exact matches for a term in glossary
   * Used by GlossaryAutoMatcher for auto-filling translations
   */
  async findExactMatches(params: {
    term: string;
    languageCodes: string[];
    productCode?: string | null;
    approvalStatus?: 'pending' | 'approved' | 'rejected';
  }): Promise<Array<GlossaryTerm & { hit_count?: number }>> {
    const { term, languageCodes, productCode, approvalStatus } = params;

    let query = this.supabase
      .from('glossary')
      .select('*')
      .eq('term', term)
      .in('language_code', languageCodes);

    if (productCode) {
      query = query.eq('product_code', productCode);
    }

    if (approvalStatus) {
      query = query.eq('approval_status', approvalStatus);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to find exact matches: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Increment hit count for a glossary term
   * Tracks how often a term is used
   */
  async incrementHitCount(term: string, languageCode: string): Promise<void> {
    const { error } = await this.supabase.rpc('increment_hit_count', {
      p_term: term,
      p_language_code: languageCode,
    });

    if (error) {
      // Log error but don't throw - hit count is not critical
      console.error('[GlossaryRepository] Failed to increment hit count:', error);
    }
  }

  /**
   * Find many glossary terms with filters
   */
  async findMany(params: {
    productCode?: string;
    languageCode?: string;
    search?: string;
    approvalStatus?: 'pending' | 'approved' | 'rejected';
    limit?: number;
    offset?: number;
  }): Promise<{ data: GlossaryTerm[]; count: number | null }> {
    const { productCode, languageCode, search, approvalStatus, limit = 50, offset = 0 } = params;

    let query = this.supabase
      .from('glossary')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (productCode) {
      query = query.eq('product_code', productCode);
    }

    if (languageCode) {
      query = query.eq('language_code', languageCode);
    }

    if (approvalStatus) {
      query = query.eq('approval_status', approvalStatus);
    }

    if (search) {
      query = query.or(`term.ilike.%${search}%,translation.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to find glossary terms: ${error.message}`);
    }

    return { data: data || [], count };
  }

  /**
   * Create a new glossary term with audit log
   */
  async create(
    data: GlossaryCreateData,
    userInfo: UserInfo
  ): Promise<GlossaryTerm> {
    // Create the glossary term
    const { data: term, error } = await this.supabase
      .from('glossary')
      .insert({
        term: data.term,
        translation: data.translation,
        context: data.context || null,
        language_code: data.language_code || 'en',
        product_code: data.product_code || null,
        source_type: data.source_type || 'manual',
        approval_status: data.approval_status || 'pending',
        imported_at: new Date().toISOString(),
        user_id: userInfo.id,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create glossary term: ${error.message}`);
    }

    // Create product associations if provided
    if (data.product_codes && data.product_codes.length > 0) {
      const productLinks = data.product_codes.map(code => ({
        glossary_id: term.id,
        product_code: code,
      }));

      await this.supabase.from('glossary_products').insert(productLinks);
    }

    // Create audit log (non-blocking)
    this.createAuditLog({
      glossary_term_id: term.id,
      user_id: userInfo.id,
      user_name: userInfo.name,
      user_email: userInfo.email,
      action: 'create',
      new_value: `${data.term} = ${data.translation}`,
      metadata: {
        language_code: data.language_code,
        product_codes: data.product_codes || [data.product_code],
        source_type: data.source_type,
      },
    }).catch(error => {
      console.error('[GlossaryRepository] Failed to create audit log:', error);
    });

    return term;
  }

  /**
   * Update a glossary term with audit log
   */
  async updateWithAudit(
    id: string,
    updates: GlossaryUpdateData,
    userInfo: UserInfo,
    options?: {
      oldValue?: string;
      fieldName?: string;
    }
  ): Promise<GlossaryTerm> {
    // Get current data for audit log
    const current = await this.findById(id);
    if (!current) {
      throw new Error('Glossary term not found');
    }

    // Update the term
    const { data: term, error } = await this.supabase
      .from('glossary')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update glossary term: ${error.message}`);
    }

    // Determine what changed for audit log
    const changedFields = Object.keys(updates).filter(
      key => updates[key as keyof GlossaryUpdateData] !== current[key as keyof GlossaryTerm]
    );

    // Create audit log for each changed field (non-blocking)
    for (const field of changedFields) {
      const oldValue = String(current[field as keyof GlossaryTerm] || '');
      const newValue = String(updates[field as keyof GlossaryUpdateData] || '');

      this.createAuditLog({
        glossary_term_id: id,
        user_id: userInfo.id,
        user_name: userInfo.name,
        user_email: userInfo.email,
        action: 'update',
        field_name: field,
        old_value: oldValue,
        new_value: newValue,
      }).catch(error => {
        console.error('[GlossaryRepository] Failed to create audit log:', error);
      });
    }

    return term;
  }

  /**
   * Delete a glossary term with audit log
   */
  async deleteWithAudit(
    id: string,
    userInfo: UserInfo
  ): Promise<void> {
    // Get current data before deletion
    const current = await this.findById(id);
    if (!current) {
      throw new Error('Glossary term not found');
    }

    // Delete the term
    const { error } = await this.supabase
      .from('glossary')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete glossary term: ${error.message}`);
    }

    // Create audit log (non-blocking)
    this.createAuditLog({
      glossary_term_id: id,
      user_id: userInfo.id,
      user_name: userInfo.name,
      user_email: userInfo.email,
      action: 'delete',
      old_value: `${current.term} = ${current.translation}`,
      metadata: {
        language_code: current.language_code,
        product_code: current.product_code,
      },
    }).catch(error => {
      console.error('[GlossaryRepository] Failed to create audit log:', error);
    });
  }

  /**
   * Approve a glossary term with audit log
   */
  async approveWithAudit(
    id: string,
    userInfo: UserInfo
  ): Promise<GlossaryTerm> {
    const current = await this.findById(id);
    if (!current) {
      throw new Error('Glossary term not found');
    }

    const { data: term, error } = await this.supabase
      .from('glossary')
      .update({
        approval_status: 'approved',
        approved_by: userInfo.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to approve glossary term: ${error.message}`);
    }

    // Create audit log (non-blocking)
    this.createAuditLog({
      glossary_term_id: id,
      user_id: userInfo.id,
      user_name: userInfo.name,
      user_email: userInfo.email,
      action: 'approve',
      field_name: 'approval_status',
      old_value: current.approval_status || 'pending',
      new_value: 'approved',
    }).catch(error => {
      console.error('[GlossaryRepository] Failed to create audit log:', error);
    });

    return term;
  }

  /**
   * Reject a glossary term with audit log
   */
  async rejectWithAudit(
    id: string,
    userInfo: UserInfo
  ): Promise<GlossaryTerm> {
    const current = await this.findById(id);
    if (!current) {
      throw new Error('Glossary term not found');
    }

    const { data: term, error } = await this.supabase
      .from('glossary')
      .update({
        approval_status: 'rejected',
        approved_by: userInfo.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to reject glossary term: ${error.message}`);
    }

    // Create audit log (non-blocking)
    this.createAuditLog({
      glossary_term_id: id,
      user_id: userInfo.id,
      user_name: userInfo.name,
      user_email: userInfo.email,
      action: 'reject',
      field_name: 'approval_status',
      old_value: current.approval_status || 'pending',
      new_value: 'rejected',
    }).catch(error => {
      console.error('[GlossaryRepository] Failed to create audit log:', error);
    });

    return term;
  }

  /**
   * Bulk operations with audit logs
   */
  async bulkApproveWithAudit(
    ids: string[],
    userInfo: UserInfo
  ): Promise<{ success: number; failed: number }> {
    const { data, error } = await this.supabase.rpc('bulk_approve_glossary', {
      p_term_ids: ids,
      p_approved_by: userInfo.id,
    });

    if (error) {
      throw new Error(`Failed to bulk approve: ${error.message}`);
    }

    // Create audit logs for approved terms (non-blocking)
    for (const id of ids) {
      this.createAuditLog({
        glossary_term_id: id,
        user_id: userInfo.id,
        user_name: userInfo.name,
        user_email: userInfo.email,
        action: 'bulk_approve',
        new_value: 'approved',
      }).catch(error => {
        console.error('[GlossaryRepository] Failed to create audit log:', error);
      });
    }

    return {
      success: data?.[0]?.success_count || 0,
      failed: data?.[0]?.failed_count || 0,
    };
  }

  /**
   * Get audit history for a glossary term
   */
  async getAuditHistory(
    termId: string,
    limit: number = 50
  ): Promise<GlossaryAuditLog[]> {
    const { data, error } = await this.supabase
      .from('glossary_audit_logs')
      .select('*')
      .eq('glossary_term_id', termId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get audit history: ${error.message}`);
    }

    return (data || []).map(log => ({
      ...log,
      metadata: log.metadata ? JSON.parse(JSON.stringify(log.metadata)) : null,
    }));
  }

  /**
   * Get recent changes across all glossary terms
   */
  async getRecentChanges(limit: number = 20): Promise<GlossaryAuditLog[]> {
    const { data, error } = await this.supabase
      .from('glossary_audit_logs')
      .select(`
        *,
        glossary:glossary_term_id (term)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get recent changes: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Create audit log entry
   * Public access for bulk operations from API handlers
   */
  async createAuditLog(data: {
    glossary_term_id: string;
    user_id: string;
    user_name?: string | null;
    user_email: string;
    action: string;
    field_name?: string | null;
    old_value?: string | null;
    new_value?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await this.supabase
      .from('glossary_audit_logs')
      .insert({
        glossary_term_id: data.glossary_term_id,
        user_id: data.user_id,
        user_name: data.user_name || null,
        user_email: data.user_email,
        action: data.action,
        field_name: data.field_name || null,
        old_value: data.old_value || null,
        new_value: data.new_value || null,
        metadata: data.metadata || null,
      });

    if (error) {
      throw new Error(`Failed to create audit log: ${error.message}`);
    }
  }
}

/**
 * Factory function to create GlossaryRepository
 */
export function createGlossaryRepository(supabase: SupabaseClient): GlossaryRepository {
  return new GlossaryRepository(supabase);
}
