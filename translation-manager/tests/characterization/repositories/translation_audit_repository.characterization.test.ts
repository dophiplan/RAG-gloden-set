import { describe, it, expect, vi } from 'vitest';
import { TranslationAuditRepository } from '@/repositories/translation_audit_repository';

/**
 * Characterization Tests for TranslationAuditRepository
 * 
 * These tests document the CURRENT behavior of the repository.
 * After refactoring, these tests MUST pass without modification
 * to ensure zero side effects.
 * 
 * Key behaviors to preserve:
 * 1. getLatestByTranslationIds returns Map<translation_id, latest_audit_log>
 * 2. getByTranslationId returns array ordered by created_at DESC
 * 3. create is non-blocking (never throws)
 * 4. Empty input returns empty Map
 * 5. Errors return empty results (not throw)
 */
describe('TranslationAuditRepository Characterization Tests', () => {

  describe('getLatestByTranslationIds', () => {
    it('should return empty Map when input array is empty (characterization)', async () => {
      const mockSupabase = { from: vi.fn() };
      const repository = new TranslationAuditRepository(mockSupabase as any);
      
      const result = await repository.getLatestByTranslationIds([]);
      
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('should query audit logs with correct parameters (characterization)', async () => {
      const mockLogs = [
        { id: 'log-1', translation_id: 'trans-1', action: 'create', created_at: '2024-01-01T10:00:00Z' },
        { id: 'log-2', translation_id: 'trans-1', action: 'update', created_at: '2024-01-01T11:00:00Z' },
      ];

      const inMock = vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data: mockLogs, error: null })),
      }));

      const selectMock = vi.fn(() => ({
        in: inMock,
      }));

      const fromMock = vi.fn(() => ({
        select: selectMock,
      }));

      const mockSupabase = { from: fromMock };
      const repository = new TranslationAuditRepository(mockSupabase as any);
      
      await repository.getLatestByTranslationIds(['trans-1']);

      expect(fromMock).toHaveBeenCalledWith('translation_audit_logs');
      expect(selectMock).toHaveBeenCalledWith('*');
      expect(inMock).toHaveBeenCalledWith('translation_id', ['trans-1']);
    });

    it('should return Map with first occurrence per translation (characterization)', async () => {
      // Data is ordered by created_at DESC from DB
      const mockLogs = [
        { id: 'log-2', translation_id: 'trans-1', action: 'update', created_at: '2024-01-01T11:00:00Z' },
        { id: 'log-1', translation_id: 'trans-1', action: 'create', created_at: '2024-01-01T10:00:00Z' },
      ];

      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            in: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: mockLogs, error: null })),
            })),
          })),
        })),
      };

      const repository = new TranslationAuditRepository(mockSupabase as any);
      const result = await repository.getLatestByTranslationIds(['trans-1']);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(1);
      // First occurrence (log-2, the most recent) is kept
      expect(result.get('trans-1')?.id).toBe('log-2');
    });

    it('should return empty Map on database error (characterization - no throw)', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            in: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ 
                data: null, 
                error: { message: 'DB Error' } 
              })),
            })),
          })),
        })),
      };

      const repository = new TranslationAuditRepository(mockSupabase as any);
      const result = await repository.getLatestByTranslationIds(['trans-1']);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should ignore entries with null translation_id (characterization)', async () => {
      const mockLogs = [
        { id: 'log-1', translation_id: null, action: 'system' },
        { id: 'log-2', translation_id: 'trans-1', action: 'create' },
      ];

      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            in: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: mockLogs, error: null })),
            })),
          })),
        })),
      };

      const repository = new TranslationAuditRepository(mockSupabase as any);
      const result = await repository.getLatestByTranslationIds(['trans-1']);

      expect(result.size).toBe(1);
      expect(result.get('trans-1')?.id).toBe('log-2');
    });
  });

  describe('getByTranslationId', () => {
    it('should return array from database query (characterization)', async () => {
      const mockLogs = [
        { id: 'log-1', translation_id: 'trans-1', action: 'create' },
        { id: 'log-2', translation_id: 'trans-1', action: 'update' },
      ];

      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: mockLogs, error: null })),
            })),
          })),
        })),
      };

      const repository = new TranslationAuditRepository(mockSupabase as any);
      const result = await repository.getByTranslationId('trans-1');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });

    it('should return empty array when no logs exist (characterization)', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        })),
      };

      const repository = new TranslationAuditRepository(mockSupabase as any);
      const result = await repository.getByTranslationId('non-existent');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should throw error on database failure (characterization)', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => Promise.resolve({ 
                data: null, 
                error: { message: 'Connection failed' } 
              })),
            })),
          })),
        })),
      };

      const repository = new TranslationAuditRepository(mockSupabase as any);
      
      await expect(repository.getByTranslationId('trans-1')).rejects.toThrow();
    });
  });

  describe('create', () => {
    it('should NOT throw on success (characterization - non-blocking)', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          insert: vi.fn(() => Promise.resolve({ error: null })),
        })),
      };

      const repository = new TranslationAuditRepository(mockSupabase as any);

      await expect(
        repository.create({
          translation_id: 'trans-1',
          action: 'create',
          user_email: 'user@test.com',
        })
      ).resolves.not.toThrow();
    });

    it('should NOT throw on database error (characterization - non-blocking)', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          insert: vi.fn(() => Promise.resolve({ 
            error: { message: 'Insert failed' } 
          })),
        })),
      };

      const repository = new TranslationAuditRepository(mockSupabase as any);

      await expect(
        repository.create({
          action: 'create',
        })
      ).resolves.not.toThrow();
    });

    it('should NOT throw on unexpected exception (characterization)', async () => {
      const mockSupabase = {
        from: vi.fn(() => {
          throw new Error('Unexpected error');
        }),
      };

      const repository = new TranslationAuditRepository(mockSupabase as any);

      await expect(
        repository.create({ action: 'create' })
      ).resolves.not.toThrow();
    });
  });

  describe('getWithPagination', () => {
    it('should return paginated results with count (characterization)', async () => {
      const mockLogs = [{ id: 'log-1', action: 'create' }];

      const rangeMock = vi.fn(() => Promise.resolve({ 
        data: mockLogs, 
        error: null, 
        count: 100 
      }));

      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            order: vi.fn(() => ({
              range: rangeMock,
            })),
          })),
        })),
      };

      const repository = new TranslationAuditRepository(mockSupabase as any);
      const result = await repository.getWithPagination(2, 20);

      expect(result.data).toEqual(mockLogs);
      expect(result.count).toBe(100);
      expect(rangeMock).toHaveBeenCalledWith(20, 39); // (2-1)*20 to 2*20-1
    });

    it('should use default pagination values (characterization)', async () => {
      const rangeMock = vi.fn(() => Promise.resolve({ 
        data: [], 
        error: null, 
        count: 0 
      }));

      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            order: vi.fn(() => ({
              range: rangeMock,
            })),
          })),
        })),
      };

      const repository = new TranslationAuditRepository(mockSupabase as any);
      await repository.getWithPagination();

      expect(rangeMock).toHaveBeenCalledWith(0, 49); // page=1, limit=50
    });

    it('should throw on database error (characterization)', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            order: vi.fn(() => ({
              range: vi.fn(() => Promise.resolve({ 
                data: null, 
                error: { message: 'Query failed' } 
              })),
            })),
          })),
        })),
      };

      const repository = new TranslationAuditRepository(mockSupabase as any);
      
      await expect(repository.getWithPagination()).rejects.toThrow();
    });
  });
});
