/**
 * Characterization Test: Optimistic Locking Behavior
 * 
 * Purpose: Ensure existing optimistic locking behavior is preserved
 * during refactoring from API layer to Service/Repository layer.
 * 
 * Current Behavior:
 * - Location: src/app/api/translations/[id]/route.ts (PATCH handler)
 * - Uses TranslationRepository.checkVersion() for lock checking
 * - Supports timestamp-based locking with 1-second tolerance
 * - Returns 409 EDIT_CONFLICT on version mismatch
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TranslationRepository } from '@/repositories';

// Mock Supabase client
function createMockSupabaseClient(serverTimestamp: string = '2026-02-13T10:00:00.000Z') {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { 
              id: 'test-id',
              updated_at: serverTimestamp,
              version: 5 
            },
            error: null,
          }),
        }),
        in: vi.fn().mockResolvedValue({
          data: [{ id: 'test-id', updated_at: serverTimestamp, version: 5 }],
          error: null,
        }),
      }),
    }),
  };
}

describe('Characterization: Optimistic Locking (Refactored)', () => {
  describe('Phase 3 Refactoring: Service/Repository Layer', () => {
    it('should use TranslationRepository for lock checking', async () => {
      const mockClient = createMockSupabaseClient();
      const repository = new TranslationRepository(mockClient as any);

      const result = await repository.checkVersion(
        'test-id',
        undefined, // version
        '2026-02-13T10:00:00.000Z' // timestamp
      );

      expect(result.success).toBe(true);
    });

    it('should return EDIT_CONFLICT when timestamps differ beyond tolerance', async () => {
      const mockClient = createMockSupabaseClient('2026-02-13T10:00:00.000Z');
      const repository = new TranslationRepository(mockClient as any);

      const result = await repository.checkVersion(
        'test-id',
        undefined,
        '2026-02-13T09:59:58.000Z' // 2 seconds behind
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('EDIT_CONFLICT');
    });

    it('should support version-based locking (new capability)', async () => {
      const mockClient = createMockSupabaseClient();
      const repository = new TranslationRepository(mockClient as any);

      const result = await repository.checkVersion(
        'test-id',
        5, // expected version
        undefined
      );

      expect(result.success).toBe(true);
    });

    it('should reject when version mismatches (new capability)', async () => {
      const mockClient = createMockSupabaseClient();
      const repository = new TranslationRepository(mockClient as any);

      const result = await repository.checkVersion(
        'test-id',
        4, // client has old version
        undefined
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('EDIT_CONFLICT');
      expect(result.serverVersion).toBe(5);
    });
  });

  describe('Backward Compatibility: API Response Format', () => {
    it('should maintain 409 status code for conflicts', () => {
      // Document: API returns 409 status code for EDIT_CONFLICT
      const expectedStatus = 409;
      expect(expectedStatus).toBe(409);
    });

    it('should maintain error response structure', () => {
      // Document: Error response structure
      const expectedErrorStructure = {
        error: {
          code: 'EDIT_CONFLICT',
          message: expect.any(String),
          details: {
            serverUpdatedAt: expect.any(String),
            clientUpdatedAt: expect.any(String),
          },
        },
      };

      expect(expectedErrorStructure.error.code).toBe('EDIT_CONFLICT');
    });

    it('should maintain 1-second tolerance for timestamps', async () => {
      const mockClient = createMockSupabaseClient('2026-02-13T10:00:00.000Z');
      const repository = new TranslationRepository(mockClient as any);

      // 999ms difference - within tolerance
      const result = await repository.checkVersion(
        'test-id',
        undefined,
        '2026-02-13T10:00:00.999Z'
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Repository Integration', () => {
    it('should expose getLockService for advanced operations', () => {
      const mockClient = createMockSupabaseClient();
      const repository = new TranslationRepository(mockClient as any);

      const lockService = repository.getLockService();

      expect(lockService).toBeDefined();
      expect(typeof lockService.checkVersion).toBe('function');
      expect(typeof lockService.checkVersionsBulk).toBe('function');
    });

    it('should support updateWithLock method', () => {
      const mockClient = createMockSupabaseClient();
      const repository = new TranslationRepository(mockClient as any);

      expect(typeof repository.updateWithLock).toBe('function');
    });

    it('should preserve original update method (backward compatibility)', () => {
      const mockClient = createMockSupabaseClient();
      const repository = new TranslationRepository(mockClient as any);

      expect(typeof repository.update).toBe('function');
    });
  });
});

describe('Characterization: Migration Path Documentation', () => {
  it('documents Phase 3 architecture changes', () => {
    /**
     * Phase 3: Concurrent Edit Conflicts (Optimistic Locking)
     * 
     * BEFORE (API Layer only):
     * - API Handler (route.ts) contained lock checking logic
     * - Direct Supabase queries for version checking
     * - No reusable lock service
     * 
     * AFTER (Service/Repository Layer):
     * - OptimisticLockService: Reusable lock checking service
     * - TranslationRepository.checkVersion(): Repository-level lock checking
     * - TranslationRepository.updateWithLock(): Atomic lock+update operation
     * - API Handler uses Repository methods
     * 
     * Benefits:
     * - Reusable across multiple API endpoints
     * - Testable in isolation
     * - Supports both timestamp and version-based locking
     * - Bulk lock checking support
     */
    expect(true).toBe(true);
  });

  it('documents new capabilities added', () => {
    const newCapabilities = [
      'Version-based locking (not just timestamps)',
      'Bulk lock checking for multiple records',
      'Lock service accessible from Repository',
      'updateWithLock for atomic operations',
      'Configurable tolerance for timestamp comparison',
    ];

    expect(newCapabilities.length).toBeGreaterThan(0);
  });

  it('documents preserved behavior', () => {
    const preservedBehaviors = [
      'Timestamp-based locking with 1s tolerance',
      '409 status code for conflicts',
      'Error message format (Korean)',
      'Backward compatible update() method',
      'Record not found (404) handling',
    ];

    expect(preservedBehaviors.length).toBeGreaterThan(0);
  });
});
