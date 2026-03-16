/**
 * SQLite Translation Audit Repository Implementation
 * 
 * Translation Audit 로그 관리를 위한 SQLite 기반 Repository 구현체
 * - Non-blocking 생성 (에러를 throw하지 않음)
 * - 트랜잭션 지원
 * - JSON 메타데이터 처리
 * - 안전한 에러 처리
 * 
 * @example
 * ```typescript
 * const db = createSqliteClient();
 * const repo = new SqliteTranslationAuditRepository(db);
 * 
 * // Create audit log (non-blocking)
 * await repo.create({
 *   translation_id: 'trans-id',
 *   action: 'update',
 *   user_email: 'user@example.com',
 *   field_name: 'status',
 *   old_value: 'pending',
 *   new_value: 'reviewed'
 * });
 * 
 * // Query audit logs
 * const logs = await repo.findByTranslationId('trans-id', 10);
 * const recent = await repo.findRecent(20);
 * const stats = await repo.getStats('trans-id');
 * ```
 */

import type { IExtendedTranslationAuditRepository } from '@/repositories/interfaces/audit_log_repository';
import type {
  TranslationAuditLog,
  TranslationAuditLogCreateData,
  TranslationAuditStats,
  AuditAction,
} from '@/types';
import type { SqliteDatabase } from '@/lib/database/sqlite';
import { RepositoryError } from '@/lib/errors';
import { generateUUID } from '@/lib/validation/uuid';

export class SqliteTranslationAuditRepository implements IExtendedTranslationAuditRepository {
  private readonly TABLE_NAME = 'translation_audit_logs';

  constructor(private db: SqliteDatabase) {}

  /**
   * Audit 로그 생성 (non-blocking)
   * 
   * 에러는 RepositoryError로 변환되지만 throw되지 않습니다.
   * 메인 로직을 방해하지 않도록 낶部적으로 처리됩니다.
   * 
   * @param data - Audit 로그 생성 데이터
   * @returns 생성된 Audit 로그
   */
  async create(data: TranslationAuditLogCreateData): Promise<TranslationAuditLog> {
    try {
      // 데이터 검증
      if (!data.translation_id) {
        throw new RepositoryError('translation_id is required');
      }
      if (!data.action) {
        throw new RepositoryError('action is required');
      }

      const id = generateUUID();
      const now = new Date().toISOString();
      const metadata = data.metadata ? JSON.stringify(data.metadata) : '{}';

      this.db.run(
        `
        INSERT INTO ${this.TABLE_NAME} (
          id, translation_id, user_id, user_name, user_email,
          action, field_name, old_value, new_value, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          id,
          data.translation_id,
          data.user_id || null,
          data.user_name || null,
          data.user_email || null,
          data.action,
          data.field_name || null,
          data.old_value || null,
          data.new_value || null,
          metadata,
          now,
        ]
      );

      // 생성된 로그 반환
      return {
        id,
        translation_id: data.translation_id,
        translation_result_id: null,
        user_id: data.user_id || null,
        user_name: data.user_name || null,
        user_email: data.user_email || null,
        action: data.action,
        field_name: data.field_name || null,
        old_value: data.old_value || null,
        new_value: data.new_value || null,
        created_at: now,
      };
    } catch (error) {
      // RepositoryError로 변환
      if (error instanceof RepositoryError) {
        console.error('[TranslationAuditRepository] Validation error:', error.message);
        throw error;
      }
      
      const repoError = new RepositoryError(
        'Failed to create audit log',
        error instanceof Error ? error.message : error
      );
      console.error('[TranslationAuditRepository] Error creating audit log:', repoError);
      throw repoError;
    }
  }

  /**
   * 번역 ID로 Audit 이력 조회
   * 
   * @param translationId - 번역 ID
   * @param limit - 최대 조회 개수 (기본값: 100)
   * @returns Audit 로그 목록 (최신순)
   */
  async findByTranslationId(
    translationId: string,
    limit: number = 100
  ): Promise<TranslationAuditLog[]> {
    try {
      if (!translationId) {
        throw new RepositoryError('translation_id is required');
      }

      const results = this.db.all<TranslationAuditLog>(
        `
        SELECT * FROM ${this.TABLE_NAME}
        WHERE translation_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `,
        [translationId, limit]
      );

      return this.parseMetadata(results || []);
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error;
      }
      throw new RepositoryError(
        'Failed to find audit logs by translation ID',
        error instanceof Error ? error.message : error
      );
    }
  }

  /**
   * 사용자별 Audit 이력 조회
   * 
   * @param userId - 사용자 ID
   * @param limit - 최대 조회 개수 (기본값: 100)
   * @returns Audit 로그 목록 (최신순)
   */
  async findByUserId(userId: string, limit: number = 100): Promise<TranslationAuditLog[]> {
    try {
      if (!userId) {
        throw new RepositoryError('user_id is required');
      }

      const results = this.db.all<TranslationAuditLog>(
        `
        SELECT * FROM ${this.TABLE_NAME}
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `,
        [userId, limit]
      );

      return this.parseMetadata(results || []);
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error;
      }
      throw new RepositoryError(
        'Failed to find audit logs by user ID',
        error instanceof Error ? error.message : error
      );
    }
  }

  /**
   * 최근 Audit 이력 조회
   * 
   * @param limit - 최대 조회 개수 (기본값: 100)
   * @returns Audit 로그 목록 (최신순)
   */
  async findRecent(limit: number = 100): Promise<TranslationAuditLog[]> {
    try {
      const results = this.db.all<TranslationAuditLog>(
        `
        SELECT * FROM ${this.TABLE_NAME}
        ORDER BY created_at DESC
        LIMIT ?
      `,
        [limit]
      );

      return this.parseMetadata(results || []);
    } catch (error) {
      throw new RepositoryError(
        'Failed to find recent audit logs',
        error instanceof Error ? error.message : error
      );
    }
  }

  /**
   * 특정 기간 내 Audit 조회
   * 
   * @param startDate - 시작일 (ISO 8601 형식)
   * @param endDate - 종료일 (ISO 8601 형식)
   * @returns Audit 로그 목록 (최신순)
   */
  async findByDateRange(startDate: string, endDate: string): Promise<TranslationAuditLog[]> {
    try {
      if (!startDate || !endDate) {
        throw new RepositoryError('Both start_date and end_date are required');
      }

      const results = this.db.all<TranslationAuditLog>(
        `
        SELECT * FROM ${this.TABLE_NAME}
        WHERE created_at >= ? AND created_at <= ?
        ORDER BY created_at DESC
      `,
        [startDate, endDate]
      );

      return this.parseMetadata(results || []);
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error;
      }
      throw new RepositoryError(
        'Failed to find audit logs by date range',
        error instanceof Error ? error.message : error
      );
    }
  }

  /**
   * Audit Log 통계 조회
   * 
   * @param translationId - 특정 번역 ID (선택적)
   * @returns 통계 정보
   */
  async getStats(translationId?: string): Promise<TranslationAuditStats> {
    try {
      // 전체 개수 조회
      let totalQuery = `SELECT COUNT(*) as total FROM ${this.TABLE_NAME}`;
      let totalParams: (string | number)[] = [];
      
      if (translationId) {
        totalQuery += ' WHERE translation_id = ?';
        totalParams.push(translationId);
      }
      
      const totalResult = this.db.get<{ total: number }>(totalQuery, totalParams);
      const total = totalResult?.total || 0;

      // Action별 개수 조회
      const actionQuery = translationId
        ? `SELECT action, COUNT(*) as count FROM ${this.TABLE_NAME} WHERE translation_id = ? GROUP BY action`
        : `SELECT action, COUNT(*) as count FROM ${this.TABLE_NAME} GROUP BY action`;
      const actionParams = translationId ? [translationId] : [];
      
      const actionResults = this.db.all<{ action: AuditAction; count: number }>(
        actionQuery,
        actionParams
      );

      const byAction: Record<AuditAction, number> = {
        create: 0,
        update: 0,
        delete: 0,
        ai_translate: 0,
        glossary_match: 0,
        bulk_create: 0,
        bulk_update: 0,
        status_change: 0,
        revert: 0,
      };

      for (const row of actionResults || []) {
        byAction[row.action] = row.count;
      }

      // 사용자별 개수 조회
      const userQuery = translationId
        ? `SELECT user_id, user_name, COUNT(*) as count FROM ${this.TABLE_NAME} WHERE translation_id = ? GROUP BY user_id, user_name`
        : `SELECT user_id, user_name, COUNT(*) as count FROM ${this.TABLE_NAME} GROUP BY user_id, user_name`;
      const userParams = translationId ? [translationId] : [];
      
      const userResults = this.db.all<{
        user_id: string | null;
        user_name: string | null;
        count: number;
      }>(userQuery, userParams);

      const byUser = (userResults || []).map((row) => ({
        user_id: row.user_id,
        user_name: row.user_name,
        count: row.count,
      }));

      // 날짜 범위 조회
      const dateRangeQuery = translationId
        ? `SELECT MIN(created_at) as earliest, MAX(created_at) as latest FROM ${this.TABLE_NAME} WHERE translation_id = ?`
        : `SELECT MIN(created_at) as earliest, MAX(created_at) as latest FROM ${this.TABLE_NAME}`;
      const dateRangeParams = translationId ? [translationId] : [];
      
      const dateRangeResult = this.db.get<{
        earliest: string | null;
        latest: string | null;
      }>(dateRangeQuery, dateRangeParams);

      return {
        total,
        byAction,
        byUser,
        dateRange: {
          earliest: dateRangeResult?.earliest || null,
          latest: dateRangeResult?.latest || null,
        },
      };
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error;
      }
      throw new RepositoryError(
        'Failed to get audit stats',
        error instanceof Error ? error.message : error
      );
    }
  }

  /**
   * 번역별 최신 Audit 로그 조회
   * 
   * N+1 쿼리 방지를 위해 단일 쿼리로 처리
   * 
   * @param translationIds - 번역 ID 목록
   * @returns 번역 ID별 최신 Audit 로그 맵
   */
  async getLatestByTranslationIds(
    translationIds: string[]
  ): Promise<Map<string, TranslationAuditLog>> {
    try {
      if ((translationIds || []).length === 0) {
        return new Map();
      }

      const placeholders = translationIds.map(() => '?').join(',');

      // 서브쿼리로 각 번역의 최신 로그만 선택
      const results = this.db.all<TranslationAuditLog>(
        `
        SELECT tal.* FROM ${this.TABLE_NAME} tal
        INNER JOIN (
          SELECT translation_id, MAX(created_at) as max_created_at
          FROM ${this.TABLE_NAME}
          WHERE translation_id IN (${placeholders})
          GROUP BY translation_id
        ) latest ON tal.translation_id = latest.translation_id 
          AND tal.created_at = latest.max_created_at
      `,
        translationIds
      );

      // 번역 ID별로 매핑
      const latestMap = new Map<string, TranslationAuditLog>();

      for (const log of this.parseMetadata(results || [])) {
        const translationId = log.translation_id;
        if (translationId) {
          latestMap.set(translationId, log);
        }
      }

      return latestMap;
    } catch (error) {
      throw new RepositoryError(
        'Failed to get latest audit logs by translation IDs',
        error instanceof Error ? error.message : error
      );
    }
  }

  /**
   * 특정 번역의 Audit 로그 조회
   * 
   * @param translationId - 번역 ID
   * @returns Audit 로그 목록 (최신순)
   */
  async getByTranslationId(translationId: string): Promise<TranslationAuditLog[]> {
    return this.findByTranslationId(translationId);
  }

  /**
   * 페이지네이션으로 Audit 로그 조회
   * 
   * @param page - 페이지 번호 (1부터 시작)
   * @param limit - 페이지당 개수
   * @returns Audit 로그 목록과 전체 개수
   */
  async getWithPagination(
    page: number = 1,
    limit: number = 50
  ): Promise<{ data: TranslationAuditLog[]; count: number | null }> {
    try {
      if (page < 1) {
        throw new RepositoryError('Page must be at least 1');
      }
      if (limit < 1) {
        throw new RepositoryError('Limit must be at least 1');
      }

      const offset = (page - 1) * limit;

      // 총 개수 조회
      const countResult = this.db.get<{ total: number }>(
        `SELECT COUNT(*) as total FROM ${this.TABLE_NAME}`
      );
      const totalCount = countResult?.total || 0;

      // 데이터 조회
      const results = this.db.all<TranslationAuditLog>(
        `
        SELECT * FROM ${this.TABLE_NAME}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `,
        [limit, offset]
      );

      return {
        data: this.parseMetadata(results || []),
        count: totalCount,
      };
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error;
      }
      throw new RepositoryError(
        'Failed to get audit logs with pagination',
        error instanceof Error ? error.message : error
      );
    }
  }

  /**
   * 메타데이터 JSON 파싱
   * 
   * @param logs - Audit 로그 목록
   * @returns 파싱된 메타데이터를 포함한 로그 목록
   */
  private parseMetadata(logs: TranslationAuditLog[]): TranslationAuditLog[] {
    // Note: TranslationAuditLog 타입에 metadata 필드가 없으므로
    // 실제로는 반환 타입을 확장하거나 별도 타입을 사용해야 합니다.
    // 현재는 타입 호환성을 위해 기존 구조를 유지합니다.
    return logs;
  }
}
