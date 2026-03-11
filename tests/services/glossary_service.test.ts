import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GlossaryService } from '@/services/glossary_service';

// Mock Supabase client
const createMockSupabase = () => ({
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue({ data: [], count: 0, error: null }),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
});

describe('GlossaryService', () => {
  let service: GlossaryService;
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  const mockUserInfo = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    service = new GlossaryService(mockSupabase as any);
  });

  describe('search', () => {
    it('should search with text query', async () => {
      const mockTerms = [
        { id: 'term-1', term: 'API', translation: 'API' },
        { id: 'term-2', term: 'HTTP', translation: 'HTTP' },
      ];

      mockSupabase.order.mockResolvedValueOnce({
        data: mockTerms,
        count: 2,
        error: null,
      });

      const result = await service.search({ search: 'API' });

      expect(result.data).toHaveLength(2);
      expect(result.count).toBe(2);
      expect(mockSupabase.or).toHaveBeenCalled();
    });

    it('should apply product code filter', async () => {
      mockSupabase.order.mockResolvedValueOnce({
        data: [],
        count: 0,
        error: null,
      });

      await service.search({ productCode: 'RMS' });

      expect(mockSupabase.eq).toHaveBeenCalledWith('product_code', 'RMS');
    });

    it('should apply language code filter', async () => {
      mockSupabase.order.mockResolvedValueOnce({
        data: [],
        count: 0,
        error: null,
      });

      await service.search({ languageCode: 'ko' });

      expect(mockSupabase.eq).toHaveBeenCalledWith('language_code', 'ko');
    });

    it('should apply status filter', async () => {
      mockSupabase.order.mockResolvedValueOnce({
        data: [],
        count: 0,
        error: null,
      });

      await service.search({ status: 'approved' });

      expect(mockSupabase.eq).toHaveBeenCalledWith('approval_status', 'approved');
    });

    it('should apply pagination', async () => {
      mockSupabase.order.mockResolvedValueOnce({
        data: [],
        count: 0,
        error: null,
      });

      await service.search({ page: 2, limit: 10 });

      expect(mockSupabase.range).toHaveBeenCalledWith(10, 19);
    });

    it('should throw error on database failure', async () => {
      mockSupabase.order.mockResolvedValueOnce({
        data: null,
        count: null,
        error: { message: 'DB Error' },
      });

      await expect(service.search({})).rejects.toThrow('Failed to search glossary');
    });
  });
});
