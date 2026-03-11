/**
 * Users Repository
 * 
 * Provides data access for user management with integrated audit logging.
 * 
 * @example
 * ```typescript
 * const repo = new UsersRepository(supabase);
 * 
 * // Find by ID
 * const user = await repo.findById('user-id');
 * 
 * // Bulk create
 * await repo.createMany([{ email: 'test@example.com', ... }], userInfo);
 * ```
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { UserInfo } from './glossary_repository';
import type { PaginatedResult, PaginationParams } from './translation_repository';

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'translator' | 'reviewer' | 'user';
  status: 'active' | 'inactive' | 'pending';
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  last_sign_in_at: string | null;
}

export interface UserCreateData {
  email: string;
  full_name?: string | null;
  role?: 'admin' | 'translator' | 'reviewer' | 'user';
  status?: 'active' | 'inactive' | 'pending';
  avatar_url?: string | null;
}

export interface UserUpdateData {
  email?: string;
  full_name?: string | null;
  role?: 'admin' | 'translator' | 'reviewer' | 'user';
  status?: 'active' | 'inactive' | 'pending';
  avatar_url?: string | null;
}

export interface UserFilters {
  role?: string;
  status?: string;
  search?: string;
}



// UserInfo is imported from glossary_repository to avoid duplication

export interface UserAuditLog {
  id: string;
  user_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  performed_by: string | null;
  created_at: string;
}

/**
 * Repository for Users database operations
 */
export class UsersRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Find a user by ID
   */
  async findById(id: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return data as User;
  }

  /**
   * Find a user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !data) return null;
    return data as User;
  }

  /**
   * Find users with filters and pagination
   */
  async findMany(
    filters: UserFilters = {},
    pagination: Partial<PaginationParams> = {}
  ): Promise<PaginatedResult<User>> {
    const { page = 1, limit = 20 } = pagination;
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('users')
      .select('*', { count: 'exact' });

    // Apply filters
    if (filters.role) {
      query = query.eq('role', filters.role);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.search) {
      query = query.or(`email.ilike.%${filters.search}%,full_name.ilike.%${filters.search}%`);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);
    query = query.order('created_at', { ascending: false });

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }

    return {
      data: (data || []) as User[],
      count: count || 0,
    };
  }

  /**
   * Create multiple users
   */
  async createMany(users: UserCreateData[]): Promise<User[]> {
    const { data, error } = await this.supabase
      .from('users')
      .insert(users)
      .select();

    if (error) {
      throw new Error(`Failed to create users: ${error.message}`);
    }

    return (data || []) as User[];
  }

  /**
   * Update multiple users by IDs
   */
  async updateMany(ids: string[], updates: UserUpdateData): Promise<number> {
    const { error, count } = await this.supabase
      .from('users')
      .update(updates)
      .in('id', ids);

    if (error) {
      throw new Error(`Failed to update users: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * Delete multiple users by IDs
   */
  async deleteMany(ids: string[]): Promise<number> {
    const { error, count } = await this.supabase
      .from('users')
      .delete()
      .in('id', ids);

    if (error) {
      throw new Error(`Failed to delete users: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * Create audit log for user operations
   */
  async createAuditLog(
    action: string,
    details: Record<string, unknown>,
    performedBy: string | null
  ): Promise<void> {
    const { error } = await this.supabase
      .from('user_audit_logs')
      .insert({
        action,
        details,
        performed_by: performedBy,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('[UsersRepository] Failed to create audit log:', error);
      // Non-blocking: don't throw for audit log failures
    }
  }

  /**
   * Get audit logs for users
   */
  async getAuditLogs(userId?: string, limit: number = 50): Promise<UserAuditLog[]> {
    let query = this.supabase
      .from('user_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[UsersRepository] Failed to fetch audit logs:', error);
      return [];
    }

    return (data || []) as UserAuditLog[];
  }
}
