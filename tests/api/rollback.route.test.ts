import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/rollback/route';

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({
  getAuthUser: vi.fn(),
}));

vi.mock('@/services', () => ({
  TranslationCrudService: class MockTranslationCrudService {
    revertTranslationResult = vi.fn().mockResolvedValue({ success: true });
  },
}));

import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/api-auth';

// Helper to create a proper mock chain for Supabase client
function createMockChain(finalResponse: any = { data: null, error: null }) {
  return {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(finalResponse),
  };
}

describe('/api/rollback', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };
  
  const createMockAdminClient = () => ({
    from: vi.fn(() => createMockChain({ data: null, error: null })),
  });
  
  let mockAdminClient: ReturnType<typeof createMockAdminClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminClient = createMockAdminClient();
  });

  describe('GET - List rollback operations', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getAuthUser).mockResolvedValue({
        user: null,
        error: new Error('Unauthorized'),
        adminClient: null,
      });

      const request = new NextRequest('http://localhost/api/rollback');
      const response = await GET(request);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('인증이 필요합니다.');
    });

    it('should return list of rollback operations', async () => {
      const mockOperations = [
        { id: 'op-1', entity_type: 'translation', operation_type: 'single', user_id: 'user-123' },
        { id: 'op-2', entity_type: 'glossary', operation_type: 'batch', user_id: 'user-123' },
      ];

      vi.mocked(getAuthUser).mockResolvedValue({
        user: mockUser,
        error: null,
        adminClient: mockAdminClient as any,
      });

      mockAdminClient.from = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: mockOperations, error: null }),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }));

      const request = new NextRequest('http://localhost/api/rollback?limit=10&offset=0');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.operations).toHaveLength(2);
      expect(body.limit).toBe(10);
      expect(body.offset).toBe(0);
    });

    it('should filter by entity_type', async () => {
      vi.mocked(getAuthUser).mockResolvedValue({
        user: mockUser,
        error: null,
        adminClient: mockAdminClient as any,
      });

      const eqMock = vi.fn().mockReturnThis();
      mockAdminClient.from = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: eqMock,
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: [], error: null }),
      }));

      const request = new NextRequest('http://localhost/api/rollback?entity_type=translation');
      await GET(request);

      expect(eqMock).toHaveBeenCalledWith('entity_type', 'translation');
    });
  });

  describe('POST - Execute rollback', () => {
    beforeEach(() => {
      vi.mocked(getAuthUser).mockResolvedValue({
        user: mockUser,
        error: null,
        adminClient: mockAdminClient as any,
      });
    });

    it('should return 400 when operation is missing', async () => {
      const request = new NextRequest('http://localhost/api/rollback', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('operation은 필수입니다');
    });

    describe('single rollback', () => {
      it('should return 400 when entity_type or entity_id is missing', async () => {
        const request = new NextRequest('http://localhost/api/rollback', {
          method: 'POST',
          body: JSON.stringify({ operation: 'single', entityType: 'translation' }),
        });

        const response = await POST(request);

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toContain('entity_type과 entity_id는 필수입니다');
      });

      it('should execute translation rollback with logId', async () => {
        mockAdminClient.from = vi.fn((table: string) => {
          if (table === 'translation_audit_logs') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { id: 'log-123', old_value: 'original text' },
                error: null,
              }),
            };
          }
          if (table === 'rollback_operations') {
            return {
              insert: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { id: 'op-123' },
                error: null,
              }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            update: vi.fn().mockResolvedValue({ error: null }),
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        });

        const request = new NextRequest('http://localhost/api/rollback', {
          method: 'POST',
          body: JSON.stringify({
            operation: 'single',
            entityType: 'translation',
            entityId: 'trans-123',
            logId: 'log-123',
          }),
        });

        const response = await POST(request);

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.success).toBe(true);
      });

      it('should return 400 when logId is missing for translation', async () => {
        const request = new NextRequest('http://localhost/api/rollback', {
          method: 'POST',
          body: JSON.stringify({
            operation: 'single',
            entityType: 'translation',
            entityId: 'trans-123',
          }),
        });

        const response = await POST(request);

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toContain('log_id가 필요합니다');
      });

      it('should execute glossary rollback', async () => {
        mockAdminClient.from = vi.fn((table: string) => {
          if (table === 'glossary_audit_logs') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { id: 'audit-123', glossary_id: 'gloss-123', old_value: 'original' },
                error: null,
              }),
            };
          }
          if (table === 'glossary') {
            return {
              update: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          }
          if (table === 'rollback_operations') {
            return {
              insert: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { id: 'op-123' },
                error: null,
              }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        });

        const request = new NextRequest('http://localhost/api/rollback', {
          method: 'POST',
          body: JSON.stringify({
            operation: 'single',
            entityType: 'glossary',
            entityId: 'audit-123',
          }),
        });

        const response = await POST(request);

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.success).toBe(true);
      });

      it('should return 404 when audit log not found for glossary', async () => {
        mockAdminClient.from = vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Not found' },
          }),
        }));

        const request = new NextRequest('http://localhost/api/rollback', {
          method: 'POST',
          body: JSON.stringify({
            operation: 'single',
            entityType: 'glossary',
            entityId: 'audit-123',
          }),
        });

        const response = await POST(request);

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.error).toContain('용어집 로그를 찾을 수 없습니다');
      });
    });

    describe('batch rollback', () => {
      it('should return 400 when entityIds is missing', async () => {
        const request = new NextRequest('http://localhost/api/rollback', {
          method: 'POST',
          body: JSON.stringify({
            operation: 'batch',
            entityType: 'translation',
          }),
        });

        const response = await POST(request);

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toContain('entity_ids 배열은 필수입니다');
      });

      it('should execute batch rollback for translations', async () => {
        mockAdminClient.from = vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: 'log-1', old_value: 'original' },
            error: null,
          }),
          update: vi.fn().mockResolvedValue({ error: null }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        }));

        const request = new NextRequest('http://localhost/api/rollback', {
          method: 'POST',
          body: JSON.stringify({
            operation: 'batch',
            entityType: 'translation',
            entityIds: ['trans-1', 'trans-2'],
          }),
        });

        const response = await POST(request);

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.success).toBe(true);
        expect(body.results).toBeDefined();
      });
    });

    describe('date-based rollback', () => {
      it('should return 400 when date is missing', async () => {
        const request = new NextRequest('http://localhost/api/rollback', {
          method: 'POST',
          body: JSON.stringify({
            operation: 'date-based',
            entityType: 'translation',
          }),
        });

        const response = await POST(request);

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toContain('date는 필수입니다');
      });

      it('should execute date-based rollback', async () => {
        mockAdminClient.from = vi.fn((table: string) => {
          if (table === 'translation_audit_logs') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn().mockReturnThis(),
                gt: vi.fn().mockReturnThis(),
                order: vi.fn().mockResolvedValue({
                  data: [
                    { id: 'log-1', translation_id: 'trans-1', old_value: 'original', created_at: '2026-03-11T10:00:00Z' },
                  ],
                  error: null,
                }),
              })),
            };
          }
          if (table === 'translations') {
            return {
              update: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          }
          if (table === 'rollback_operations') {
            return {
              insert: vi.fn().mockResolvedValue({ error: null }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        });

        const request = new NextRequest('http://localhost/api/rollback', {
          method: 'POST',
          body: JSON.stringify({
            operation: 'date-based',
            entityType: 'translation',
            date: '2026-03-11',
          }),
        });

        const response = await POST(request);

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.success).toBe(true);
        expect(body.results).toBeDefined();
      });
    });

    it('should return 400 for invalid operation', async () => {
      const request = new NextRequest('http://localhost/api/rollback', {
        method: 'POST',
        body: JSON.stringify({
          operation: 'invalid',
          entityType: 'translation',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('유효하지 않은 operation입니다');
    });
  });
});
