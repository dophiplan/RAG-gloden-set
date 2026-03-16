/**
 * Supabase User Repository Implementation
 * 
 * IUserRepository 인터페이스의 Supabase 구현체
 * 기존 UsersRepository 코드를 어댑터 패턴으로 리팩토링하여 100% 하위호환 유지
 * 
 * @example
 * ```typescript
 * // Provider를 통해 사용
 * const provider = getDatabaseProvider();
 * const user = await provider.users.findById('user-id');
 * 
 * // 직접 사용
 * import { SupabaseUserRepository } from '@/repositories/implementations/supabase/user_repository';
 * const repo = new SupabaseUserRepository(supabase);
 * const user = await repo.findByEmail('user@example.com');
 * ```
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type {
  IUserRepository,
  User,
  UserCreateData,
  UserUpdateData,
  UserFilters,
  UserAuditLog,
  UserRole,
  UserStatus,
} from '@/repositories/interfaces/user_repository';
import type { PaginatedResult, PaginationParams } from '@/repositories/interfaces/base_repository';

/**
 * Supabase User Repository
 * 
 * 기존 UsersRepository의 모든 기능을 IUserRepository 인터페이스에 맞게 구현
 */
export class SupabaseUserRepository implements IUserRepository {
  constructor(private supabase: SupabaseClient) {}

  // ============================================================================
  // Read Operations
  // ============================================================================

  /**
   * ID로 사용자 조회
   */
  async findById(id: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return this.mapToUser(data);
  }

  /**
   * 이메일로 사용자 조회
   */
  async findByEmail(email: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !data) return null;
    return this.mapToUser(data);
  }

  /**
   * 필터와 페이지네이션으로 사용자 목록 조회
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
      data: (data || []).map(item => this.mapToUser(item)),
      count: count || 0,
    };
  }

  // ============================================================================
  // Single Item Write Operations (IUserRepository interface compliance)
  // ============================================================================

  /**
   * 단일 사용자 생성
   */
  async create(data: UserCreateData): Promise<User> {
    const { data: result, error } = await this.supabase
      .from('users')
      .insert({
        email: data.email,
        full_name: data.full_name ?? null,
        role: data.role ?? 'user',
        status: data.status ?? 'pending',
        avatar_url: data.avatar_url ?? null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }

    if (!result) {
      throw new Error('Failed to create user: no data returned');
    }

    return this.mapToUser(result);
  }

  /**
   * 단일 사용자 업데이트
   */
  async update(id: string, data: UserUpdateData): Promise<User | null> {
    const { data: result, error } = await this.supabase
      .from('users')
      .update({
        ...(data.email && { email: data.email }),
        ...(data.full_name !== undefined && { full_name: data.full_name }),
        ...(data.role && { role: data.role }),
        ...(data.status && { status: data.status }),
        ...(data.avatar_url !== undefined && { avatar_url: data.avatar_url }),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null;
      }
      throw new Error(`Failed to update user: ${error.message}`);
    }

    if (!result) {
      return null;
    }

    return this.mapToUser(result);
  }

  /**
   * 단일 사용자 삭제
   */
  async delete(id: string): Promise<boolean> {
    const { error, count } = await this.supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }

    return (count || 0) > 0;
  }

  // ============================================================================
  // Batch Operations (Backward Compatibility)
  // ============================================================================

  /**
   * 다중 사용자 생성 (기존 코드 하위호환)
   */
  async createMany(items: UserCreateData[]): Promise<User[]> {
    const { data, error } = await this.supabase
      .from('users')
      .insert(
        items.map(item => ({
          email: item.email,
          full_name: item.full_name ?? null,
          role: item.role ?? 'user',
          status: item.status ?? 'pending',
          avatar_url: item.avatar_url ?? null,
        }))
      )
      .select();

    if (error) {
      throw new Error(`Failed to create users: ${error.message}`);
    }

    return (data || []).map(item => this.mapToUser(item));
  }

  /**
   * 다중 사용자 업데이트 (기존 코드 하위호환)
   */
  async updateMany(ids: string[], updates: UserUpdateData): Promise<number> {
    const { error, count } = await this.supabase
      .from('users')
      .update({
        ...(updates.email && { email: updates.email }),
        ...(updates.full_name !== undefined && { full_name: updates.full_name }),
        ...(updates.role && { role: updates.role }),
        ...(updates.status && { status: updates.status }),
        ...(updates.avatar_url !== undefined && { avatar_url: updates.avatar_url }),
      })
      .in('id', ids);

    if (error) {
      throw new Error(`Failed to update users: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * 다중 사용자 삭제 (기존 코드 하위호환)
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

  // ============================================================================
  // Audit Log Operations
  // ============================================================================

  /**
   * Audit 로그 생성
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
      console.error('[SupabaseUserRepository] Failed to create audit log:', error);
      // Non-blocking: don't throw for audit log failures
    }
  }

  /**
   * 특정 사용자의 Audit 이력 조회 (IAuditableRepository)
   */
  async getAuditHistory(entityId: string, limit: number = 50): Promise<UserAuditLog[]> {
    const { data, error } = await this.supabase
      .from('user_audit_logs')
      .select('*')
      .eq('user_id', entityId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[SupabaseUserRepository] Failed to fetch audit history:', error);
      return [];
    }

    return (data || []).map(item => this.mapToAuditLog(item));
  }

  /**
   * 최근 변경사항 조회 (IAuditableRepository)
   */
  async getRecentChanges(limit: number = 50): Promise<UserAuditLog[]> {
    const { data, error } = await this.supabase
      .from('user_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[SupabaseUserRepository] Failed to fetch recent changes:', error);
      return [];
    }

    return (data || []).map(item => this.mapToAuditLog(item));
  }

  /**
   * 사용자 Audit 로그 조회 (IUserRepository 특화)
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
      console.error('[SupabaseUserRepository] Failed to fetch audit logs:', error);
      return [];
    }

    return (data || []).map(item => this.mapToAuditLog(item));
  }

  // ============================================================================
  // Mapping Helpers
  // ============================================================================

  /**
   * Supabase 데이터를 User 타입으로 매핑
   */
  private mapToUser(data: Record<string, unknown>): User {
    return {
      id: data.id as string,
      email: data.email as string,
      full_name: data.full_name as string | null,
      role: data.role as UserRole,
      status: data.status as UserStatus,
      avatar_url: data.avatar_url as string | null,
      created_at: data.created_at as string,
      updated_at: data.updated_at as string,
      last_sign_in_at: data.last_sign_in_at as string | null,
    };
  }

  /**
   * Supabase 데이터를 UserAuditLog 타입으로 매핑
   */
  private mapToAuditLog(data: Record<string, unknown>): UserAuditLog {
    return {
      id: data.id as string,
      user_id: data.user_id as string | null,
      action: data.action as string,
      details: data.details as Record<string, unknown> | null,
      performed_by: data.performed_by as string | null,
      created_at: data.created_at as string,
    };
  }
}

// ============================================================================
// Backward Compatibility Export
// ============================================================================

/**
 * @deprecated Use SupabaseUserRepository instead
 * 
 * 기존 UsersRepository와의 100% 하위호환을 위해 alias 제공
 * 기존 코드에서 import { UsersRepository } from '@/repositories/users_repository' 가
 * 계속 동작하도록 하기 위함
 */
export { SupabaseUserRepository as UsersRepository };
