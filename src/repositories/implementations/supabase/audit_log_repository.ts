/**
 * Supabase Audit Log Repository Implementation
 * 
 * Audit 로그 관리를 위한 Supabase 기반 Repository 구현체
 * - Non-blocking 생성 (에러를 throw하지 않음)
 * - 배치 처리 지원
 * - N+1 쿼리 방지
 * 
 * @example
 * ```typescript
 * const repo = new SupabaseAuditLogRepository(supabase);
 * await repo.create({ translation_id: 'id', action: 'update', user_email: 'user@example.com' });
 * const logs = await repo.getByTranslationId('translation-id');
 * ```
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type {
  IAuditLogRepository,
  GroupedAuditLogs,
} from '@/repositories/interfaces/audit_log_repository';
import type {
  PaginatedResult,
  PaginationParams,
} from '@/repositories/interfaces/base_repository';
import type { TranslationAuditLog, AuditLogCreateData } from '@/types';

export class SupabaseAuditLogRepository implements IAuditLogRepository {
  private readonly TABLE_NAME = 'translation_audit_logs';

  constructor(private supabase: SupabaseClient) {}

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

      const { error } = await this.supabase.from(this.TABLE_NAME).insert({
        translation_id: data.translation_id || null,
        translation_result_id: data.translation_result_id || null,
        user_id: data.user_id || null,
        user_name: data.user_name || null,
        user_email: data.user_email || null,
        action: data.action,
        field_name: data.field_name || null,
        old_value: data.old_value || null,
        new_value: data.new_value || null,
        created_at: new Date().toISOString(),
      });

      if (error) {
        console.error('[Audit Log] Failed to create audit log:', error);
      }
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
        const insertData = batch.map((item) => ({
          translation_id: item.translation_id || null,
          translation_result_id: item.translation_result_id || null,
          user_id: item.user_id || null,
          user_name: item.user_name || null,
          user_email: item.user_email || null,
          action: item.action,
          field_name: item.field_name || null,
          old_value: item.old_value || null,
          new_value: item.new_value || null,
          created_at: new Date().toISOString(),
        }));

        const { error } = await this.supabase.from(this.TABLE_NAME).insert(insertData);

        if (error) {
          console.error('[Audit Log] Failed to create batch audit logs:', error);
        }
      }
    } catch (error) {
      console.error('[Audit Log] Unexpected error creating batch audit logs:', error);
    }
  }

  /**
   * 특정 번역의 Audit 로그 조회
   */
  async getByTranslationId(translationId: string): Promise<TranslationAuditLog[]> {
    const { data, error } = await this.supabase
      .from(this.TABLE_NAME)
      .select('*')
      .eq('translation_id', translationId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get audit logs: ${error.message}`);
    }

    return (data || []) as TranslationAuditLog[];
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
      const { data, error } = await this.supabase
        .from(this.TABLE_NAME)
        .select('*')
        .in('translation_id', translationIds)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to get audit logs: ${error.message}`);
      }

      return (data || []) as TranslationAuditLog[];
    }

    // 대규모 집합은 배치 쿼리 처리
    const batches: string[][] = [];
    for (let i = 0; i < translationIds.length; i += batchSize) {
      batches.push(translationIds.slice(i, i + batchSize));
    }

    const allLogs: TranslationAuditLog[] = [];

    for (const batch of batches) {
      const { data, error } = await this.supabase
        .from(this.TABLE_NAME)
        .select('*')
        .in('translation_id', batch)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to get audit logs: ${error.message}`);
      }

      if (data) {
        allLogs.push(...(data as TranslationAuditLog[]));
      }
    }

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

    const { data, error } = await this.supabase
      .from(this.TABLE_NAME)
      .select('*')
      .in('translation_id', translationIds)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Audit Log] Failed to fetch audit logs:', error);
      return new Map();
    }

    // 번역 ID별 최신 로그 추출
    const latestMap = new Map<string, TranslationAuditLog>();

    for (const log of (data || []) as TranslationAuditLog[]) {
      const translationId = log.translation_id;
      if (translationId && !latestMap.has(translationId)) {
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

    const { data, error, count } = await this.supabase
      .from(this.TABLE_NAME)
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to get audit logs: ${error.message}`);
    }

    return {
      data: (data || []) as TranslationAuditLog[],
      count: count ?? null,
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
    const { count, error } = await this.supabase
      .from(this.TABLE_NAME)
      .select('*', { count: 'exact', head: true })
      .eq('translation_id', translationId);

    if (error) {
      throw new Error(`Failed to count audit logs: ${error.message}`);
    }

    return count || 0;
  }
}
