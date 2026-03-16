/**
 * Translation Audit Repository Integration Tests
 * 
 * Feature Flag 제어하에 SQLite만 테스트
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { SqliteTranslationAuditRepository } from '@/repositories/implementations/sqlite/translation_audit_repository';
import { RepositoryError } from '@/lib/errors';
import type { TranslationAuditLogCreateData, AuditAction } from '@/types';
import { createInMemorySqliteClient, type SqliteDatabase } from '@/lib/database/sqlite';

describe('SqliteTranslationAuditRepository', () => {
  let db: SqliteDatabase;
  let repository: SqliteTranslationAuditRepository;

  // 테스트 데이터
  const testTranslationId = 'test-translation-id';
  const testUserId = 'test-user-id';
  const testUserEmail = 'test@example.com';

  beforeAll(() => {
    // SQLite 클라이언트 생성 (인메모리)
    db = createInMemorySqliteClient();
  });

  afterAll(() => {
    // 데이터베이스 연결 종료
    db.close();
  });

  beforeEach(() => {
    // 테이블 생성
    db.exec(`
      DROP TABLE IF EXISTS translation_audit_logs;
      
      CREATE TABLE translation_audit_logs (
        id TEXT PRIMARY KEY,
        translation_id TEXT NOT NULL,
        user_id TEXT,
        user_name TEXT,
        user_email TEXT,
        action TEXT NOT NULL,
        field_name TEXT,
        old_value TEXT,
        new_value TEXT,
        metadata TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now'))
      );
      
      CREATE INDEX idx_audit_translation_id ON translation_audit_logs(translation_id);
      CREATE INDEX idx_audit_user_id ON translation_audit_logs(user_id);
      CREATE INDEX idx_audit_created_at ON translation_audit_logs(created_at);
    `);

    // Repository 인스턴스 생성
    repository = new SqliteTranslationAuditRepository(db);
  });

  describe('create', () => {
    it('should create an audit log successfully', async () => {
      const data: TranslationAuditLogCreateData = {
        translation_id: testTranslationId,
        action: 'create' as AuditAction,
        user_id: testUserId,
        user_email: testUserEmail,
        field_name: 'status',
        old_value: null,
        new_value: 'pending',
      };

      const result = await repository.createAndReturn(data);

      expect(result).toBeDefined();
      expect(result.translation_id).toBe(testTranslationId);
      expect(result.action).toBe('create');
      expect(result.user_id).toBe(testUserId);
      expect(result.user_email).toBe(testUserEmail);
      expect(result.field_name).toBe('status');
      expect(result.new_value).toBe('pending');
      expect(result.created_at).toBeDefined();
    });

    it('should create an audit log with metadata', async () => {
      const data: TranslationAuditLogCreateData = {
        translation_id: testTranslationId,
        action: 'update' as AuditAction,
        user_email: testUserEmail,
        metadata: {
          ip_address: '127.0.0.1',
          user_agent: 'test-agent',
        },
      };

      const result = await repository.createAndReturn(data);

      expect(result).toBeDefined();
      expect(result.translation_id).toBe(testTranslationId);
    });

    it('should throw RepositoryError when translation_id is missing', async () => {
      const data = {
        action: 'create' as AuditAction,
        user_email: testUserEmail,
      } as TranslationAuditLogCreateData;

      await expect(repository.createAndReturn(data)).rejects.toThrow(RepositoryError);
    });

    it('should throw RepositoryError when action is missing', async () => {
      const data = {
        translation_id: testTranslationId,
        user_email: testUserEmail,
      } as TranslationAuditLogCreateData;

      await expect(repository.create(data)).rejects.toThrow(RepositoryError);
    });
  });

  describe('findByTranslationId', () => {
    beforeEach(async () => {
      // 테스트 데이터 생성 (시간 차이를 두고 생성)
      const now = new Date();
      
      db.run(
        `INSERT INTO translation_audit_logs 
         (id, translation_id, action, user_email, created_at) 
         VALUES (?, ?, ?, ?, ?)`,
        ['id-1', testTranslationId, 'create', testUserEmail, new Date(now.getTime() - 2000).toISOString()]
      );
      db.run(
        `INSERT INTO translation_audit_logs 
         (id, translation_id, action, user_email, field_name, old_value, new_value, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ['id-2', testTranslationId, 'update', testUserEmail, 'status', 'pending', 'reviewed', new Date(now.getTime() - 1000).toISOString()]
      );
      db.run(
        `INSERT INTO translation_audit_logs 
         (id, translation_id, action, user_email, created_at) 
         VALUES (?, ?, ?, ?, ?)`,
        ['id-3', 'other-translation-id', 'create', 'other@example.com', now.toISOString()]
      );
    });

    it('should find audit logs by translation ID', async () => {
      const logs = await repository.findByTranslationId(testTranslationId);

      expect(logs).toHaveLength(2);
      // 최신순으로 정렬되므로 update가 먼저 와야 함
      expect(logs[0].action).toBe('update');
      expect(logs[1].action).toBe('create');
    });

    it('should respect limit parameter', async () => {
      const logs = await repository.findByTranslationId(testTranslationId, 1);

      expect(logs).toHaveLength(1);
    });

    it('should return empty array when no logs found', async () => {
      const logs = await repository.findByTranslationId('non-existent-id');

      expect(logs).toHaveLength(0);
    });

    it('should throw RepositoryError when translation_id is empty', async () => {
      await expect(repository.findByTranslationId('')).rejects.toThrow(RepositoryError);
    });
  });

  describe('findByUserId', () => {
    beforeEach(async () => {
      await repository.create({
        translation_id: testTranslationId,
        action: 'create' as AuditAction,
        user_id: testUserId,
        user_email: testUserEmail,
      });
      await repository.create({
        translation_id: testTranslationId,
        action: 'update' as AuditAction,
        user_id: testUserId,
        user_email: testUserEmail,
      });
      await repository.create({
        translation_id: testTranslationId,
        action: 'delete' as AuditAction,
        user_id: 'other-user-id',
        user_email: 'other@example.com',
      });
    });

    it('should find audit logs by user ID', async () => {
      const logs = await repository.findByUserId(testUserId);

      expect(logs).toHaveLength(2);
    });

    it('should respect limit parameter', async () => {
      const logs = await repository.findByUserId(testUserId, 1);

      expect(logs).toHaveLength(1);
    });

    it('should return empty array when no logs found', async () => {
      const logs = await repository.findByUserId('non-existent-user');

      expect(logs).toHaveLength(0);
    });

    it('should throw RepositoryError when user_id is empty', async () => {
      await expect(repository.findByUserId('')).rejects.toThrow(RepositoryError);
    });
  });

  describe('findRecent', () => {
    beforeEach(async () => {
      await repository.create({
        translation_id: 'trans-1',
        action: 'create' as AuditAction,
        user_email: 'user1@example.com',
      });
      await repository.create({
        translation_id: 'trans-2',
        action: 'update' as AuditAction,
        user_email: 'user2@example.com',
      });
      await repository.create({
        translation_id: 'trans-3',
        action: 'delete' as AuditAction,
        user_email: 'user3@example.com',
      });
    });

    it('should find recent audit logs', async () => {
      const logs = await repository.findRecent();

      expect(logs.length).toBeGreaterThanOrEqual(3);
    });

    it('should respect limit parameter', async () => {
      const logs = await repository.findRecent(2);

      expect(logs).toHaveLength(2);
    });

    it('should return logs in descending order by created_at', async () => {
      const logs = await repository.findRecent();

      for (let i = 1; i < logs.length; i++) {
        const prev = new Date(logs[i - 1].created_at).getTime();
        const curr = new Date(logs[i].created_at).getTime();
        expect(prev).toBeGreaterThanOrEqual(curr);
      }
    });
  });

  describe('findByDateRange', () => {
    beforeEach(async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // 직접 SQL로 삽입하여 특정 시간 설정
      db.run(
        `INSERT INTO translation_audit_logs 
         (id, translation_id, action, user_email, created_at) 
         VALUES (?, ?, ?, ?, ?)`,
        ['id-1', 'trans-1', 'create', 'user@example.com', now.toISOString()]
      );
      db.run(
        `INSERT INTO translation_audit_logs 
         (id, translation_id, action, user_email, created_at) 
         VALUES (?, ?, ?, ?, ?)`,
        ['id-2', 'trans-2', 'update', 'user@example.com', yesterday.toISOString()]
      );
      db.run(
        `INSERT INTO translation_audit_logs 
         (id, translation_id, action, user_email, created_at) 
         VALUES (?, ?, ?, ?, ?)`,
        ['id-3', 'trans-3', 'delete', 'user@example.com', lastWeek.toISOString()]
      );
    });

    it('should find audit logs within date range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const logs = await repository.findByDateRange(
        yesterday.toISOString(),
        now.toISOString()
      );

      expect(logs.length).toBeGreaterThanOrEqual(2);
    });

    it('should throw RepositoryError when start_date is missing', async () => {
      const now = new Date().toISOString();

      await expect(repository.findByDateRange('', now)).rejects.toThrow(RepositoryError);
    });

    it('should throw RepositoryError when end_date is missing', async () => {
      const now = new Date().toISOString();

      await expect(repository.findByDateRange(now, '')).rejects.toThrow(RepositoryError);
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      await repository.create({
        translation_id: testTranslationId,
        action: 'create' as AuditAction,
        user_id: testUserId,
        user_name: 'Test User',
        user_email: testUserEmail,
      });
      await repository.create({
        translation_id: testTranslationId,
        action: 'update' as AuditAction,
        user_id: testUserId,
        user_name: 'Test User',
        user_email: testUserEmail,
      });
      await repository.create({
        translation_id: testTranslationId,
        action: 'update' as AuditAction,
        user_id: 'other-user-id',
        user_name: 'Other User',
        user_email: 'other@example.com',
      });
      await repository.create({
        translation_id: 'other-translation-id',
        action: 'create' as AuditAction,
        user_id: testUserId,
        user_name: 'Test User',
        user_email: testUserEmail,
      });
    });

    it('should get stats for all translations', async () => {
      const stats = await repository.getStats();

      expect(stats.total).toBe(4);
      expect(stats.byAction.create).toBe(2);
      expect(stats.byAction.update).toBe(2);
      expect(stats.byUser.length).toBeGreaterThanOrEqual(1);
      expect(stats.dateRange.earliest).toBeDefined();
      expect(stats.dateRange.latest).toBeDefined();
    });

    it('should get stats for specific translation', async () => {
      const stats = await repository.getStats(testTranslationId);

      expect(stats.total).toBe(3);
      expect(stats.byAction.create).toBe(1);
      expect(stats.byAction.update).toBe(2);
    });

    it('should return zero stats when no logs exist', async () => {
      const stats = await repository.getStats('non-existent-id');

      expect(stats.total).toBe(0);
      expect(stats.byAction.create).toBe(0);
      expect(stats.byUser).toHaveLength(0);
    });
  });

  describe('getLatestByTranslationIds', () => {
    beforeEach(async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // trans-1: create (어제), update (오늘)
      db.run(
        `INSERT INTO translation_audit_logs 
         (id, translation_id, action, user_email, created_at) 
         VALUES (?, ?, ?, ?, ?)`,
        ['id-1', 'trans-1', 'create', 'user@example.com', yesterday.toISOString()]
      );
      db.run(
        `INSERT INTO translation_audit_logs 
         (id, translation_id, action, user_email, created_at) 
         VALUES (?, ?, ?, ?, ?)`,
        ['id-2', 'trans-1', 'update', 'user@example.com', now.toISOString()]
      );

      // trans-2: create (오늘)
      db.run(
        `INSERT INTO translation_audit_logs 
         (id, translation_id, action, user_email, created_at) 
         VALUES (?, ?, ?, ?, ?)`,
        ['id-3', 'trans-2', 'create', 'user@example.com', now.toISOString()]
      );
    });

    it('should get latest audit log for each translation', async () => {
      const result = await repository.getLatestByTranslationIds(['trans-1', 'trans-2']);

      expect(result.size).toBe(2);
      expect(result.get('trans-1')?.action).toBe('update');
      expect(result.get('trans-2')?.action).toBe('create');
    });

    it('should return empty map for empty input', async () => {
      const result = await repository.getLatestByTranslationIds([]);

      expect(result.size).toBe(0);
    });

    it('should handle non-existent translation IDs gracefully', async () => {
      const result = await repository.getLatestByTranslationIds(['non-existent']);

      expect(result.size).toBe(0);
    });
  });

  describe('getByTranslationId (backward compatible)', () => {
    beforeEach(async () => {
      await repository.create({
        translation_id: testTranslationId,
        action: 'create' as AuditAction,
        user_email: testUserEmail,
      });
    });

    it('should work as alias for findByTranslationId', async () => {
      const logs = await repository.getByTranslationId(testTranslationId);

      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe('create');
    });
  });

  describe('getWithPagination', () => {
    beforeEach(async () => {
      // 10개의 테스트 데이터 생성
      for (let i = 0; i < 10; i++) {
        await repository.create({
          translation_id: `trans-${i}`,
          action: 'create' as AuditAction,
          user_email: `user${i}@example.com`,
        });
      }
    });

    it('should return paginated results', async () => {
      const result = await repository.getWithPagination(1, 5);

      expect(result.data).toHaveLength(5);
      expect(result.count).toBe(10);
    });

    it('should return second page correctly', async () => {
      const result = await repository.getWithPagination(2, 3);

      expect(result.data).toHaveLength(3);
    });

    it('should throw RepositoryError for invalid page', async () => {
      await expect(repository.getWithPagination(0, 10)).rejects.toThrow(RepositoryError);
    });

    it('should throw RepositoryError for invalid limit', async () => {
      await expect(repository.getWithPagination(1, 0)).rejects.toThrow(RepositoryError);
    });
  });
});
