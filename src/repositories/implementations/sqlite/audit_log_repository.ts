/**
 * SQLite Audit Log Repository Implementation
 * 
 * Audit 로그 관리를 위한 SQLite 기반 Repository 구현체
 * - Non-blocking 생성 (에러를 throw하지 않음)
 * - 배치 처리 지원
 * - N+1 쿼리 방지
 * 
 * @example
 * ```typescript
 * const db = createSqliteClient();
 * const repo = new SqliteAuditLogRepository(db);
 * await repo.create({ translation_id: 'id', action: 'update', user_email: 'user@example.com' });
 * const logs = await repo.getByTranslationId('translation-id');
 * ```
 */

import type {
  IAuditLogRepository,
  GroupedAuditLogs,
} from '@/repositories/interfaces/audit_log_repository';
import type {
  PaginatedResult,
  PaginationParams,
} from '@/repositories/interfaces/base_repository';
import type { TranslationAuditLog, AuditLogCreateData } from '@/types';
import type { SqliteDatabase } from '@/lib/database/sqlite';
import { generateUUID } from '@/lib/validation/uuid';

export class SqliteAuditLogRepository implements IAuditLogRepository {
  private readonly TABLE_NAME = 'translation_audit_logs';

  constructor(private db: SqliteDatabase) {}

  /**
   * Audit 로그 생성 (non-blocking)
   * 
   * 에러는 로깅되지만 throw되지 않습니다.
   */
  async create(data: AuditLogCreateData): Promise<void> {
    try {
      // 데이터 검증
      if (!data.action) {
        console.error('[Audit Log] Validation failed: action is required');
        return;
      }

      const id = generateUUID();
      const now = new Date().toISOString();

      this.db.run(
        `
        INSERT INTO ${this.TABLE_NAME} (
          id, translation_id, translation_result_id, user_id, user_name, user_email,
          action, field_name, old_value, new_value, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          id,
          data.translation_id || null,
          data.translation_result_id || null,
          data.user_id || null,
          data.user_name || null,
          data.user_email || null,
          data.action,
          data.field_name || null,
          data.old_value || null,
          data.new_value || null,
          now,
        ]
      );
    } catch (error) {
      console.error('[Audit Log] Unexpected error creating audit log:', error);
    }
  }

  /**
   * 다중 Audit 로그 생성 (non-blocking, 배치 처리)
   */
  async createMany(items: AuditLogCreateData[], batchSize: number = 100): Promise<void> {
    if ((items || []).length === 0) return;

    try {
      // 유효한 항목만 필터링
      const validItems = (items || []).filter((item) => {
        if (!item.action) {
          console.error('[Audit Log] Validation failed: action is required');
          return false;
        }
        return true;
      });

      // 배치 처리
      const batches: AuditLogCreateData[][] = [];
      for (let i = 0; i < validItems.length; i += batchSize) {
        batches.push(validItems.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        const now = new Date().toISOString();

        this.db.transaction((trx) => {
          for (const item of batch) {
            const id = generateUUID();

            trx.run(
              `
              INSERT INTO ${this.TABLE_NAME} (
                id, translation_id, translation_result_id, user_id, user_name, user_email,
                action, field_name, old_value, new_value, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
              [
                id,
                item.translation_id || null,
                item.translation_result_id || null,
                item.user_id || null,
                item.user_name || null,
                item.user_email || null,
                item.action,
                item.field_name || null,
                item.old_value || null,
                item.new_value || null,
                now,
              ]
            );
          }
        });
      }
    } catch (error) {
      console.error('[Audit Log] Unexpected error creating batch audit logs:', error);
    }
  }

  /**
   * 특정 번역의 Audit 로그 조회
   */
  async getByTranslationId(translationId: string): Promise<TranslationAuditLog[]> {
    const results = this.db.all<TranslationAuditLog>(
      `
      SELECT * FROM ${this.TABLE_NAME}
      WHERE translation_id = ?
      ORDER BY created_at DESC
    `,
      [translationId]
    );

    return results || [];
  }

  /**
   * 다중 번역의 Audit 로그 조회 (배치 처리)
   */
  async getByTranslationIds(
    translationIds: string[],
    options?: { batchSize?: number }
  ): Promise<TranslationAuditLog[]> {
    if ((translationIds || []).length === 0) {
      return [];
    }

    const batchSize = options?.batchSize || 100;

    // 소규모 집합은 단일 쿼리로 처리
    if (translationIds.length <= batchSize) {
      const placeholders = translationIds.map(() => '?').join(',');
      const results = this.db.all<TranslationAuditLog>(
        `
        SELECT * FROM ${this.TABLE_NAME}
        WHERE translation_id IN (${placeholders})
        ORDER BY created_at DESC
      `,
        translationIds
      );

      return results || [];
    }

    // 대규모 집합은 배치 쿼리 처리
    const batches: string[][] = [];
    for (let i = 0; i < translationIds.length; i += batchSize) {
      batches.push(translationIds.slice(i, i + batchSize));
    }

    const allLogs: TranslationAuditLog[] = [];

    for (const batch of batches) {
      const placeholders = batch.map(() => '?').join(',');
      const results = this.db.all<TranslationAuditLog>(
        `
        SELECT * FROM ${this.TABLE_NAME}
        WHERE translation_id IN (${placeholders})
        ORDER BY created_at DESC
      `,
        batch
      );

      if (results) {
        allLogs.push(...results);
      }
    }

    // 전체 결과 정렬 (배치로 인해 순서가 섞일 수 있음)
    allLogs.sort((a, b) => {
      const dateA = new Date(a.created_at);
      const dateB = new Date(b.created_at);
      return dateB.getTime() - dateA.getTime();
    });

    return allLogs;
  }

  /**
   * 번역별 최신 Audit 로그 조회
   * 
   * N+1 쿼리 방지를 위해 단일 쿼리로 처리
   */
  async getLatestByTranslationIds(
    translationIds: string[]
  ): Promise<Map<string, TranslationAuditLog>> {
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

    for (const log of results || []) {
      const translationId = log.translation_id;
      if (translationId) {
        latestMap.set(translationId, log);
      }
    }

    return latestMap;
  }

  /**
   * 페이지네이션으로 Audit 로그 조회
   */
  async getWithPagination(
    params: PaginationParams = { page: 1, limit: 50 }
  ): Promise<PaginatedResult<TranslationAuditLog>> {
    const { page, limit } = params;
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
      data: results || [],
      count: totalCount,
    };
  }

  /**
   * 번역 ID별로 그룹화된 Audit 로그 조회
   */
  async getGroupedByTranslation(translationIds: string[]): Promise<GroupedAuditLogs> {
    const logs = await this.getByTranslationIds(translationIds);

    // 번역 ID별로 그룹화
    const byTranslationId = new Map<string, TranslationAuditLog[]>();
    const latestByTranslationId = new Map<string, TranslationAuditLog>();

    for (const log of logs) {
      const translationId = log.translation_id;
      if (!translationId) continue;

      // 그룹화
      if (!byTranslationId.has(translationId)) {
        byTranslationId.set(translationId, []);
      }
      byTranslationId.get(translationId)!.push(log);

      // 최신 로그 (이미 정렬되어 있음)
      if (!latestByTranslationId.has(translationId)) {
        latestByTranslationId.set(translationId, log);
      }
    }

    return {
      byTranslationId,
      latestByTranslationId,
      allLogs: logs,
    };
  }

  /**
   * 특정 번역의 Audit 로그 수 조회
   */
  async countByTranslationId(translationId: string): Promise<number> {
    const result = this.db.get<{ count: number }>(
      `
      SELECT COUNT(*) as count FROM ${this.TABLE_NAME}
      WHERE translation_id = ?
    `,
      [translationId]
    );

    return result?.count || 0;
  }
}
