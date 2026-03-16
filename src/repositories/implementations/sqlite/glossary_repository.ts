/**
 * SQLite Glossary Repository Implementation
 * 
 * 용어집(Glossary) 관리를 위한 SQLite 기반 Repository 구현체
 * - Prepared Statement를 사용한 SQL 인젝션 방지
 * - 트랜잭션 지원으로 데이터 일관성 보장
 * - non-blocking Audit 로그
 * - 에러를 RepositoryError로 변환
 * 
 * @example
 * ```typescript
 * const db = createSqliteClient();
 * const repo = new SqliteGlossaryRepository(db);
 * 
 * // 용어 생성
 * const term = await repo.create({
 *   term: 'User',
 *   translation: '사용자',
 *   language_code: 'ko'
 * }, { id: 'user-1', email: 'admin@example.com' });
 * 
 * // 목록 조회
 * const { data, count } = await repo.findMany({
 *   productCode: 'RC',
 *   languageCode: 'ko',
 *   limit: 20,
 *   offset: 0
 * });
 * ```
 */

import type {
  IGlossaryRepository,
  GlossaryTerm,
  GlossaryCreateData,
  GlossaryUpdateData,
  GlossaryExactMatch,
  GlossaryAuditLog,
  BulkApproveResult,
  ApprovalStatus,
} from '@/repositories/interfaces/glossary_repository';
import type { UserInfo } from '@/repositories/interfaces/base_repository';
import type { SqliteDatabase, SqliteTransaction } from '@/lib/database/sqlite';
import { generateUUID } from '@/lib/validation/uuid';
import { DatabaseError } from '@/lib/errors';

// ============================================================================
// Repository Error Class
// ============================================================================

/**
 * Repository 작업 중 발생하는 오류
 */
class RepositoryError extends DatabaseError {
  constructor(
    message: string,
    public readonly operation: string,
    details?: unknown
  ) {
    super(message, details);
    this.name = 'RepositoryError';
  }
}

// ============================================================================
// Debug Logger
// ============================================================================

const isDev = process.env.NODE_ENV === 'development';
const debug = isDev ? console.log.bind(console) : () => {};
const debugError = isDev ? console.error.bind(console) : () => {};

// ============================================================================
// SqliteGlossaryRepository
// ============================================================================

export class SqliteGlossaryRepository implements IGlossaryRepository {
  constructor(private db: SqliteDatabase) {}

  // ============================================================================
  // Basic CRUD Operations
  // ============================================================================

  /**
   * ID로 용어집 항목 조회
   * 
   * @param id - 항목 ID
   * @returns 용어집 항목 또는 null (찾을 수 없는 경우)
   * @throws RepositoryError - 데이터베이스 오류 발생 시
   */
  async findById(id: string): Promise<GlossaryTerm | null> {
    try {
      const term = this.db.get<GlossaryTerm>(
        'SELECT * FROM glossary WHERE id = ?',
        [id]
      );
      return term || null;
    } catch (error) {
      debugError('[SqliteGlossaryRepository.findById] Error:', error);
      throw new RepositoryError(
        '용어 조회 중 오류가 발생했습니다.',
        'findById',
        { id, originalError: error }
      );
    }
  }

  /**
   * 용어집 항목 목록 조회 (필터링 + 페이지네이션)
   * 
   * @param params - 필터 및 페이지네이션 파라미터
   * @returns 항목 목록과 총 개수
   * @throws RepositoryError - 데이터베이스 오류 발생 시
   */
  async findMany(params: {
    productCode?: string;
    languageCode?: string;
    search?: string;
    approvalStatus?: ApprovalStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ data: GlossaryTerm[]; count: number | null }> {
    try {
      const {
        productCode,
        languageCode,
        search,
        approvalStatus,
        limit = 20,
        offset = 0,
      } = params;

      const whereConditions: string[] = [];
      const queryParams: unknown[] = [];

      // 제품 코드 필터
      if (productCode) {
        whereConditions.push('product_code = ?');
        queryParams.push(productCode);
      }

      // 언어 코드 필터
      if (languageCode) {
        whereConditions.push('language_code = ?');
        queryParams.push(languageCode);
      }

      // 승인 상태 필터
      if (approvalStatus) {
        whereConditions.push('approval_status = ?');
        queryParams.push(approvalStatus);
      }

      // 검색 필터 (term 또는 translation)
      if (search) {
        whereConditions.push('(LOWER(term) LIKE ? OR LOWER(translation) LIKE ?)');
        const searchPattern = `%${search.toLowerCase()}%`;
        queryParams.push(searchPattern, searchPattern);
      }

      const whereClause =
        whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // 총 개수 조회
      const countQuery = `SELECT COUNT(*) as total FROM glossary ${whereClause}`;
      const countResult = this.db.get<{ total: number }>(countQuery, queryParams);
      const totalCount = countResult?.total || 0;

      // 데이터 조회
      const dataQuery = `
        SELECT * FROM glossary 
        ${whereClause} 
        ORDER BY 
          CASE 
            WHEN approval_status = 'pending' THEN 0
            WHEN approval_status = 'approved' THEN 1
            ELSE 2
          END,
          created_at DESC
        LIMIT ? OFFSET ?
      `;
      const dataParams = [...queryParams, limit, offset];
      const data = this.db.all<GlossaryTerm>(dataQuery, dataParams);

      debug('[SqliteGlossaryRepository.findMany] Query results:', {
        totalCount,
        dataLength: data?.length || 0,
        filters: { productCode, languageCode, search, approvalStatus },
      });

      return {
        data: data || [],
        count: totalCount,
      };
    } catch (error) {
      debugError('[SqliteGlossaryRepository.findMany] Error:', error);
      throw new RepositoryError(
        '용어 목록 조회 중 오류가 발생했습니다.',
        'findMany',
        { params, originalError: error }
      );
    }
  }

  /**
   * 용어집 항목 생성 (Audit 로그 포함)
   * 
   * 트랜잭션 내에서 실행되며, 생성 성공 후 Audit 로그가 기록됩니다.
   * Audit 로그 실패해도 메인 작업은 성공으로 처리됩니다.
   * 
   * @param data - 생성 데이터
   * @param userInfo - 작업 수행자 정보
   * @returns 생성된 항목
   * @throws RepositoryError - 데이터베이스 오류 발생 시
   */
  async create(data: GlossaryCreateData, userInfo: UserInfo): Promise<GlossaryTerm> {
    return this.db.transaction((trx) => {
      try {
        const id = generateUUID();
        const now = new Date().toISOString();

        const {
          term,
          translation,
          context,
          language_code = 'en',
          product_code,
          source_type,
          approval_status = 'pending',
        } = data;

        // 용어 생성
        trx.run(
          `
          INSERT INTO glossary (
            id, term, translation, context, language_code, product_code,
            source_type, approval_status, hit_count, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          [
            id,
            term,
            translation,
            context || null,
            language_code,
            product_code || null,
            source_type || null,
            approval_status,
            0, // hit_count 기본값
            now,
            now,
          ]
        );

        // Audit 로그 생성 (non-blocking)
        this.createAuditLogNonBlocking(trx, {
          glossary_term_id: id,
          user_id: userInfo.id,
          user_name: userInfo.name || null,
          user_email: userInfo.email,
          action: 'CREATE',
          field_name: null,
          old_value: null,
          new_value: JSON.stringify({ term, translation, language_code, product_code }),
          metadata: { source: 'sqlite_repository' },
        });

        // 생성된 항목 조회 및 반환
        const created = trx.get<GlossaryTerm>('SELECT * FROM glossary WHERE id = ?', [id]);
        if (!created) {
          throw new RepositoryError('생성된 용어를 찾을 수 없습니다.', 'create', { id });
        }

        debug('[SqliteGlossaryRepository.create] Created:', { id, term });
        return created;
      } catch (error) {
        debugError('[SqliteGlossaryRepository.create] Error:', error);
        if (error instanceof RepositoryError) {
          throw error;
        }
        throw new RepositoryError(
          '용어 생성 중 오류가 발생했습니다.',
          'create',
          { data, userInfo: userInfo.id, originalError: error }
        );
      }
    });
  }

  /**
   * 용어집 항목 업데이트 (Audit 로그 포함)
   * 
   * 트랜잭션 내에서 실행되며, 변경된 필드에 대한 Audit 로그가 자동으로 기록됩니다.
   * Audit 로그 실패해도 메인 작업은 성공으로 처리됩니다.
   * 
   * @param id - 항목 ID
   * @param updates - 업데이트 데이터
   * @param userInfo - 작업 수행자 정보
   * @param options - 추가 옵션 (fieldName, oldValue)
   * @returns 업데이트된 항목
   * @throws RepositoryError - 데이터베이스 오류 또는 항목을 찾을 수 없는 경우
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
    return this.db.transaction((trx) => {
      try {
        // 기존 항목 조회
        const existing = trx.get<GlossaryTerm>('SELECT * FROM glossary WHERE id = ?', [id]);
        if (!existing) {
          throw new RepositoryError('수정할 용어를 찾을 수 없습니다.', 'updateWithAudit', { id });
        }

        const now = new Date().toISOString();
        const updateFields: string[] = [];
        const params: unknown[] = [];

        // 업데이트 가능한 필드들
        const allowedFields: (keyof GlossaryUpdateData)[] = [
          'term',
          'translation',
          'context',
          'product_code',
          'approval_status',
        ];

        // 변경 감지를 위한 Audit 로그 데이터
        const auditLogs: Array<{
          field_name: string | null;
          old_value: string | null;
          new_value: string | null;
        }> = [];

        for (const field of allowedFields) {
          if (field in updates) {
            const newValue = updates[field];
            const oldValue = existing[field];

            // 변경사항이 있는 경우에만 Audit 로그 기록
            if (newValue !== oldValue) {
              updateFields.push(`${field} = ?`);
              params.push(newValue ?? null);

              auditLogs.push({
                field_name: field,
                old_value: oldValue !== undefined ? String(oldValue) : null,
                new_value: newValue !== undefined ? String(newValue) : null,
              });
            }
          }
        }

        // 업데이트할 필드가 없는 경우
        if (updateFields.length === 0) {
          return existing;
        }

        // updated_at 자동 업데이트
        updateFields.push('updated_at = ?');
        params.push(now);

        // 업데이트 실행
        params.push(id);
        trx.run(
          `UPDATE glossary SET ${updateFields.join(', ')} WHERE id = ?`,
          params
        );

        // Audit 로그 생성 (non-blocking)
        if (auditLogs.length > 0) {
          for (const audit of auditLogs) {
            this.createAuditLogNonBlocking(trx, {
              glossary_term_id: id,
              user_id: userInfo.id,
              user_name: userInfo.name || null,
              user_email: userInfo.email,
              action: 'UPDATE',
              field_name: audit.field_name,
              old_value: audit.old_value,
              new_value: audit.new_value,
              metadata: { source: 'sqlite_repository' },
            });
          }
        } else if (options?.fieldName) {
          // 옵션으로 제공된 필드 정보가 있으면 그것도 로깅
          this.createAuditLogNonBlocking(trx, {
            glossary_term_id: id,
            user_id: userInfo.id,
            user_name: userInfo.name || null,
            user_email: userInfo.email,
            action: 'UPDATE',
            field_name: options.fieldName,
            old_value: options.oldValue || null,
            new_value: JSON.stringify(updates),
            metadata: { source: 'sqlite_repository' },
          });
        }

        // 업데이트된 항목 반환
        const updated = trx.get<GlossaryTerm>('SELECT * FROM glossary WHERE id = ?', [id]);
        if (!updated) {
          throw new RepositoryError('업데이트된 용어를 찾을 수 없습니다.', 'updateWithAudit', { id });
        }

        debug('[SqliteGlossaryRepository.updateWithAudit] Updated:', { id });
        return updated;
      } catch (error) {
        debugError('[SqliteGlossaryRepository.updateWithAudit] Error:', error);
        if (error instanceof RepositoryError) {
          throw error;
        }
        throw new RepositoryError(
          '용어 수정 중 오류가 발생했습니다.',
          'updateWithAudit',
          { id, updates, userInfo: userInfo.id, originalError: error }
        );
      }
    });
  }

  /**
   * 용어집 항목 삭제 (Audit 로그 포함)
   * 
   * 트랜잭션 내에서 실행되며, 삭제 전 Audit 로그가 기록됩니다.
   * Audit 로그 실패해도 메인 작업은 성공으로 처리됩니다.
   * 
   * @param id - 항목 ID
   * @param userInfo - 작업 수행자 정보
   * @throws RepositoryError - 데이터베이스 오류 또는 항목을 찾을 수 없는 경우
   */
  async deleteWithAudit(id: string, userInfo: UserInfo): Promise<void> {
    return this.db.transaction((trx) => {
      try {
        // 기존 항목 조회
        const existing = trx.get<GlossaryTerm>('SELECT * FROM glossary WHERE id = ?', [id]);
        if (!existing) {
          throw new RepositoryError('삭제할 용어를 찾을 수 없습니다.', 'deleteWithAudit', { id });
        }

        // Audit 로그 생성 (non-blocking)
        this.createAuditLogNonBlocking(trx, {
          glossary_term_id: id,
          user_id: userInfo.id,
          user_name: userInfo.name || null,
          user_email: userInfo.email,
          action: 'DELETE',
          field_name: null,
          old_value: JSON.stringify(existing),
          new_value: null,
          metadata: { source: 'sqlite_repository' },
        });

        // 항목 삭제
        const result = trx.run('DELETE FROM glossary WHERE id = ?', [id]);

        if (result.changes === 0) {
          throw new RepositoryError('용어 삭제에 실패했습니다.', 'deleteWithAudit', { id });
        }

        debug('[SqliteGlossaryRepository.deleteWithAudit] Deleted:', { id });
      } catch (error) {
        debugError('[SqliteGlossaryRepository.deleteWithAudit] Error:', error);
        if (error instanceof RepositoryError) {
          throw error;
        }
        throw new RepositoryError(
          '용어 삭제 중 오류가 발생했습니다.',
          'deleteWithAudit',
          { id, userInfo: userInfo.id, originalError: error }
        );
      }
    });
  }

  // ============================================================================
  // Advanced Query Operations
  // ============================================================================

  /**
   * 정확히 일치하는 용어 검색
   * 
   * 자동 완성 및 용어 자동 매칭에 사용됩니다.
   * 
   * @param params - 검색 파라미터
   * @returns 일치하는 용어 목록 (hit_count 포함)
   * @throws RepositoryError - 데이터베이스 오류 발생 시
   */
  async findExactMatches(params: {
    term: string;
    languageCodes: string[];
    productCode?: string | null;
    approvalStatus?: ApprovalStatus;
  }): Promise<GlossaryExactMatch[]> {
    try {
      const { term, languageCodes, productCode, approvalStatus } = params;

      if (languageCodes.length === 0) {
        return [];
      }

      const whereConditions: string[] = ['term = ?'];
      const queryParams: unknown[] = [term];

      // 언어 코드 필터 (IN 절 사용)
      const languagePlaceholders = languageCodes.map(() => '?').join(',');
      whereConditions.push(`language_code IN (${languagePlaceholders})`);
      queryParams.push(...languageCodes);

      // 제품 코드 필터
      if (productCode) {
        whereConditions.push('(product_code = ? OR product_code IS NULL)');
        queryParams.push(productCode);
      }

      // 승인 상태 필터
      if (approvalStatus) {
        whereConditions.push('approval_status = ?');
        queryParams.push(approvalStatus);
      } else {
        // 기본적으로 승인된 항목만 검색
        whereConditions.push("approval_status = 'approved'");
      }

      const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

      const query = `SELECT * FROM glossary ${whereClause} ORDER BY hit_count DESC`;
      const results = this.db.all<GlossaryExactMatch>(query, queryParams);

      debug('[SqliteGlossaryRepository.findExactMatches] Found:', {
        term,
        count: results?.length || 0,
      });

      return results || [];
    } catch (error) {
      debugError('[SqliteGlossaryRepository.findExactMatches] Error:', error);
      throw new RepositoryError(
        '용어 검색 중 오류가 발생했습니다.',
        'findExactMatches',
        { params, originalError: error }
      );
    }
  }

  /**
   * 조회수 증가
   * 
   * @param term - 용어
   * @param languageCode - 언어 코드
   * @throws RepositoryError - 데이터베이스 오류 발생 시
   */
  async incrementHitCount(term: string, languageCode: string): Promise<void> {
    try {
      this.db.run(
        `
        UPDATE glossary 
        SET hit_count = hit_count + 1 
        WHERE term = ? AND language_code = ?
      `,
        [term, languageCode]
      );

      debug('[SqliteGlossaryRepository.incrementHitCount] Incremented:', {
        term,
        languageCode,
      });
    } catch (error) {
      debugError('[SqliteGlossaryRepository.incrementHitCount] Error:', error);
      // 조회수 증가는 실패해도 치명적이지 않음 (silent fail)
      // 에러 로그만 남기고 예외는 throw하지 않음
    }
  }

  // ============================================================================
  // Approval Operations
  // ============================================================================

  /**
   * 용어집 항목 승인 (Audit 로그 포함)
   * 
   * @param id - 항목 ID
   * @param userInfo - 작업 수행자 정보
   * @returns 승인된 항목
   * @throws RepositoryError - 데이터베이스 오류 또는 항목을 찾을 수 없는 경우
   */
  async approveWithAudit(id: string, userInfo: UserInfo): Promise<GlossaryTerm> {
    return this.db.transaction((trx) => {
      try {
        // 기존 항목 조회
        const existing = trx.get<GlossaryTerm>('SELECT * FROM glossary WHERE id = ?', [id]);
        if (!existing) {
          throw new RepositoryError('승인할 용어를 찾을 수 없습니다.', 'approveWithAudit', { id });
        }

        const now = new Date().toISOString();

        // 승인 상태 업데이트
        trx.run(
          `
          UPDATE glossary 
          SET approval_status = ?, approved_by = ?, approved_at = ?, updated_at = ?
          WHERE id = ?
        `,
          ['approved', userInfo.id, now, now, id]
        );

        // Audit 로그 생성
        this.createAuditLogNonBlocking(trx, {
          glossary_term_id: id,
          user_id: userInfo.id,
          user_name: userInfo.name || null,
          user_email: userInfo.email,
          action: 'APPROVE',
          field_name: 'approval_status',
          old_value: existing.approval_status ?? null,
          new_value: 'approved',
          metadata: { source: 'sqlite_repository' },
        });

        // 업데이트된 항목 반환
        const updated = trx.get<GlossaryTerm>('SELECT * FROM glossary WHERE id = ?', [id]);
        if (!updated) {
          throw new RepositoryError('승인된 용어를 찾을 수 없습니다.', 'approveWithAudit', { id });
        }

        debug('[SqliteGlossaryRepository.approveWithAudit] Approved:', { id });
        return updated;
      } catch (error) {
        debugError('[SqliteGlossaryRepository.approveWithAudit] Error:', error);
        if (error instanceof RepositoryError) {
          throw error;
        }
        throw new RepositoryError(
          '용어 승인 중 오류가 발생했습니다.',
          'approveWithAudit',
          { id, userInfo: userInfo.id, originalError: error }
        );
      }
    });
  }

  /**
   * 용어집 항목 거부 (Audit 로그 포함)
   * 
   * @param id - 항목 ID
   * @param userInfo - 작업 수행자 정보
   * @returns 거부된 항목
   * @throws RepositoryError - 데이터베이스 오류 또는 항목을 찾을 수 없는 경우
   */
  async rejectWithAudit(id: string, userInfo: UserInfo): Promise<GlossaryTerm> {
    return this.db.transaction((trx) => {
      try {
        // 기존 항목 조회
        const existing = trx.get<GlossaryTerm>('SELECT * FROM glossary WHERE id = ?', [id]);
        if (!existing) {
          throw new RepositoryError('거부할 용어를 찾을 수 없습니다.', 'rejectWithAudit', { id });
        }

        const now = new Date().toISOString();

        // 거부 상태 업데이트
        trx.run(
          `
          UPDATE glossary 
          SET approval_status = ?, approved_by = ?, approved_at = ?, updated_at = ?
          WHERE id = ?
        `,
          ['rejected', userInfo.id, now, now, id]
        );

        // Audit 로그 생성
        this.createAuditLogNonBlocking(trx, {
          glossary_term_id: id,
          user_id: userInfo.id,
          user_name: userInfo.name || null,
          user_email: userInfo.email,
          action: 'REJECT',
          field_name: 'approval_status',
          old_value: existing.approval_status ?? null,
          new_value: 'rejected',
          metadata: { source: 'sqlite_repository' },
        });

        // 업데이트된 항목 반환
        const updated = trx.get<GlossaryTerm>('SELECT * FROM glossary WHERE id = ?', [id]);
        if (!updated) {
          throw new RepositoryError('거부된 용어를 찾을 수 없습니다.', 'rejectWithAudit', { id });
        }

        debug('[SqliteGlossaryRepository.rejectWithAudit] Rejected:', { id });
        return updated;
      } catch (error) {
        debugError('[SqliteGlossaryRepository.rejectWithAudit] Error:', error);
        if (error instanceof RepositoryError) {
          throw error;
        }
        throw new RepositoryError(
          '용어 거부 중 오류가 발생했습니다.',
          'rejectWithAudit',
          { id, userInfo: userInfo.id, originalError: error }
        );
      }
    });
  }

  /**
   * 일괄 승인 (Audit 로그 포함)
   * 
   * @param ids - 승인할 항목 ID 목록
   * @param userInfo - 작업 수행자 정보
   * @returns 승인 결과 (성공/실패 개수)
   * @throws RepositoryError - 데이터베이스 오류 발생 시
   */
  async bulkApproveWithAudit(
    ids: string[],
    userInfo: UserInfo
  ): Promise<BulkApproveResult> {
    if (ids.length === 0) {
      return { success: 0, failed: 0 };
    }

    return this.db.transaction((trx) => {
      let success = 0;
      let failed = 0;
      const now = new Date().toISOString();

      for (const id of ids) {
        try {
          // 기존 항목 조회
          const existing = trx.get<GlossaryTerm>('SELECT * FROM glossary WHERE id = ?', [id]);
          if (!existing) {
            failed++;
            continue;
          }

          // 승인 상태 업데이트
          const result = trx.run(
            `
            UPDATE glossary 
            SET approval_status = ?, approved_by = ?, approved_at = ?, updated_at = ?
            WHERE id = ?
          `,
            ['approved', userInfo.id, now, now, id]
          );

          if (result.changes && result.changes > 0) {
            // Audit 로그 생성
            this.createAuditLogNonBlocking(trx, {
              glossary_term_id: id,
              user_id: userInfo.id,
              user_name: userInfo.name || null,
              user_email: userInfo.email,
              action: 'BULK_APPROVE',
              field_name: 'approval_status',
              old_value: existing.approval_status ?? null,
              new_value: 'approved',
              metadata: { source: 'sqlite_repository', batch: true },
            });
            success++;
          } else {
            failed++;
          }
        } catch (error) {
          debugError('[SqliteGlossaryRepository.bulkApproveWithAudit] Item error:', { id, error });
          failed++;
        }
      }

      debug('[SqliteGlossaryRepository.bulkApproveWithAudit] Result:', { success, failed });
      return { success, failed };
    });
  }

  // ============================================================================
  // Audit Log Operations
  // ============================================================================

  /**
   * Audit 로그 생성
   * 
   * 대량 작업이나 외부에서 직접 Audit 로그를 생성할 때 사용합니다.
   * 
   * @param data - Audit 로그 데이터
   * @throws RepositoryError - 데이터베이스 오류 발생 시
   */
  async createGlossaryAuditLog(data: {
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
    try {
      const id = generateUUID();
      const now = new Date().toISOString();

      this.db.run(
        `
        INSERT INTO glossary_audit_logs (
          id, glossary_term_id, user_id, user_name, user_email,
          action, field_name, old_value, new_value, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          id,
          data.glossary_term_id,
          data.user_id,
          data.user_name || null,
          data.user_email,
          data.action,
          data.field_name || null,
          data.old_value || null,
          data.new_value || null,
          data.metadata ? JSON.stringify(data.metadata) : null,
          now,
        ]
      );

      debug('[SqliteGlossaryRepository.createGlossaryAuditLog] Created:', {
        id,
        glossary_term_id: data.glossary_term_id,
        action: data.action,
      });
    } catch (error) {
      debugError('[SqliteGlossaryRepository.createGlossaryAuditLog] Error:', error);
      // Audit 로그 실패는 치명적이지 않음 (로그만 남기고 예외 throw)
      // 필요한 경우 호출자가 처리할 수 있도록 에러 전파
      throw new RepositoryError(
        'Audit 로그 생성 중 오류가 발생했습니다.',
        'createGlossaryAuditLog',
        { data, originalError: error }
      );
    }
  }

  /**
   * Audit 로그 생성 (IAuditableRepository 인터페이스 구현)
   * 
   * @param action - 수행된 작업
   * @param details - 작업 상세 정보
   * @param performedBy - 작업 수행자 ID
   */
  async createAuditLog(
    action: string,
    details: Record<string, unknown>,
    performedBy: string | null
  ): Promise<void> {
    try {
      const id = generateUUID();
      const now = new Date().toISOString();

      this.db.run(
        `
        INSERT INTO glossary_audit_logs (
          id, glossary_term_id, user_id, user_name, user_email,
          action, field_name, old_value, new_value, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          id,
          (details?.glossary_term_id as string) ?? null,
          (details?.user_id as string) ?? performedBy ?? null,
          (details?.user_name as string) ?? null,
          (details?.user_email as string) ?? 'system@localhost',
          action,
          (details?.field_name as string) ?? null,
          (details?.old_value as string) ?? null,
          (details?.new_value as string) ?? null,
          details?.metadata ? JSON.stringify(details.metadata) : null,
          now,
        ]
      );
    } catch (error) {
      debugError('[SqliteGlossaryRepository.createAuditLog] Error:', error);
      // Non-blocking: don't throw for audit log failures
    }
  }

  /**
   * 특정 항목의 Audit 이력 조회
   * 
   * @param entityId - 항목 ID
   * @param limit - 최대 조회 수 (기본값: 50)
   * @returns Audit 로그 목록
   * @throws RepositoryError - 데이터베이스 오류 발생 시
   */
  async getAuditHistory(entityId: string, limit: number = 50): Promise<GlossaryAuditLog[]> {
    try {
      const results = this.db.all<GlossaryAuditLog>(
        `
        SELECT * FROM glossary_audit_logs 
        WHERE glossary_term_id = ? 
        ORDER BY created_at DESC 
        LIMIT ?
      `,
        [entityId, limit]
      );

      return results || [];
    } catch (error) {
      debugError('[SqliteGlossaryRepository.getAuditHistory] Error:', error);
      throw new RepositoryError(
        'Audit 이력 조회 중 오류가 발생했습니다.',
        'getAuditHistory',
        { entityId, limit, originalError: error }
      );
    }
  }

  /**
   * 최근 변경사항 조회
   * 
   * @param limit - 최대 조회 수 (기본값: 50)
   * @returns Audit 로그 목록
   * @throws RepositoryError - 데이터베이스 오류 발생 시
   */
  async getRecentChanges(limit: number = 50): Promise<GlossaryAuditLog[]> {
    try {
      const results = this.db.all<GlossaryAuditLog>(
        `
        SELECT * FROM glossary_audit_logs 
        ORDER BY created_at DESC 
        LIMIT ?
      `,
        [limit]
      );

      return results || [];
    } catch (error) {
      debugError('[SqliteGlossaryRepository.getRecentChanges] Error:', error);
      throw new RepositoryError(
        '최근 변경사항 조회 중 오류가 발생했습니다.',
        'getRecentChanges',
        { limit, originalError: error }
      );
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * non-blocking Audit 로그 생성 (트랜잭션 내)
   * 
   * Audit 로그 생성 실패해도 메인 작업은 성공으로 처리됩니다.
   * 
   * @param trx - 트랜잭션 객체
   * @param data - Audit 로그 데이터
   */
  private createAuditLogNonBlocking(
    trx: SqliteTransaction,
    data: {
      glossary_term_id: string;
      user_id: string;
      user_name: string | null;
      user_email: string;
      action: string;
      field_name: string | null;
      old_value: string | null;
      new_value: string | null;
      metadata?: Record<string, unknown>;
    }
  ): void {
    try {
      const id = generateUUID();
      const now = new Date().toISOString();

      trx.run(
        `
        INSERT INTO glossary_audit_logs (
          id, glossary_term_id, user_id, user_name, user_email,
          action, field_name, old_value, new_value, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          id,
          data.glossary_term_id,
          data.user_id,
          data.user_name,
          data.user_email,
          data.action,
          data.field_name,
          data.old_value,
          data.new_value,
          data.metadata ? JSON.stringify(data.metadata) : null,
          now,
        ]
      );
    } catch (error) {
      // non-blocking: 에러 로그만 남기고 예외는 throw하지 않음
      debugError('[SqliteGlossaryRepository.createAuditLogNonBlocking] Failed:', {
        glossary_term_id: data.glossary_term_id,
        action: data.action,
        error,
      });
    }
  }
}

export default SqliteGlossaryRepository;
