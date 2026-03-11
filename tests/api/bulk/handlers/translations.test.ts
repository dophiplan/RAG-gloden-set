import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { translationsCreate } from '@/app/api/bulk/handlers/translations/create';
import { translationsUpdate } from '@/app/api/bulk/handlers/translations/update';
import { translationsDelete } from '@/app/api/bulk/handlers/translations/delete';

// Helper to create a proper mock chain
type MockChain = {
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
};

const createMockChain = (overrides: Partial<MockChain> = {}): MockChain => {
  const chain: MockChain = {
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    select: vi.fn(() => chain),
    in: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    ...overrides,
  };
  return chain;
};

describe('Translations Bulk Handlers', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };

  describe('translationsCreate', () => {
    it('should return 202 on success', async () => {
      const mockChain = createMockChain({
        select: vi.fn(() => Promise.resolve({ data: [], error: null })),
      });
      const mockAdminClient = {
        from: vi.fn(() => mockChain),
      };

      const request = new NextRequest('http://localhost/api/bulk', {
        method: 'POST',
        body: JSON.stringify({
          texts: ['hello', 'world'],
          languages: ['en', 'ko'],
          product_code: 'RMS',
        }),
      });

      const response = await translationsCreate(request, mockUser, mockAdminClient as any);
      const body = await response.json();

      expect(response.status).toBe(202);
      expect(body.success).toBe(true);
      expect(body.requestedCount).toBe(4); // 2 texts × 2 languages
    });
  });

  describe('translationsUpdate', () => {
    it('should return 200 on success', async () => {
      const mockChain = createMockChain({
        in: vi.fn(() => Promise.resolve({ error: null })),
      });
      const mockAdminClient = {
        from: vi.fn(() => mockChain),
      };

      const request = new NextRequest('http://localhost/api/bulk', {
        method: 'POST',
        body: JSON.stringify({
          ids: ['trans-1', 'trans-2'],
          data: { status: 'approved' },
        }),
      });

      const response = await translationsUpdate(request, mockUser, mockAdminClient as any);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.updatedCount).toBe(2);
    });
  });

  describe('translationsDelete', () => {
    it('should perform soft delete by default', async () => {
      const mockChain = createMockChain({
        in: vi.fn(() => Promise.resolve({ error: null })),
      });
      const mockAdminClient = {
        from: vi.fn(() => mockChain),
      };

      const request = new NextRequest('http://localhost/api/bulk', {
        method: 'POST',
        body: JSON.stringify({
          ids: ['trans-1', 'trans-2'],
        }),
      });

      const response = await translationsDelete(request, mockUser, mockAdminClient as any);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.deletedCount).toBe(2);
    });

    it('should perform permanent delete when specified', async () => {
      const mockChain = createMockChain({
        in: vi.fn(() => Promise.resolve({ error: null })),
      });
      const mockAdminClient = {
        from: vi.fn(() => mockChain),
      };

      const request = new NextRequest('http://localhost/api/bulk', {
        method: 'POST',
        body: JSON.stringify({
          ids: ['trans-1'],
          permanent: true,
        }),
      });

      const response = await translationsDelete(request, mockUser, mockAdminClient as any);

      expect(response.status).toBe(200);
    });
  });
});
