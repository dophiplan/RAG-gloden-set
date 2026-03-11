import { describe, it, expect, vi } from 'vitest';
import { handleSingleRollback } from '@/app/api/rollback/handlers/single';
import { handleBatchRollback } from '@/app/api/rollback/handlers/batch';
import { handleDateBasedRollback } from '@/app/api/rollback/handlers/date-based';

describe('Rollback Handlers', () => {
  const mockUser = { id: 'user-123', email: 'admin@example.com' };

  describe('handleSingleRollback', () => {
    it('should return 400 when entity_type is missing', async () => {
      const mockAdminClient = { from: vi.fn() };

      const response = await handleSingleRollback({
        entityId: 'trans-1',
        logId: 'log-1',
      }, mockUser, mockAdminClient as any);

      expect(response.status).toBe(400);
    });

    it('should return 400 when logId is missing for translation', async () => {
      const mockAdminClient = { from: vi.fn() };

      const response = await handleSingleRollback({
        entityType: 'translation',
        entityId: 'trans-1',
      }, mockUser, mockAdminClient as any);

      expect(response.status).toBe(400);
    });

    it('should return 404 when glossary log not found', async () => {
      const mockAdminClient = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
        }),
      };

      const response = await handleSingleRollback({
        entityType: 'glossary',
        entityId: 'gloss-1',
      }, mockUser, mockAdminClient as any);

      expect(response.status).toBe(404);
    });

    it('should return 400 for unsupported entity type', async () => {
      const mockAdminClient = { from: vi.fn() };

      const response = await handleSingleRollback({
        entityType: 'unknown',
        entityId: 'unk-1',
      }, mockUser, mockAdminClient as any);

      expect(response.status).toBe(400);
    });
  });

  describe('handleBatchRollback', () => {
    it('should rollback multiple entities', async () => {
      const mockAdminClient = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'log-1',
              old_value: 'Old Value',
            },
            error: null,
          }),
          update: vi.fn().mockReturnThis(),
          insert: vi.fn().mockResolvedValue({ error: null }),
        })),
      };

      const response = await handleBatchRollback({
        entityType: 'translation',
        entityIds: ['trans-1', 'trans-2'],
      }, mockUser, mockAdminClient as any);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it('should return 400 when entityIds is missing', async () => {
      const mockAdminClient = { from: vi.fn() };

      const response = await handleBatchRollback({
        entityType: 'translation',
      }, mockUser, mockAdminClient as any);

      expect(response.status).toBe(400);
    });
  });

  describe('handleDateBasedRollback', () => {
    it('should return 400 when date is missing', async () => {
      const mockAdminClient = { from: vi.fn() };

      const response = await handleDateBasedRollback({
        entityType: 'translation',
      }, mockUser, mockAdminClient as any);

      expect(response.status).toBe(400);
    });

    it('should execute date-based rollback', async () => {
      const mockAdminClient = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          gt: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              { id: 'log-1', translation_id: 'trans-1', old_value: 'Old Text 1' },
              { id: 'log-2', translation_id: 'trans-2', old_value: 'Old Text 2' },
            ],
            error: null,
          }),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: null }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        })),
      };

      const response = await handleDateBasedRollback({
        entityType: 'translation',
        date: '2026-03-01',
      }, mockUser, mockAdminClient as any);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
    });
  });
});
