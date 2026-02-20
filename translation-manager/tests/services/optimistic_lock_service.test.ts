/**
 * Unit Tests: OptimisticLockService
 * 
 * Tests the core functionality of the OptimisticLockService.
 * Ensures both version-based and timestamp-based locking work correctly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OptimisticLockService, createOptimisticLockService } from '@/services/optimistic_lock_service';
import { OptimisticLockError } from '@/types/optimistic_lock';

// Mock Supabase client
function createMockSupabaseClient(mockData: Record<string, unknown> | null = null, error: Error | null = null) {
  const singleMock = vi.fn().mockResolvedValue({
    data: mockData,
    error: error,
  });

  const inMock = vi.fn().mockReturnValue({
    select: vi.fn().mockResolvedValue({
      data: mockData ? [mockData] : [],
      error,
    }),
  });

  const eqMock = vi.fn().mockReturnValue({
    single: singleMock,
    in: inMock,
  });

  const selectMock = vi.fn().mockReturnValue({
    eq: eqMock,
    in: inMock,
  });

  return {
    from: vi.fn().mockReturnValue({
      select: selectMock,
    }),
  };
}

describe('OptimisticLockService', () => {
  describe('Version-based locking', () => {
    it('should allow update when version matches', async () => {
      const mockClient = createMockSupabaseClient({
        id: 'test-123',
        version: 5,
        updated_at: '2026-02-13T10:00:00.000Z',
      });

      const service = new OptimisticLockService(mockClient as any);

      const result = await service.checkVersion({
        id: 'test-123',
        entityType: 'translation',
        expectedVersion: 5,
      });

      expect(result.success).toBe(true);
      expect(result.errorCode).toBeUndefined();
    });

    it('should reject update when version mismatches', async () => {
      const mockClient = createMockSupabaseClient({
        id: 'test-123',
        version: 6, // Server has version 6
        updated_at: '2026-02-13T10:00:00.000Z',
      });

      const service = new OptimisticLockService(mockClient as any);

      const result = await service.checkVersion({
        id: 'test-123',
        entityType: 'translation',
        expectedVersion: 5, // Client expects version 5
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('EDIT_CONFLICT');
      expect(result.serverVersion).toBe(6);
      expect(result.message).toContain('수정했습니다');
    });

    it('should return NOT_FOUND when entity does not exist', async () => {
      const mockClient = createMockSupabaseClient(null, new Error('Not found') as any);
      // Override single mock to return PGRST116 error
      mockClient.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'Not found' },
            }),
          }),
        }),
      });

      const service = new OptimisticLockService(mockClient as any);

      const result = await service.checkVersion({
        id: 'non-existent',
        entityType: 'translation',
        expectedVersion: 1,
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('RECORD_NOT_FOUND');
    });
  });

  describe('Timestamp-based locking', () => {
    it('should allow update when timestamps match exactly', async () => {
      const mockClient = createMockSupabaseClient({
        id: 'test-123',
        version: 1,
        updated_at: '2026-02-13T10:00:00.000Z',
      });

      const service = new OptimisticLockService(mockClient as any);

      const result = await service.checkVersion({
        id: 'test-123',
        entityType: 'translation',
        expectedTimestamp: '2026-02-13T10:00:00.000Z',
      });

      expect(result.success).toBe(true);
    });

    it('should allow update within tolerance window', async () => {
      const mockClient = createMockSupabaseClient({
        id: 'test-123',
        version: 1,
        updated_at: '2026-02-13T10:00:00.000Z',
      });

      const service = new OptimisticLockService(mockClient as any);

      // 500ms difference within 1 second tolerance
      const result = await service.checkVersion({
        id: 'test-123',
        entityType: 'translation',
        expectedTimestamp: '2026-02-13T10:00:00.500Z',
        timestampToleranceMs: 1000,
      });

      expect(result.success).toBe(true);
    });

    it('should reject update when timestamp difference exceeds tolerance', async () => {
      const mockClient = createMockSupabaseClient({
        id: 'test-123',
        version: 1,
        updated_at: '2026-02-13T10:00:00.000Z',
      });

      const service = new OptimisticLockService(mockClient as any);

      // 2 seconds difference exceeds 1 second tolerance
      const result = await service.checkVersion({
        id: 'test-123',
        entityType: 'translation',
        expectedTimestamp: '2026-02-13T10:00:02.000Z',
        timestampToleranceMs: 1000,
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('EDIT_CONFLICT');
    });

    it('should reject update when client timestamp is older', async () => {
      const mockClient = createMockSupabaseClient({
        id: 'test-123',
        version: 1,
        updated_at: '2026-02-13T10:00:00.000Z',
      });

      const service = new OptimisticLockService(mockClient as any);

      // Client has older timestamp (2 seconds behind)
      const result = await service.checkVersion({
        id: 'test-123',
        entityType: 'translation',
        expectedTimestamp: '2026-02-13T09:59:58.000Z',
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('EDIT_CONFLICT');
    });
  });

  describe('Backward compatibility', () => {
    it('should skip check when no version or timestamp provided', async () => {
      const mockClient = createMockSupabaseClient({});

      const service = new OptimisticLockService(mockClient as any);

      const result = await service.checkVersion({
        id: 'test-123',
        entityType: 'translation',
        // No expectedVersion or expectedTimestamp
      });

      expect(result.success).toBe(true);
      // Should not even query the database
      expect(mockClient.from).not.toHaveBeenCalled();
    });
  });

  describe('Bulk version checking', () => {
    it('should check multiple items in one call', async () => {
      const mockClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: 'item-1', version: 5, updated_at: '2026-02-13T10:00:00.000Z' },
                { id: 'item-2', version: 3, updated_at: '2026-02-13T09:00:00.000Z' },
              ],
              error: null,
            }),
          }),
        }),
      };

      const service = new OptimisticLockService(mockClient as any);

      const result = await service.checkVersionsBulk({
        entityType: 'translation',
        items: [
          { id: 'item-1', expectedVersion: 5 },
          { id: 'item-2', expectedVersion: 3 },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.items).toHaveLength(2);
      expect(result.conflictIds).toHaveLength(0);
    });

    it('should report conflict IDs when some items fail', async () => {
      const mockClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: 'item-1', version: 6, updated_at: '2026-02-13T10:00:00.000Z' },
                { id: 'item-2', version: 3, updated_at: '2026-02-13T09:00:00.000Z' },
              ],
              error: null,
            }),
          }),
        }),
      };

      const service = new OptimisticLockService(mockClient as any);

      const result = await service.checkVersionsBulk({
        entityType: 'translation',
        items: [
          { id: 'item-1', expectedVersion: 5 }, // Conflict: server has 6
          { id: 'item-2', expectedVersion: 3 }, // OK
        ],
      });

      expect(result.success).toBe(false);
      expect(result.conflictIds).toContain('item-1');
      expect(result.conflictIds).not.toContain('item-2');
    });
  });

  describe('Helper methods', () => {
    it('should increment version correctly', () => {
      const mockClient = createMockSupabaseClient({});
      const service = new OptimisticLockService(mockClient as any);

      expect(service.getNextVersion(5)).toBe(6);
      expect(service.getNextVersion(0)).toBe(1);
    });

    it('should create version update payload', () => {
      const mockClient = createMockSupabaseClient({});
      const service = new OptimisticLockService(mockClient as any);

      const update = service.createVersionUpdate(5);

      expect(update.version).toBe(6);
      expect(update.updated_at).toBeDefined();
      expect(new Date(update.updated_at).getTime()).not.toBeNaN();
    });

    it('should format conflict error correctly', () => {
      const mockClient = createMockSupabaseClient({});
      const service = new OptimisticLockService(mockClient as any);

      // Test with custom message
      const error1 = service.formatConflictError({
        success: false,
        errorCode: 'EDIT_CONFLICT',
        serverVersion: 10,
        serverTimestamp: '2026-02-13T10:00:00.000Z',
        message: 'Custom conflict message',
      });

      expect(error1.code).toBe('EDIT_CONFLICT');
      expect(error1.message).toBe('Custom conflict message');
      expect(error1.details.serverVersion).toBe(10);

      // Test with default message (no message provided)
      const error2 = service.formatConflictError({
        success: false,
        errorCode: 'EDIT_CONFLICT',
        serverVersion: 10,
        serverTimestamp: '2026-02-13T10:00:00.000Z',
      });

      expect(error2.code).toBe('EDIT_CONFLICT');
      expect(error2.message).toContain('새로고침');
      expect(error2.details.serverVersion).toBe(10);
    });

    it('should detect lock conflict errors', () => {
      const mockClient = createMockSupabaseClient({});
      const service = new OptimisticLockService(mockClient as any);

      expect(service.isLockConflict(new OptimisticLockError(
        'conflict', 'EDIT_CONFLICT', 'id', 'type'
      ))).toBe(true);

      expect(service.isLockConflict(new Error('EDIT_CONFLICT detected'))).toBe(true);
      expect(service.isLockConflict(new Error('version conflict'))).toBe(true);
      expect(service.isLockConflict(new Error('some other error'))).toBe(false);
    });
  });

  describe('Factory function', () => {
    it('should create service with default config', () => {
      const mockClient = createMockSupabaseClient({});
      const service = createOptimisticLockService(mockClient as any);

      expect(service).toBeInstanceOf(OptimisticLockService);
    });

    it('should create service with custom config', () => {
      const mockClient = createMockSupabaseClient({});
      const service = createOptimisticLockService(mockClient as any, {
        defaultTimestampToleranceMs: 500,
        useVersionNumbers: false,
      });

      expect(service).toBeInstanceOf(OptimisticLockService);
    });
  });

  describe('Error throwing', () => {
    it('should throw OptimisticLockError on conflict via assertVersion', async () => {
      const mockClient = createMockSupabaseClient({
        id: 'test-123',
        version: 6,
        updated_at: '2026-02-13T10:00:00.000Z',
      });

      const service = new OptimisticLockService(mockClient as any);

      await expect(service.assertVersion({
        id: 'test-123',
        entityType: 'translation',
        expectedVersion: 5,
      })).rejects.toThrow(OptimisticLockError);
    });

    it('should not throw when version matches via assertVersion', async () => {
      const mockClient = createMockSupabaseClient({
        id: 'test-123',
        version: 5,
        updated_at: '2026-02-13T10:00:00.000Z',
      });

      const service = new OptimisticLockService(mockClient as any);

      await expect(service.assertVersion({
        id: 'test-123',
        entityType: 'translation',
        expectedVersion: 5,
      })).resolves.not.toThrow();
    });
  });
});
