import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/bulk/route';

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({
  getAuthUser: vi.fn(),
}));

import { getAuthUser } from '@/lib/api-auth';

// Helper to create a proper mock chain for Supabase client
function createMockChain(finalResponse: any = { data: null, error: null }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(finalResponse),
    mockResolvedValue: vi.fn().mockResolvedValue(finalResponse),
  };
  return chain;
}

describe('/api/bulk', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' };
  
  // Create a base mockAdminClient factory that can be customized per test
  const createMockAdminClient = () => ({
    from: vi.fn(() => createMockChain({ data: null, error: null })),
  });
  
  let mockAdminClient: ReturnType<typeof createMockAdminClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminClient = createMockAdminClient();
    vi.mocked(getAuthUser).mockResolvedValue({
      user: mockUser,
      error: null,
      adminClient: mockAdminClient as any,
    });
  });

  describe('Authentication & Authorization', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getAuthUser).mockResolvedValue({
        user: null,
        error: new Error('Unauthorized'),
        adminClient: null,
      });

      const request = new NextRequest('http://localhost/api/bulk?type=translations&action=create', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('인증이 필요합니다.');
    });
  });

  describe('Query Parameter Validation', () => {
    it('should return 400 when type is missing', async () => {
      const request = new NextRequest('http://localhost/api/bulk?action=create', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('type과 action 쿼리 파라미터가 필요합니다');
    });

    it('should return 400 when action is missing', async () => {
      const request = new NextRequest('http://localhost/api/bulk?type=translations', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('type과 action 쿼리 파라미터가 필요합니다');
    });

    it('should return 400 for unsupported handler', async () => {
      const request = new NextRequest('http://localhost/api/bulk?type=invalid&action=invalid', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('지원하지 않는 작업입니다');
    });
  });

  describe('translations:create', () => {
    it('should return 400 when texts is missing', async () => {
      const request = new NextRequest('http://localhost/api/bulk?type=translations&action=create', {
        method: 'POST',
        body: JSON.stringify({ languages: ['en'] }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('texts 배열은 필수입니다');
    });

    it('should return 400 when languages is missing', async () => {
      const request = new NextRequest('http://localhost/api/bulk?type=translations&action=create', {
        method: 'POST',
        body: JSON.stringify({ texts: ['test'] }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('languages 배열은 필수입니다');
    });

    it('should initiate bulk creation', async () => {
      const request = new NextRequest('http://localhost/api/bulk?type=translations&action=create', {
        method: 'POST',
        body: JSON.stringify({
          texts: ['Hello', 'World'],
          languages: ['ko', 'ja'],
          product_code: 'RMS',
          context: 'UI labels',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(202);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.message).toContain('시작되었습니다');
      expect(body.requestedCount).toBe(4); // 2 texts × 2 languages
    });
  });

  describe('translations:update', () => {
    it('should return 400 when ids is missing', async () => {
      const request = new NextRequest('http://localhost/api/bulk?type=translations&action=update', {
        method: 'POST',
        body: JSON.stringify({ data: { status: 'approved' } }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('ids 배열은 필수입니다');
    });

    it('should return 400 when data is missing', async () => {
      const request = new NextRequest('http://localhost/api/bulk?type=translations&action=update', {
        method: 'POST',
        body: JSON.stringify({ ids: ['id-1', 'id-2'] }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('data 객체는 필수입니다');
    });

    it('should execute bulk update with audit logging', async () => {
      mockAdminClient.from = vi.fn((table: string) => {
        if (table === 'translations') {
          return {
            update: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        if (table === 'translation_audit_logs') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: 'log-1' }, error: null }),
          };
        }
        return createMockChain();
      });

      const request = new NextRequest('http://localhost/api/bulk?type=translations&action=update', {
        method: 'POST',
        body: JSON.stringify({
          ids: ['id-1', 'id-2'],
          data: { status: 'approved' },
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.updatedCount).toBe(2);
    });
  });

  describe('translations:delete', () => {
    it('should return 400 when ids is missing', async () => {
      const request = new NextRequest('http://localhost/api/bulk?type=translations&action=delete', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('ids 배열은 필수입니다');
    });

    it('should execute soft delete with audit logging', async () => {
      mockAdminClient.from = vi.fn((table: string) => {
        if (table === 'translations') {
          return {
            update: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        if (table === 'translation_audit_logs') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: 'log-1' }, error: null }),
          };
        }
        return createMockChain();
      });

      const request = new NextRequest('http://localhost/api/bulk?type=translations&action=delete', {
        method: 'POST',
        body: JSON.stringify({
          ids: ['id-1', 'id-2'],
          permanent: false,
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.deletedCount).toBe(2);
    });
  });

  describe('translations:status', () => {
    it('should return 400 when status is missing', async () => {
      const request = new NextRequest('http://localhost/api/bulk?type=translations&action=status', {
        method: 'POST',
        body: JSON.stringify({ ids: ['id-1'] }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('status는 필수입니다');
    });

    it('should update status with metadata', async () => {
      mockAdminClient.from = vi.fn((table: string) => {
        if (table === 'translations') {
          return {
            update: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        if (table === 'translation_audit_logs') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
        };
      });

      const request = new NextRequest('http://localhost/api/bulk?type=translations&action=status', {
        method: 'POST',
        body: JSON.stringify({
          ids: ['id-1', 'id-2'],
          status: 'approved',
          reason: '일괄 승인',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.updatedCount).toBe(2);
      expect(body.status).toBe('approved');
    });
  });

  describe('glossary:create', () => {
    it('should return 400 when items is missing', async () => {
      const request = new NextRequest('http://localhost/api/bulk?type=glossary&action=create', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('items 배열은 필수입니다');
    });

    it('should create glossary items with user metadata', async () => {
      const mockGlossaryItems = [
        { id: 'g-1', term: 'API', translation: 'API' },
        { id: 'g-2', term: 'Rollback', translation: '롤백' },
      ];

      mockAdminClient.from = vi.fn((table: string) => {
        if (table === 'glossary') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockGlossaryItems[0], error: null }),
          };
        }
        if (table === 'glossary_audit_logs') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        if (table === 'glossary_products') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
        };
      });

      const request = new NextRequest('http://localhost/api/bulk?type=glossary&action=create', {
        method: 'POST',
        body: JSON.stringify({
          items: [
            { term: 'API', translation: 'API', domain: 'tech' },
            { term: 'Rollback', translation: '롤백', domain: 'tech' },
          ],
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.success).toBe(true);
    });
  });

  describe('glossary:update', () => {
    it('should update items individually', async () => {
      mockAdminClient.from = vi.fn((table: string) => {
        if (table === 'glossary') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ 
              data: { id: 'g-1', term: 'API', translation: 'API' }, 
              error: null 
            }),
            update: vi.fn().mockReturnThis(),
          };
        }
        if (table === 'glossary_audit_logs') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
        };
      });

      const request = new NextRequest('http://localhost/api/bulk?type=glossary&action=update', {
        method: 'POST',
        body: JSON.stringify({
          items: [
            { id: 'g-1', translation: '새 번역1' },
            { id: 'g-2', translation: '새 번역2' },
          ],
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.results).toHaveLength(2);
    });

    it('should handle items without id', async () => {
      mockAdminClient.from = vi.fn((table: string) => {
        if (table === 'glossary') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ 
              data: null, 
              error: { message: 'Not found' }
            }),
            update: vi.fn().mockReturnThis(),
          };
        }
        if (table === 'glossary_audit_logs') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
        };
      });

      const request = new NextRequest('http://localhost/api/bulk?type=glossary&action=update', {
        method: 'POST',
        body: JSON.stringify({
          items: [{ translation: 'no id' }],
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.results[0].success).toBe(false);
    });
  });

  describe('admin-users:delete', () => {
    it('should prevent self-deletion', async () => {
      const request = new NextRequest('http://localhost/api/bulk?type=admin-users&action=delete', {
        method: 'POST',
        body: JSON.stringify({
          ids: ['user-123', 'user-456'], // user-123 is current user
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('Cannot delete your own account');
    });

    it('should delete users', async () => {
      mockAdminClient.from = vi.fn((table: string) => {
        if (table === 'users') {
          return {
            delete: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ error: null, count: 2 }),
          };
        }
        if (table === 'user_audit_logs') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
        };
      });

      const request = new NextRequest('http://localhost/api/bulk?type=admin-users&action=delete', {
        method: 'POST',
        body: JSON.stringify({
          ids: ['user-456', 'user-789'], // not including current user
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
    });
  });

  describe('admin-users:update', () => {
    it('should prevent self-role-change', async () => {
      const request = new NextRequest('http://localhost/api/bulk?type=admin-users&action=update', {
        method: 'POST',
        body: JSON.stringify({
          ids: ['user-123'],
          data: { role: 'admin' },
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('Cannot change your own role');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockAdminClient.from = vi.fn((table: string) => {
        if (table === 'translations') {
          return {
            update: vi.fn().mockReturnThis(),
            in: vi.fn().mockRejectedValue(new Error('DB connection failed')),
          };
        }
        if (table === 'translation_audit_logs') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
        };
      });

      const request = new NextRequest('http://localhost/api/bulk?type=translations&action=update', {
        method: 'POST',
        body: JSON.stringify({
          ids: ['id-1'],
          data: { status: 'approved' },
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBeDefined();
    });
  });
});
