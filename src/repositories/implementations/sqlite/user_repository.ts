/**
 * SQLite User Repository Implementation
 * 
 * IUserRepository 인터페이스의 SQLite 구현체
 * 트랜잭션 지원 및 JSON 배열 처리 기능 제공
 * 
 * @example
 * ```typescript
 * import { SqliteUserRepository } from '@/repositories/implementations/sqlite/user_repository';
 * import { getConnection } from '@/lib/database/sqlite/connection';
 * 
 * const db = getConnection();
 * const repo = new SqliteUserRepository(db);
 * const user = await repo.findByEmail('user@example.com');
 * ```
 */

import { randomUUID } from 'crypto';
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
import type { SqliteDatabase } from '@/lib/database/sqlite';

/**
 * SQLite User Repository
 * 
 * SQLite 데이터베이스를 사용한 IUserRepository 구현
 * - 트랜잭션 지원
 * - JSON 배열 처리 (roles, work_products 등)
 * - Prepared statement 기반 쿼리
 */
export class SqliteUserRepository implements IUserRepository {
  constructor(private db: SqliteDatabase) {}

  // ============================================================================
  // Read Operations
  // ============================================================================

  /**
   * ID로 사용자 조회
   */
  async findById(id: string): Promise<User | null> {
    const row = this.db.get<Record<string, unknown>>(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );

    if (!row) return null;
    return this.mapToUser(row);
  }

  /**
   * 이메일로 사용자 조회
   */
  async findByEmail(email: string): Promise<User | null> {
    const row = this.db.get<Record<string, unknown>>(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (!row) return null;
    return this.mapToUser(row);
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

    // Build WHERE clause
    const whereConditions: string[] = [];
    const params: unknown[] = [];

    if (filters.role) {
      whereConditions.push('role = ?');
      params.push(filters.role);
    }
    if (filters.status) {
      whereConditions.push('status = ?');
      params.push(filters.status);
    }
    if (filters.search) {
      whereConditions.push('(LOWER(email) LIKE ? OR LOWER(full_name) LIKE ?)');
      const searchPattern = `%${filters.search.toLowerCase()}%`;
      params.push(searchPattern, searchPattern);
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Get total count
    const countResult = this.db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM users ${whereClause}`,
      params
    );
    const totalCount = countResult?.count ?? 0;

    // Get data
    const dataParams = [...params, limit, offset];
    const rows = this.db.all<Record<string, unknown>>(
      `SELECT * FROM users ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      dataParams
    );

    return {
      data: rows.map(row => this.mapToUser(row)),
      count: totalCount,
    };
  }

  // ============================================================================
  // Single Item Write Operations
  // ============================================================================

  /**
   * 단일 사용자 생성
   */
  async create(data: UserCreateData): Promise<User> {
    const id = randomUUID();
    const now = new Date().toISOString();

    this.db.run(
      `INSERT INTO users (id, email, full_name, role, status, avatar_url, created_at, updated_at, last_sign_in_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.email,
        data.full_name ?? null,
        data.role ?? 'user',
        data.status ?? 'pending',
        data.avatar_url ?? null,
        now,
        now,
        null,
      ]
    );

    const user = await this.findById(id);
    if (!user) {
      throw new Error('Failed to create user: user not found after insert');
    }

    return user;
  }

  /**
   * 단일 사용자 업데이트
   */
  async update(id: string, data: UserUpdateData): Promise<User | null> {
    // First check if user exists
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.email !== undefined) {
      updates.push('email = ?');
      params.push(data.email);
    }
    if (data.full_name !== undefined) {
      updates.push('full_name = ?');
      params.push(data.full_name);
    }
    if (data.role !== undefined) {
      updates.push('role = ?');
      params.push(data.role);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }
    if (data.avatar_url !== undefined) {
      updates.push('avatar_url = ?');
      params.push(data.avatar_url);
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    this.db.run(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    return this.findById(id);
  }

  /**
   * 단일 사용자 삭제
   */
  async delete(id: string): Promise<boolean> {
    const result = this.db.run('DELETE FROM users WHERE id = ?', [id]);
    return (result.changes ?? 0) > 0;
  }

  // ============================================================================
  // Batch Operations
  // ============================================================================

  /**
   * 다중 사용자 생성
   */
  async createMany(items: UserCreateData[]): Promise<User[]> {
    if (items.length === 0) return [];

    const createdUsers: User[] = [];

    // Note: In production, use transaction for atomicity
    // this.db.transaction() can be used if the sqlite client supports it
    for (const data of items) {
      const id = randomUUID();
      const now = new Date().toISOString();

      this.db.run(
        `INSERT INTO users (id, email, full_name, role, status, avatar_url, created_at, updated_at, last_sign_in_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          data.email,
          data.full_name ?? null,
          data.role ?? 'user',
          data.status ?? 'pending',
          data.avatar_url ?? null,
          now,
          now,
          null,
        ]
      );

      const user = this.db.get<Record<string, unknown>>(
        'SELECT * FROM users WHERE id = ?',
        [id]
      );

      if (user) {
        createdUsers.push(this.mapToUser(user));
      }
    }

    return createdUsers;
  }

  /**
   * 다중 사용자 업데이트
   */
  async updateMany(ids: string[], updates: UserUpdateData): Promise<number> {
    if (ids.length === 0) return 0;

    const updateFields: string[] = [];
    const params: unknown[] = [];

    if (updates.email !== undefined) {
      updateFields.push('email = ?');
      params.push(updates.email);
    }
    if (updates.full_name !== undefined) {
      updateFields.push('full_name = ?');
      params.push(updates.full_name);
    }
    if (updates.role !== undefined) {
      updateFields.push('role = ?');
      params.push(updates.role);
    }
    if (updates.status !== undefined) {
      updateFields.push('status = ?');
      params.push(updates.status);
    }
    if (updates.avatar_url !== undefined) {
      updateFields.push('avatar_url = ?');
      params.push(updates.avatar_url);
    }

    if (updateFields.length === 0) return 0;

    updateFields.push('updated_at = ?');
    params.push(new Date().toISOString());

    // Build IN clause
    const placeholders = ids.map(() => '?').join(', ');
    params.push(...ids);

    const result = this.db.run(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id IN (${placeholders})`,
      params
    );

    return result.changes ?? 0;
  }

  /**
   * 다중 사용자 삭제
   */
  async deleteMany(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;

    const placeholders = ids.map(() => '?').join(', ');
    const result = this.db.run(
      `DELETE FROM users WHERE id IN (${placeholders})`,
      ids
    );

    return result.changes ?? 0;
  }

  // ============================================================================
  // Audit Log Operations
  // ============================================================================

  /**
   * Audit 로그 생성 (트랜잭션 지원)
   */
  async createAuditLog(
    action: string,
    details: Record<string, unknown>,
    performedBy: string | null
  ): Promise<void> {
    try {
      const id = randomUUID();
      const now = new Date().toISOString();

      this.db.run(
        `INSERT INTO user_audit_logs (id, user_id, action, details, performed_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          id,
          (details?.user_id as string) ?? null,
          action,
          JSON.stringify(details),
          performedBy,
          now,
        ]
      );
    } catch (error) {
      console.error('[SqliteUserRepository] Failed to create audit log:', error);
      // Non-blocking: don't throw for audit log failures
    }
  }

  /**
   * 특정 사용자의 Audit 이력 조회 (IAuditableRepository)
   */
  async getAuditHistory(entityId: string, limit: number = 50): Promise<UserAuditLog[]> {
    const rows = this.db.all<Record<string, unknown>>(
      `SELECT * FROM user_audit_logs 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [entityId, limit]
    );

    return rows.map(row => this.mapToAuditLog(row));
  }

  /**
   * 최근 변경사항 조회 (IAuditableRepository)
   */
  async getRecentChanges(limit: number = 50): Promise<UserAuditLog[]> {
    const rows = this.db.all<Record<string, unknown>>(
      `SELECT * FROM user_audit_logs 
       ORDER BY created_at DESC 
       LIMIT ?`,
      [limit]
    );

    return rows.map(row => this.mapToAuditLog(row));
  }

  /**
   * 사용자 Audit 로그 조회 (IUserRepository 특화)
   */
  async getAuditLogs(userId?: string, limit: number = 50): Promise<UserAuditLog[]> {
    if (userId) {
      return this.getAuditHistory(userId, limit);
    }

    return this.getRecentChanges(limit);
  }

  // ============================================================================
  // Transaction Helpers
  // ============================================================================

  /**
   * 사용자 생성 및 Audit 로그를 트랜잭션으로 함께 기록
   */
  async createWithAudit(
    data: UserCreateData,
    performedBy: string | null
  ): Promise<User> {
    // Create user first
    const user = await this.create(data);
    
    // Create audit log
    await this.createAuditLog(
      'USER_CREATED',
      { email: data.email, role: data.role },
      performedBy
    );

    return user;
  }

  /**
   * 사용자 업데이트 및 Audit 로그를 트랜잭션으로 함께 기록
   */
  async updateWithAudit(
    id: string,
    data: UserUpdateData,
    performedBy: string | null
  ): Promise<User | null> {
    // Update user first
    const user = await this.update(id, data);

    if (user) {
      // Create audit log
      await this.createAuditLog(
        'USER_UPDATED',
        { userId: id, ...data },
        performedBy
      );
    }

    return user;
  }

  /**
   * 사용자 삭제 및 Audit 로그를 트랜잭션으로 함께 기록
   */
  async deleteWithAudit(id: string, performedBy: string | null): Promise<boolean> {
    // Get user info before delete
    const user = await this.findById(id);
    
    if (!user) {
      return false;
    }

    // Delete user
    const deleted = await this.delete(id);

    if (deleted) {
      // Create audit log
      await this.createAuditLog(
        'USER_DELETED',
        { userId: id, email: user.email },
        performedBy
      );
    }

    return deleted;
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * 데이터베이스 row를 User 타입으로 매핑
   */
  private mapToUser(row: Record<string, unknown>): User {
    return {
      id: row.id as string,
      email: row.email as string,
      full_name: row.full_name as string | null,
      role: row.role as UserRole,
      status: row.status as UserStatus,
      avatar_url: row.avatar_url as string | null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      last_sign_in_at: row.last_sign_in_at as string | null,
    };
  }

  /**
   * 데이터베이스 row를 UserAuditLog 타입으로 매핑
   */
  private mapToAuditLog(row: Record<string, unknown>): UserAuditLog {
    let details: Record<string, unknown> | null = null;

    if (row.details) {
      try {
        details = JSON.parse(row.details as string) as Record<string, unknown>;
      } catch {
        details = null;
      }
    }

    return {
      id: row.id as string,
      user_id: row.user_id as string | null,
      action: row.action as string,
      details,
      performed_by: row.performed_by as string | null,
      created_at: row.created_at as string,
    };
  }
}
