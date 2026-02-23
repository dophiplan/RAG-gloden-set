import { describe, it, expect } from 'vitest';
import {
  extractLatestPerTranslation,
  groupByTranslationId,
  filterByTranslationIds,
  sortByCreatedAtDesc,
  createBatches,
  validateAuditLog,
} from '@/lib/database/audit_log_batch_processor';
import { TranslationAuditLog } from '@/types';

describe('AuditLogBatchProcessor', () => {
  describe('extractLatestPerTranslation', () => {
    it('should return empty Map for empty array', () => {
      const result = extractLatestPerTranslation([]);
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should extract first occurrence per translation (pre-sorted DESC)', () => {
      const logs = [
        { id: '2', translation_id: 'A', created_at: '2024-01-02T00:00:00Z' },
        { id: '1', translation_id: 'A', created_at: '2024-01-01T00:00:00Z' },
        { id: '3', translation_id: 'B', created_at: '2024-01-03T00:00:00Z' },
      ] as TranslationAuditLog[];

      const result = extractLatestPerTranslation(logs);

      expect(result.size).toBe(2);
      expect(result.get('A')?.id).toBe('2'); // First occurrence
      expect(result.get('B')?.id).toBe('3');
    });

    it('should skip entries with null translation_id', () => {
      const logs = [
        { id: '1', translation_id: null, created_at: '2024-01-01T00:00:00Z' },
        { id: '2', translation_id: 'A', created_at: '2024-01-02T00:00:00Z' },
      ] as TranslationAuditLog[];

      const result = extractLatestPerTranslation(logs);

      expect(result.size).toBe(1);
      expect(result.has('A')).toBe(true);
    });
  });

  describe('groupByTranslationId', () => {
    it('should group logs by translation ID', () => {
      const logs = [
        { id: '1', translation_id: 'A', created_at: '2024-01-01T00:00:00Z' },
        { id: '2', translation_id: 'A', created_at: '2024-01-02T00:00:00Z' },
        { id: '3', translation_id: 'B', created_at: '2024-01-03T00:00:00Z' },
      ] as TranslationAuditLog[];

      const result = groupByTranslationId(logs);

      expect(result.length).toBe(2);
      
      const groupA = result.find((g) => g.translationId === 'A');
      expect(groupA?.logs.length).toBe(2);
      expect(groupA?.latestLog.id).toBe('1'); // First in array
    });
  });

  describe('filterByTranslationIds', () => {
    it('should filter logs by translation IDs', () => {
      const logs = [
        { id: '1', translation_id: 'A' },
        { id: '2', translation_id: 'B' },
        { id: '3', translation_id: 'C' },
      ] as TranslationAuditLog[];

      const result = filterByTranslationIds(logs, ['A', 'C']);

      expect(result.length).toBe(2);
      expect(result.map((l) => l.id)).toEqual(['1', '3']);
    });
  });

  describe('sortByCreatedAtDesc', () => {
    it('should sort logs by created_at descending', () => {
      const logs = [
        { id: '1', created_at: '2024-01-01T00:00:00Z' },
        { id: '2', created_at: '2024-01-03T00:00:00Z' },
        { id: '3', created_at: '2024-01-02T00:00:00Z' },
      ] as TranslationAuditLog[];

      const result = sortByCreatedAtDesc(logs);

      expect(result[0].id).toBe('2'); // Jan 3
      expect(result[1].id).toBe('3'); // Jan 2
      expect(result[2].id).toBe('1'); // Jan 1
    });

    it('should not mutate original array', () => {
      const logs = [
        { id: '1', created_at: '2024-01-01T00:00:00Z' },
      ] as TranslationAuditLog[];

      const result = sortByCreatedAtDesc(logs);

      expect(result).not.toBe(logs);
    });
  });

  describe('createBatches', () => {
    it('should create batches of specified size', () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      const result = createBatches(items, 3);

      expect(result.length).toBe(4);
      expect(result[0]).toEqual([1, 2, 3]);
      expect(result[1]).toEqual([4, 5, 6]);
      expect(result[2]).toEqual([7, 8, 9]);
      expect(result[3]).toEqual([10]);
    });

    it('should return single batch if size larger than array', () => {
      const items = [1, 2, 3];

      const result = createBatches(items, 10);

      expect(result.length).toBe(1);
      expect(result[0]).toEqual([1, 2, 3]);
    });

    it('should return empty array for empty input', () => {
      const result = createBatches([], 5);
      expect(result).toEqual([]);
    });
  });

  describe('validateAuditLog', () => {
    it('should validate action is required', () => {
      const result = validateAuditLog({});

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('action is required');
    });

    it('should validate action is valid', () => {
      const result = validateAuditLog({ action: 'invalid_action' as any });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('invalid action: invalid_action');
    });

    it('should pass for valid action', () => {
      const result = validateAuditLog({ action: 'create' });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept all valid actions', () => {
      const validActions = [
        'create',
        'update',
        'delete',
        'ai_translate',
        'glossary_match',
        'bulk_create',
        'bulk_update',
        'status_change',
        'revert',
      ];

      for (const action of validActions) {
        const result = validateAuditLog({ action: action as any });
        expect(result.valid).toBe(true);
      }
    });
  });
});
