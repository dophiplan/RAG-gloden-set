/**
 * SQLite Translation Repository Implementation
 * 
 * 번역 데이터 관리를 위한 SQLite 기반 Repository 구현체
 * - 필터링 (product, status, language, search 등)
 * - 페이지네이션
 * - 정렬
 * - 관계 조인 (products, results)
 * - 배치 작업
 * 
 * @example
 * ```typescript
 * const db = createSqliteClient();
 * const repo = new SqliteTranslationRepository(db);
 * const result = await repo.findMany(
 *   { status: 'pending', productCode: 'RC' },
 *   { page: 1, limit: 20 }
 * );
 * ```
 */

import type {
  ITranslationRepository,
  TranslationFilters,
  TranslationCreateData,
  TranslationUpdateData,
} from '@/repositories/interfaces/translation_repository';
import type {
  PaginatedResult,
  PaginationParams,
  OptimisticLockOptions,
  LockCheckResult,
} from '@/repositories/interfaces/base_repository';
import type { 
  Translation, 
  TranslationStatus, 
  TranslationResult,
  TranslationProduct,
  TranslationPlatform,
} from '@/types';
import type { SqliteDatabase } from '@/lib/database/sqlite';
import { generateUUID } from '@/lib/validation/uuid';

// Debug logging helper
const isDev = process.env.NODE_ENV === 'development';
const debug = isDev ? console.log.bind(console) : () => {};
const debugError = isDev ? console.error.bind(console) : () => {};

export class SqliteTranslationRepository implements ITranslationRepository {
  constructor(private db: SqliteDatabase) {}

  /**
   * ID로 번역 조회 (관계 데이터 포함)
   */
  async findById(id: string): Promise<Translation | null> {
    // 번역 기본 데이터 조회
    const translation = this.db.get<Translation>(
      'SELECT * FROM translations WHERE id = ?',
      [id]
    );

    if (!translation) return null;

    // 관계 데이터 병렬 조회
    const results = await this.db.all<TranslationResult>(
      'SELECT * FROM translation_results WHERE translation_id = ?',
      [id]
    );
    const products = await this.db.all<TranslationProduct>(
      'SELECT * FROM translation_products WHERE translation_id = ?',
      [id]
    );
    const platforms = await this.db.all<TranslationPlatform>(
      'SELECT * FROM translation_platforms WHERE translation_id = ?',
      [id]
    );

    return {
      ...translation,
      translation_results: results || [],
      translation_products: products || [],
      translation_platforms: platforms || [],
    } as Translation;
  }

  /**
   * 필터와 페이지네이션으로 번역 목록 조회
   * 
   * SQLite 구현:
   * - JSON_ARRAYAGG for related data (SQLite 3.38+)
   * - json_each for array filtering
   * - LOWER() + LIKE for case-insensitive search
   * - LIMIT/OFFSET for pagination
   */
  async findMany(
    filters: TranslationFilters = {},
    pagination: Partial<PaginationParams> = {}
  ): Promise<PaginatedResult<Translation>> {
    const { page = 1, limit = 20 } = pagination;
    const offset = (page - 1) * limit;

    const whereConditions: string[] = [];
    const params: unknown[] = [];

    // 기본 WHERE 조건 구성
    if (filters.status) {
      whereConditions.push('t.status = ?');
      params.push(filters.status);
    }

    if (filters.requestId) {
      whereConditions.push('t.request_id = ?');
      params.push(filters.requestId);
    }

    if (filters.scope) {
      whereConditions.push('t.scope = ?');
      params.push(filters.scope);
    }

    if (filters.version) {
      whereConditions.push('t.version LIKE ?');
      params.push(`%${filters.version}%`);
    }

    if (filters.createdAfter) {
      whereConditions.push('t.created_at >= ?');
      params.push(filters.createdAfter);
    }

    if (filters.createdBefore) {
      whereConditions.push('t.created_at <= ?');
      params.push(filters.createdBefore);
    }

    // 언어 필터 - translation_results 테이블 조인 필요
    let joinClause = '';
    if (filters.language) {
      joinClause += `
        INNER JOIN translation_results tr ON t.id = tr.translation_id
      `;
      whereConditions.push('tr.language_code = ?');
      params.push(filters.language);
    }

    // 제품 필터 - translation_products 테이블 조인 필요
    if (filters.productCode) {
      if (!joinClause.includes('translation_results')) {
        // 중복 조인 방지를 위해 체크
      }
      joinClause += `
        INNER JOIN translation_products tp ON t.id = tp.translation_id
      `;
      whereConditions.push('tp.product_code = ?');
      params.push(filters.productCode);
    }

    // 검색 필터 - source_text 또는 translated_text
    let searchJoin = '';
    if (filters.search) {
      const searchPattern = `%${filters.search.toLowerCase()}%`;
      searchJoin = `
        LEFT JOIN translation_results tr_search ON t.id = tr_search.translation_id
      `;
      whereConditions.push(
        '(LOWER(t.source_text) LIKE ? OR LOWER(tr_search.translated_text) LIKE ?)'
      );
      params.push(searchPattern, searchPattern);
    }

    const whereClause =
      whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // DISTINCT를 사용하여 중복 제거 (여러 관계 데이터로 인한 중복)
    const distinctClause =
      filters.language || filters.productCode || filters.search ? 'DISTINCT' : '';

    // 총 개수 조회
    const countQuery = `
      SELECT COUNT(${distinctClause} t.id) as total
      FROM translations t
      ${joinClause}
      ${searchJoin}
      ${whereClause}
    `;

    const countResult = this.db.get<{ total: number }>(countQuery, params);
    const totalCount = countResult?.total || 0;

    // 데이터 조회 쿼리
    const dataQuery = `
      SELECT ${distinctClause} t.*
      FROM translations t
      ${joinClause}
      ${searchJoin}
      ${whereClause}
      ORDER BY 
        t.completion_date IS NULL ASC,
        t.completion_date ASC,
        t.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, limit, offset];
    const translations = this.db.all<Translation>(dataQuery, dataParams);

    // 관계 데이터 로딩
    const translationsWithRelations = await Promise.all(
      (translations || []).map(async (translation) => {
        const results = await this.db.all<TranslationResult>(
          'SELECT * FROM translation_results WHERE translation_id = ?',
          [translation.id]
        );
        const products = await this.db.all<TranslationProduct>(
          'SELECT * FROM translation_products WHERE translation_id = ?',
          [translation.id]
        );
        const platforms = await this.db.all<TranslationPlatform>(
          'SELECT * FROM translation_platforms WHERE translation_id = ?',
          [translation.id]
        );

        return {
          ...translation,
          translation_results: results || [],
          translation_products: products || [],
          translation_platforms: platforms || [],
        } as Translation;
      })
    );

    debug('[SqliteTranslationRepository] Query results:', {
      totalCount,
      dataLength: translationsWithRelations.length,
      hasProductFilter: !!filters.productCode,
      productCode: filters.productCode,
    });

    return {
      data: translationsWithRelations,
      count: totalCount,
    };
  }

  /**
   * 번역 생성
   */
  async create(data: TranslationCreateData): Promise<Translation> {
    const id = generateUUID();
    const now = new Date().toISOString();

    const { source_text, context, version, product_code, scope, priority, completion_date, user_id, status } = data;

    const result = this.db.run(
      `
      INSERT INTO translations (
        id, source_text, context, version, product_code, scope, priority,
        completion_date, user_id, status, created_at, updated_at,
        completion_rate, platform_completions, work_scope
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        id,
        source_text,
        context || null,
        version || null,
        product_code || null,
        scope || null,
        priority || 'medium',
        completion_date || null,
        user_id,
        status,
        now,
        now,
        0, // completion_rate
        '{}', // platform_completions (JSON)
        '[]', // work_scope (JSON array)
      ]
    );

    if (!result.lastInsertRowid) {
      throw new Error('Failed to create translation');
    }

    // 생성된 번역 반환
    const translation = await this.findById(id);
    if (!translation) {
      throw new Error('Failed to fetch created translation');
    }

    return translation;
  }

  /**
   * 번역 업데이트
   */
  async update(id: string, updates: TranslationUpdateData): Promise<Translation> {
    const now = new Date().toISOString();

    // 업데이트할 필드 동적 구성
    const updateFields: string[] = [];
    const params: unknown[] = [];

    const allowedFields = [
      'source_text',
      'context',
      'status',
      'priority',
      'version',
      'scope',
      'notes',
      'dev_code',
      'completion_date',
      'completion_rate',
    ];

    for (const field of allowedFields) {
      if (field in updates) {
        updateFields.push(`${field} = ?`);
        params.push((updates as Record<string, unknown>)[field]);
      }
    }

    // JSON 필드 처리
    if ('platform_completions' in updates) {
      updateFields.push('platform_completions = ?');
      params.push(JSON.stringify(updates.platform_completions));
    }

    if ('work_scope' in updates) {
      updateFields.push('work_scope = ?');
      params.push(JSON.stringify(updates.work_scope));
    }

    // updated_at 자동 업데이트
    updateFields.push('updated_at = ?');
    params.push(now);

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    params.push(id);

    const result = this.db.run(
      `UPDATE translations SET ${updateFields.join(', ')} WHERE id = ?`,
      params
    );

    if (result.changes === 0) {
      throw new Error(`Translation not found: ${id}`);
    }

    // 업데이트된 번역 반환
    const translation = await this.findById(id);
    if (!translation) {
      throw new Error('Failed to fetch updated translation');
    }

    return translation;
  }

  /**
   * 낙관적 잠금으로 번역 업데이트
   * 
   * SQLite에서는 버전 기반 잠금을 지원합니다.
   * (version 컬럼이 존재하는 경우)
   */
  async updateWithLock(
    id: string,
    updates: TranslationUpdateData,
    options: OptimisticLockOptions = {}
  ): Promise<Translation> {
    const { expectedTimestamp, skipLockCheck } = options;

    // 잠금 검사 (스킵되지 않은 경우)
    if (!skipLockCheck && expectedTimestamp) {
      const lockResult = await this.checkVersion(id, undefined, expectedTimestamp);

      if (!lockResult.success) {
        const err = new Error(lockResult.message || 'Edit conflict detected');
        (err as any).code = 'EDIT_CONFLICT';
        (err as any).details = lockResult.currentData;
        throw err;
      }
    }

    // 업데이트 진행
    return this.update(id, updates);
  }

  /**
   * 버전 충돌 여부 확인
   * 
   * SQLite에서는 updated_at 타임스탬프 기반으로 충돌을 감지합니다.
   */
  async checkVersion(
    id: string,
    _expectedVersion?: number,
    expectedTimestamp?: string
  ): Promise<LockCheckResult> {
    const current = this.db.get<{ updated_at: string }>(
      'SELECT updated_at FROM translations WHERE id = ?',
      [id]
    );

    if (!current) {
      return {
        success: false,
        message: 'Translation not found',
      };
    }

    if (expectedTimestamp && current.updated_at !== expectedTimestamp) {
      // 충돌 발생
      const currentData = await this.findById(id);
      return {
        success: false,
        message: `Edit conflict detected. Expected updated_at ${expectedTimestamp}, but found ${current.updated_at}`,
        currentData,
      };
    }

    return { success: true };
  }

  /**
   * 번역 삭제
   */
  async delete(id: string): Promise<void> {
    // 관계 데이터 먼저 삭제 (CASCADE가 설정되지 않은 경우 대비)
    this.db.run('DELETE FROM translation_results WHERE translation_id = ?', [id]);
    this.db.run('DELETE FROM translation_products WHERE translation_id = ?', [id]);
    this.db.run('DELETE FROM translation_platforms WHERE translation_id = ?', [id]);
    this.db.run('DELETE FROM translation_audit_logs WHERE translation_id = ?', [id]);

    // 번역 삭제
    const result = this.db.run('DELETE FROM translations WHERE id = ?', [id]);

    if (result.changes === 0) {
      throw new Error(`Translation not found: ${id}`);
    }
  }

  /**
   * 다중 상태 일괄 업데이트
   */
  async bulkUpdateStatus(ids: string[], status: TranslationStatus): Promise<void> {
    if (ids.length === 0) return;

    const now = new Date().toISOString();
    const placeholders = ids.map(() => '?').join(',');

    this.db.run(
      `
      UPDATE translations 
      SET status = ?, updated_at = ? 
      WHERE id IN (${placeholders})
    `,
      [status, now, ...ids]
    );
  }

  /**
   * 필터로 번역 ID 목록 조회
   */
  async getIdsByFilter(filters: TranslationFilters): Promise<string[]> {
    const whereConditions: string[] = [];
    const params: unknown[] = [];

    if (filters.status) {
      whereConditions.push('status = ?');
      params.push(filters.status);
    }

    if (filters.productCode) {
      // translation_products 테이블과 조인 필요
      const result = this.db.all<{ id: string }>(
        `
        SELECT DISTINCT t.id 
        FROM translations t
        INNER JOIN translation_products tp ON t.id = tp.translation_id
        WHERE tp.product_code = ?
        ${filters.status ? 'AND t.status = ?' : ''}
      `,
        filters.status
          ? [filters.productCode, filters.status]
          : [filters.productCode]
      );
      return (result || []).map((r) => r.id);
    }

    if (filters.language) {
      // translation_results 테이블과 조인 필요
      const result = this.db.all<{ id: string }>(
        `
        SELECT DISTINCT t.id 
        FROM translations t
        INNER JOIN translation_results tr ON t.id = tr.translation_id
        WHERE tr.language_code = ?
        ${filters.status ? 'AND t.status = ?' : ''}
      `,
        filters.status ? [filters.language, filters.status] : [filters.language]
      );
      return (result || []).map((r) => r.id);
    }

    if (filters.scope) {
      whereConditions.push('scope = ?');
      params.push(filters.scope);
    }

    const whereClause =
      whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const results = this.db.all<{ id: string }>(
      `SELECT id FROM translations ${whereClause}`,
      params
    );

    return (results || []).map((r) => r.id);
  }
}
