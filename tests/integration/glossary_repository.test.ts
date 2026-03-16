/**
 * Glossary Repository Integration Tests
 * 
 * SQLite 기반 Glossary Repository의 통합 테스트
 * - Feature Flag를 이용해 SQLite만 테스트
 * - 메모리 데이터베이스 사용
 * 
 * @example
 * ```bash
 * npm run test:integration -- glossary_repository
 * ```
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { SqliteGlossaryRepository } from '@/repositories/implementations/sqlite/glossary_repository';
import { createInMemorySqliteClient } from '@/lib/database/sqlite';
import type { SqliteDatabase } from '@/lib/database/sqlite';
import type { GlossaryCreateData, GlossaryUpdateData, GlossaryExactMatch } from '@/repositories/interfaces/glossary_repository';

// 테스트 데이터베이스 및 Repository
let db: SqliteDatabase;
let repository: SqliteGlossaryRepository;

// 테스트 사용자 정보
const testUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
};

/**
 * 테스트용 데이터베이스 스키마 초기화
 */
function initTestSchema(db: SqliteDatabase): void {
  // Glossary 테이블 생성
  db.exec(`
    CREATE TABLE IF NOT EXISTS glossary (
      id TEXT PRIMARY KEY,
      term TEXT NOT NULL,
      translation TEXT NOT NULL,
      context TEXT,
      language_code TEXT NOT NULL DEFAULT 'en',
      product_code TEXT,
      user_id TEXT,
      source_type TEXT,
      imported_at TEXT,
      approval_status TEXT DEFAULT 'pending',
      approved_by TEXT,
      approved_at TEXT,
      hit_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Audit Log 테이블 생성
  db.exec(`
    CREATE TABLE IF NOT EXISTS glossary_audit_logs (
      id TEXT PRIMARY KEY,
      glossary_term_id TEXT NOT NULL,
      user_id TEXT,
      user_name TEXT,
      user_email TEXT NOT NULL,
      action TEXT NOT NULL,
      field_name TEXT,
      old_value TEXT,
      new_value TEXT,
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
}

describe('SqliteGlossaryRepository Integration Tests', () => {
  beforeAll(() => {
    // 메모리 데이터베이스 생성
    db = createInMemorySqliteClient();
    initTestSchema(db);
    repository = new SqliteGlossaryRepository(db);
  });

  afterAll(() => {
    db.close();
  });

  beforeEach(() => {
    // 각 테스트 전 데이터 정리
    db.run('DELETE FROM glossary_audit_logs');
    db.run('DELETE FROM glossary');
  });

  // ============================================================================
  // Create Tests
  // ============================================================================
  describe('create', () => {
    it('용어를 생성해야 합니다', async () => {
      const data: GlossaryCreateData = {
        term: 'User',
        translation: '사용자',
        language_code: 'ko',
        product_code: 'RC',
      };

      const result = await repository.create(data, testUser);

      expect(result).toBeDefined();
      expect(result.term).toBe('User');
      expect(result.translation).toBe('사용자');
      expect(result.language_code).toBe('ko');
      expect(result.product_code).toBe('RC');
      expect(result.approval_status).toBe('pending');
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeDefined();
      expect(result.updated_at).toBeDefined();
    });

    it('Audit 로그를 함께 생성해야 합니다', async () => {
      const data: GlossaryCreateData = {
        term: 'Admin',
        translation: '관리자',
        language_code: 'ko',
      };

      const result = await repository.create(data, testUser);

      // Audit 로그 확인
      const auditLogs = await repository.getAuditHistory(result.id);
      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0].action).toBe('CREATE');
      expect(auditLogs[0].user_id).toBe(testUser.id);
      expect(auditLogs[0].user_email).toBe(testUser.email);
    });

    it('기본 언어 코드는 en이어야 합니다', async () => {
      const data: GlossaryCreateData = {
        term: 'Test',
        translation: '테스트',
        // language_code 미지정
      };

      const result = await repository.create(data, testUser);

      expect(result.language_code).toBe('en');
    });
  });

  // ============================================================================
  // FindById Tests
  // ============================================================================
  describe('findById', () => {
    it('ID로 용어를 조회해야 합니다', async () => {
      const data: GlossaryCreateData = {
        term: 'FindMe',
        translation: '찾아줘',
        language_code: 'ko',
      };

      const created = await repository.create(data, testUser);
      const found = await repository.findById(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.term).toBe('FindMe');
    });

    it('존재하지 않는 ID는 null을 반환해야 합니다', async () => {
      const result = await repository.findById('non-existent-id');
      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // FindMany Tests
  // ============================================================================
  describe('findMany', () => {
    beforeEach(async () => {
      // 테스트 데이터 생성
      const terms = [
        { term: 'Apple', translation: '사과', language_code: 'ko', product_code: 'RC' },
        { term: 'Banana', translation: '바나나', language_code: 'ko', product_code: 'RC' },
        { term: 'Cherry', translation: '체리', language_code: 'en', product_code: 'MG' },
        { term: 'Date', translation: '대추', language_code: 'ko', product_code: 'RC', approval_status: 'approved' as const },
      ];

      for (const data of terms) {
        await repository.create(data, testUser);
      }
    });

    it('전체 목록을 조회해야 합니다', async () => {
      const result = await repository.findMany({});

      expect(result.data.length).toBe(4);
      expect(result.count).toBe(4);
    });

    it('제품 코드로 필터링해야 합니다', async () => {
      const result = await repository.findMany({ productCode: 'RC' });

      expect(result.data.length).toBe(3);
      expect(result.data.every((item) => item.product_code === 'RC')).toBe(true);
    });

    it('언어 코드로 필터링해야 합니다', async () => {
      const result = await repository.findMany({ languageCode: 'ko' });

      expect(result.data.length).toBe(3);
      expect(result.data.every((item) => item.language_code === 'ko')).toBe(true);
    });

    it('승인 상태로 필터링해야 합니다', async () => {
      const result = await repository.findMany({ approvalStatus: 'approved' });

      expect(result.data.length).toBe(1);
      expect(result.data[0].term).toBe('Date');
    });

    it('검색어로 필터링해야 합니다', async () => {
      const result = await repository.findMany({ search: '사과' });

      expect(result.data.length).toBe(1);
      expect(result.data[0].term).toBe('Apple');
    });

    it('페이지네이션이 작동해야 합니다', async () => {
      const result = await repository.findMany({ limit: 2, offset: 0 });

      expect(result.data.length).toBe(2);
      expect(result.count).toBe(4);
    });
  });

  // ============================================================================
  // Update Tests
  // ============================================================================
  describe('updateWithAudit', () => {
    it('용어를 수정해야 합니다', async () => {
      const data: GlossaryCreateData = {
        term: 'OldTerm',
        translation: '옛날용어',
        language_code: 'ko',
      };

      const created = await repository.create(data, testUser);

      const updates: GlossaryUpdateData = {
        term: 'NewTerm',
        translation: '새로운용어',
      };

      const updated = await repository.updateWithAudit(created.id, updates, testUser);

      expect(updated.term).toBe('NewTerm');
      expect(updated.translation).toBe('새로운용어');
    });

    it('수정 시 Audit 로그를 생성해야 합니다', async () => {
      const data: GlossaryCreateData = {
        term: 'AuditTest',
        translation: '감사테스트',
        language_code: 'ko',
      };

      const created = await repository.create(data, testUser);

      const updates: GlossaryUpdateData = {
        term: 'AuditTestUpdated',
      };

      await repository.updateWithAudit(created.id, updates, testUser);

      const auditLogs = await repository.getAuditHistory(created.id);
      const updateLogs = auditLogs.filter((log) => log.action === 'UPDATE');

      expect(updateLogs.length).toBeGreaterThan(0);
      expect(updateLogs[0].field_name).toBe('term');
      expect(updateLogs[0].old_value).toBe('AuditTest');
      expect(updateLogs[0].new_value).toBe('AuditTestUpdated');
    });

    it('존재하지 않는 ID는 에러를 발생시켜야 합니다', async () => {
      const updates: GlossaryUpdateData = {
        term: 'NonExistent',
      };

      await expect(
        repository.updateWithAudit('non-existent-id', updates, testUser)
      ).rejects.toThrow('용어 수정 중 오류가 발생했습니다');
    });
  });

  // ============================================================================
  // Delete Tests
  // ============================================================================
  describe('deleteWithAudit', () => {
    it('용어를 삭제해야 합니다', async () => {
      const data: GlossaryCreateData = {
        term: 'DeleteMe',
        translation: '지워줘',
        language_code: 'ko',
      };

      const created = await repository.create(data, testUser);
      await repository.deleteWithAudit(created.id, testUser);

      const found = await repository.findById(created.id);
      expect(found).toBeNull();
    });

    it('삭제 시 Audit 로그를 생성해야 합니다', async () => {
      const data: GlossaryCreateData = {
        term: 'DeleteAudit',
        translation: '삭제감사',
        language_code: 'ko',
      };

      const created = await repository.create(data, testUser);
      const createdId = created.id;

      await repository.deleteWithAudit(createdId, testUser);

      const auditLogs = await repository.getAuditHistory(createdId);
      const deleteLogs = auditLogs.filter((log) => log.action === 'DELETE');

      expect(deleteLogs.length).toBeGreaterThan(0);
      expect(deleteLogs[0].user_id).toBe(testUser.id);
    });

    it('존재하지 않는 ID는 에러를 발생시켜야 합니다', async () => {
      await expect(
        repository.deleteWithAudit('non-existent-id', testUser)
      ).rejects.toThrow('용어 삭제 중 오류가 발생했습니다');
    });
  });

  // ============================================================================
  // Approval Tests
  // ============================================================================
  describe('approveWithAudit', () => {
    it('용어를 승인해야 합니다', async () => {
      const data: GlossaryCreateData = {
        term: 'ApproveMe',
        translation: '승인해줘',
        language_code: 'ko',
        approval_status: 'pending',
      };

      const created = await repository.create(data, testUser);
      const approved = await repository.approveWithAudit(created.id, testUser);

      expect(approved.approval_status).toBe('approved');
      expect(approved.approved_by).toBe(testUser.id);
      expect(approved.approved_at).toBeDefined();
    });

    it('승인 시 Audit 로그를 생성해야 합니다', async () => {
      const data: GlossaryCreateData = {
        term: 'ApproveAudit',
        translation: '승인감사',
        language_code: 'ko',
      };

      const created = await repository.create(data, testUser);
      await repository.approveWithAudit(created.id, testUser);

      const auditLogs = await repository.getAuditHistory(created.id);
      const approveLogs = auditLogs.filter((log) => log.action === 'APPROVE');

      expect(approveLogs.length).toBeGreaterThan(0);
      expect(approveLogs[0].field_name).toBe('approval_status');
    });
  });

  describe('rejectWithAudit', () => {
    it('용어를 거부해야 합니다', async () => {
      const data: GlossaryCreateData = {
        term: 'RejectMe',
        translation: '거부해줘',
        language_code: 'ko',
        approval_status: 'pending',
      };

      const created = await repository.create(data, testUser);
      const rejected = await repository.rejectWithAudit(created.id, testUser);

      expect(rejected.approval_status).toBe('rejected');
      expect(rejected.approved_by).toBe(testUser.id);
      expect(rejected.approved_at).toBeDefined();
    });

    it('거부 시 Audit 로그를 생성해야 합니다', async () => {
      const data: GlossaryCreateData = {
        term: 'RejectAudit',
        translation: '거부감사',
        language_code: 'ko',
      };

      const created = await repository.create(data, testUser);
      await repository.rejectWithAudit(created.id, testUser);

      const auditLogs = await repository.getAuditHistory(created.id);
      const rejectLogs = auditLogs.filter((log) => log.action === 'REJECT');

      expect(rejectLogs.length).toBeGreaterThan(0);
    });
  });

  describe('bulkApproveWithAudit', () => {
    it('여러 용어를 일괄 승인해야 합니다', async () => {
      const terms = [
        { term: 'Bulk1', translation: '일괄1', language_code: 'ko' },
        { term: 'Bulk2', translation: '일괄2', language_code: 'ko' },
        { term: 'Bulk3', translation: '일괄3', language_code: 'ko' },
      ];

      const createdIds: string[] = [];
      for (const data of terms) {
        const created = await repository.create(data, testUser);
        createdIds.push(created.id);
      }

      const result = await repository.bulkApproveWithAudit(createdIds, testUser);

      expect(result.success).toBe(3);
      expect(result.failed).toBe(0);

      // 모든 항목이 승인되었는지 확인
      for (const id of createdIds) {
        const item = await repository.findById(id);
        expect(item?.approval_status).toBe('approved');
      }
    });

    it('빈 배열은 성공 0, 실패 0을 반환해야 합니다', async () => {
      const result = await repository.bulkApproveWithAudit([], testUser);
      expect(result.success).toBe(0);
      expect(result.failed).toBe(0);
    });
  });

  // ============================================================================
  // FindExactMatches Tests
  // ============================================================================
  describe('findExactMatches', () => {
    beforeEach(async () => {
      const terms = [
        { term: 'Match', translation: '일치', language_code: 'ko', approval_status: 'approved' as const },
        { term: 'Match', translation: '매치', language_code: 'en', approval_status: 'approved' as const },
        { term: 'Match', translation: '매칭', language_code: 'ja', product_code: 'RC', approval_status: 'approved' as const },
        { term: 'Other', translation: '다른', language_code: 'ko', approval_status: 'approved' as const },
      ];

      for (const data of terms) {
        await repository.create(data, testUser);
      }
    });

    it('정확히 일치하는 용어를 찾아야 합니다', async () => {
      const result = await repository.findExactMatches({
        term: 'Match',
        languageCodes: ['ko', 'en'],
      });

      expect(result.length).toBe(2);
    });

    it('제품 코드로 필터링해야 합니다', async () => {
      const result = await repository.findExactMatches({
        term: 'Match',
        languageCodes: ['ja'],
        productCode: 'RC',
      });

      expect(result.length).toBe(1);
    });

    it('승인된 항목만 기본으로 검색해야 합니다', async () => {
      const result = await repository.findExactMatches({
        term: 'Match',
        languageCodes: ['ko', 'en', 'ja'],
      });

      // pending 상태인 ja는 제외되고 approved인 ko, en만 포함
      expect(result.every((item) => item.approval_status === 'approved')).toBe(true);
    });
  });

  // ============================================================================
  // IncrementHitCount Tests
  // ============================================================================
  describe('incrementHitCount', () => {
    it('조회수를 증가시켜야 합니다', async () => {
      const data: GlossaryCreateData = {
        term: 'HitCount',
        translation: '조회수',
        language_code: 'ko',
      };

      const created = await repository.create(data, testUser);
      expect((created as GlossaryExactMatch).hit_count).toBe(0);

      await repository.incrementHitCount('HitCount', 'ko');
      await repository.incrementHitCount('HitCount', 'ko');
      await repository.incrementHitCount('HitCount', 'ko');

      const updated = await repository.findById(created.id);
      expect((updated as GlossaryExactMatch).hit_count).toBe(3);
    });
  });

  // ============================================================================
  // Audit Log Tests
  // ============================================================================
  describe('Audit Log Operations', () => {
    it('최근 변경사항을 조회해야 합니다', async () => {
      // 여러 용어 생성
      for (let i = 0; i < 5; i++) {
        await repository.create(
          {
            term: `Recent${i}`,
            translation: `최근${i}`,
            language_code: 'ko',
          },
          testUser
        );
      }

      const recentChanges = await repository.getRecentChanges(3);
      expect(recentChanges.length).toBe(3);
    });

    it('Audit 로그를 직접 생성해야 합니다', async () => {
      const data: GlossaryCreateData = {
        term: 'DirectAudit',
        translation: '직접감사',
        language_code: 'ko',
      };

      const created = await repository.create(data, testUser);

      await repository.createGlossaryAuditLog({
        glossary_term_id: created.id,
        user_id: testUser.id,
        user_email: testUser.email,
        action: 'CUSTOM_ACTION',
        field_name: 'custom_field',
        old_value: 'old',
        new_value: 'new',
        metadata: { source: 'test' },
      });

      const auditLogs = await repository.getAuditHistory(created.id);
      const customLogs = auditLogs.filter((log) => log.action === 'CUSTOM_ACTION');

      expect(customLogs.length).toBe(1);
      expect(customLogs[0].field_name).toBe('custom_field');
    });
  });
});
