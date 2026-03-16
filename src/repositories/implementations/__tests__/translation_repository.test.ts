/**
 * Translation Repository Tests
 * 
 * Supabase 및 SQLite 구현체에 대한 통합 테스트
 * 
 * 테스트 실행:
 * ```bash
 * npm test -- translation_repository.test.ts
 * ```
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { SupabaseTranslationRepository } from '../supabase/translation_repository';
import { SqliteTranslationRepository } from '../sqlite/translation_repository';
import type { ITranslationRepository } from '@/repositories/interfaces/translation_repository';
import type { Translation, TranslationStatus } from '@/types';

// SQLite 인메모리 클라이언트
import { createInMemorySqliteClient } from '@/lib/database/sqlite';
import type { SqliteDatabase } from '@/lib/database/sqlite';

// Supabase 클라이언트 모킹 (실제 테스트에서는 실제 클라이언트 사용)
const mockSupabaseClient = {
  from: vi.fn(),
} as any;

describe('TranslationRepository', () => {
  describe('SQLite Implementation', () => {
    let db: SqliteDatabase;
    let repository: SqliteTranslationRepository;

    beforeAll(() => {
      db = createInMemorySqliteClient();
      
      // 테스트용 테이블 생성
      db.exec(`
        CREATE TABLE IF NOT EXISTS translations (
          id TEXT PRIMARY KEY,
          source_text TEXT NOT NULL,
          context TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          priority TEXT NOT NULL DEFAULT 'medium',
          version TEXT,
          version_updated_at TEXT,
          product_code TEXT,
          scope TEXT,
          work_scope TEXT DEFAULT '[]',
          dev_code TEXT,
          notes TEXT,
          completion_rate INTEGER DEFAULT 0,
          platform_completions TEXT DEFAULT '{}',
          completion_date TEXT,
          user_id TEXT NOT NULL,
          team_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          is_migrated INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS translation_results (
          id TEXT PRIMARY KEY,
          translation_id TEXT NOT NULL,
          language_code TEXT NOT NULL,
          translated_text TEXT NOT NULL,
          reviewer_id TEXT,
          reviewed_at TEXT,
          source_type TEXT,
          glossary_term_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS translation_products (
          id TEXT PRIMARY KEY,
          translation_id TEXT NOT NULL,
          product_code TEXT NOT NULL,
          version TEXT,
          version_updated_at TEXT,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS translation_platforms (
          id TEXT PRIMARY KEY,
          translation_id TEXT NOT NULL,
          platform_code TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `);
    });

    beforeEach(() => {
      repository = new SqliteTranslationRepository(db);
      
      // 테스트 데이터 초기화
      db.exec('DELETE FROM translation_platforms');
      db.exec('DELETE FROM translation_products');
      db.exec('DELETE FROM translation_results');
      db.exec('DELETE FROM translations');
    });

    afterAll(() => {
      db.close();
    });

    describe('create', () => {
      it('should create a new translation', async () => {
        const data = {
          source_text: 'Hello World',
          context: 'Greeting',
          status: 'pending' as TranslationStatus,
          priority: 'high' as const,
          user_id: 'user-1',
        };

        const result = await repository.create(data);

        expect(result).toBeDefined();
        expect(result.source_text).toBe(data.source_text);
        expect(result.status).toBe(data.status);
        expect(result.id).toBeDefined();
      });
    });

    describe('findById', () => {
      it('should find translation by id with relations', async () => {
        const data = {
          source_text: 'Test',
          status: 'pending' as TranslationStatus,
          user_id: 'user-1',
        };

        const created = await repository.create(data);
        const found = await repository.findById(created.id);

        expect(found).toBeDefined();
        expect(found?.id).toBe(created.id);
        expect(found?.translation_results).toEqual([]);
        expect(found?.translation_products).toEqual([]);
      });

      it('should return null for non-existent id', async () => {
        const result = await repository.findById('non-existent-id');
        expect(result).toBeNull();
      });
    });

    describe('findMany', () => {
      it('should return paginated results', async () => {
        // 테스트 데이터 생성
        for (let i = 0; i < 5; i++) {
          await repository.create({
            source_text: `Text ${i}`,
            status: 'pending' as TranslationStatus,
            user_id: 'user-1',
          });
        }

        const result = await repository.findMany({}, { page: 1, limit: 3 });

        expect(result.data).toHaveLength(3);
        expect(result.count).toBe(5);
      });

      it('should filter by status', async () => {
        await repository.create({
          source_text: 'Pending',
          status: 'pending' as TranslationStatus,
          user_id: 'user-1',
        });
        await repository.create({
          source_text: 'Reviewed',
          status: 'reviewed' as TranslationStatus,
          user_id: 'user-1',
        });

        const result = await repository.findMany({ status: 'reviewed' }, { page: 1, limit: 10 });

        expect(result.data).toHaveLength(1);
        expect(result.data[0].source_text).toBe('Reviewed');
      });

      it('should filter by search term', async () => {
        await repository.create({
          source_text: 'Hello World',
          status: 'pending' as TranslationStatus,
          user_id: 'user-1',
        });
        await repository.create({
          source_text: 'Goodbye',
          status: 'pending' as TranslationStatus,
          user_id: 'user-1',
        });

        const result = await repository.findMany({ search: 'hello' }, { page: 1, limit: 10 });

        expect(result.data).toHaveLength(1);
        expect(result.data[0].source_text).toBe('Hello World');
      });
    });

    describe('update', () => {
      it('should update translation', async () => {
        const created = await repository.create({
          source_text: 'Original',
          status: 'pending' as TranslationStatus,
          user_id: 'user-1',
        });

        const updated = await repository.update(created.id, {
          source_text: 'Updated',
        });

        expect(updated.source_text).toBe('Updated');
        expect(updated.id).toBe(created.id);
      });
    });

    describe('delete', () => {
      it('should delete translation', async () => {
        const created = await repository.create({
          source_text: 'To Delete',
          status: 'pending' as TranslationStatus,
          user_id: 'user-1',
        });

        await repository.delete(created.id);
        const found = await repository.findById(created.id);

        expect(found).toBeNull();
      });
    });

    describe('bulkUpdateStatus', () => {
      it('should update status for multiple translations', async () => {
        const t1 = await repository.create({
          source_text: 'Text 1',
          status: 'pending' as TranslationStatus,
          user_id: 'user-1',
        });
        const t2 = await repository.create({
          source_text: 'Text 2',
          status: 'pending' as TranslationStatus,
          user_id: 'user-1',
        });

        await repository.bulkUpdateStatus([t1.id, t2.id], 'reviewed');

        const found1 = await repository.findById(t1.id);
        const found2 = await repository.findById(t2.id);

        expect(found1?.status).toBe('reviewed');
        expect(found2?.status).toBe('reviewed');
      });
    });

    describe('getIdsByFilter', () => {
      it('should return ids matching filter', async () => {
        const t1 = await repository.create({
          source_text: 'Text 1',
          status: 'pending' as TranslationStatus,
          user_id: 'user-1',
        });
        await repository.create({
          source_text: 'Text 2',
          status: 'reviewed' as TranslationStatus,
          user_id: 'user-1',
        });

        const ids = await repository.getIdsByFilter({ status: 'pending' });

        expect(ids).toHaveLength(1);
        expect(ids[0]).toBe(t1.id);
      });
    });
  });

  describe('Supabase Implementation', () => {
    let repository: SupabaseTranslationRepository;

    beforeEach(() => {
      repository = new SupabaseTranslationRepository(mockSupabaseClient);
      vi.clearAllMocks();
    });

    it('should be defined', () => {
      expect(repository).toBeDefined();
    });

    // 실제 Supabase 테스트는 별도의 통합 테스트 환경에서 수행
  });
});
