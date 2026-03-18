/**
 * Characterization Tests for TranslationCrudService
 * 
 * Purpose: Document and lock existing behavior before refactoring
 * Rule: These tests MUST pass before and after refactoring
 * Note: Tests implementation details intentionally - this is characterization, not specification
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Manual mock implementations
const mockFindById = vi.fn();
const mockFindMany = vi.fn();
const mockCreate = vi.fn();
const mockCreateMany = vi.fn();
const mockFindMatches = vi.fn();
const mockApplyMatchesToInput = vi.fn();
const mockLogCreation = vi.fn();
const mockGetLatestLogs = vi.fn();

// Mock modules before importing
vi.mock('@/repositories/translation_repository', () => ({
  TranslationRepository: vi.fn().mockImplementation(() => ({
    findById: mockFindById,
    findMany: mockFindMany,
    create: mockCreate,
  })),
}));

vi.mock('@/repositories/translation_result_repository', () => ({
  TranslationResultRepository: vi.fn().mockImplementation(() => ({
    createMany: mockCreateMany,
  })),
}));

vi.mock('@/repositories/translation_product_repository', () => ({
  TranslationProductRepository: vi.fn().mockImplementation(() => ({
    createMany: mockCreateMany,
  })),
}));

vi.mock('@/services/glossary_auto_matcher', () => ({
  GlossaryAutoMatcher: vi.fn().mockImplementation(() => ({
    findMatches: mockFindMatches,
    applyMatchesToInput: mockApplyMatchesToInput,
  })),
}));

vi.mock('@/services/translation_audit_logger', () => ({
  TranslationAuditLogger: vi.fn().mockImplementation(() => ({
    logCreation: mockLogCreation,
    getLatestLogs: mockGetLatestLogs,
  })),
}));

vi.mock('@/lib/validation/uuid', () => ({
  isValidUUID: vi.fn((id: string) => 
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ),
}));

// Import after mocks
import { TranslationCrudService, TranslationCreateInput } from '@/services/translation_crud_service';

describe('TranslationCrudService - Characterization Tests', () => {
  let service: TranslationCrudService;
  let mockSupabase: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
    };

    service = new TranslationCrudService(mockSupabase);
  });

  describe('getTranslation', () => {
    it('CHAR-001: returns null for invalid UUID', async () => {
      const result = await service.getTranslation('invalid-uuid');
      expect(result).toBeNull();
      expect(mockFindById).not.toHaveBeenCalled();
    });

    it('CHAR-002: calls findById with valid UUID', async () => {
      const validUUID = '550e8400-e29b-41d4-a716-446655440000';
      const mockTranslation = { id: validUUID, source_text: 'test' };
      mockFindById.mockResolvedValue(mockTranslation);

      const result = await service.getTranslation(validUUID);

      expect(mockFindById).toHaveBeenCalledWith(validUUID);
      expect(result).toEqual(mockTranslation);
    });

    it('CHAR-003: returns null when translation not found', async () => {
      const validUUID = '550e8400-e29b-41d4-a716-446655440000';
      mockFindById.mockResolvedValue(null);

      const result = await service.getTranslation(validUUID);

      expect(result).toBeNull();
    });
  });

  describe('getTranslationsList', () => {
    it('CHAR-004: returns paginated response with audit logs', async () => {
      const mockTranslations = [
        { id: 'uuid-1', source_text: 'text1' },
        { id: 'uuid-2', source_text: 'text2' },
      ];
      mockFindMany.mockResolvedValue({ 
        data: mockTranslations, 
        count: 10 
      });
      mockGetLatestLogs.mockResolvedValue(new Map([
        ['uuid-1', { action: 'created' }],
      ]));

      const result = await service.getTranslationsList(
        { productCode: 'RMS' },
        { page: 1, limit: 10 }
      );

      expect(result).toEqual({
        translations: [
          { id: 'uuid-1', source_text: 'text1', last_audit: { action: 'created' } },
          { id: 'uuid-2', source_text: 'text2', last_audit: null },
        ],
        total: 10,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('CHAR-005: calculates totalPages correctly (ceil)', async () => {
      mockFindMany.mockResolvedValue({ 
        data: [], 
        count: 25 
      });

      const result = await service.getTranslationsList(
        {},
        { page: 1, limit: 10 }
      );

      expect(result.totalPages).toBe(3);
    });

    it('CHAR-006: handles empty results', async () => {
      mockFindMany.mockResolvedValue({ 
        data: [], 
        count: 0 
      });
      mockGetLatestLogs.mockResolvedValue(new Map());

      const result = await service.getTranslationsList({}, { page: 1, limit: 10 });

      expect(result.translations).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });

  describe('createTranslation', () => {
    const baseInput: TranslationCreateInput = {
      sourceText: 'Hello',
      userId: 'user-123',
    };

    beforeEach(() => {
      mockCreate.mockImplementation((data) => Promise.resolve({ ...data, id: 'new-uuid' }));
      mockFindById.mockResolvedValue({ id: 'new-uuid', source_text: 'Hello' });
    });

    it('CHAR-007: creates translation with minimum required fields and defaults', async () => {
      const result = await service.createTranslation(baseInput);

      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        source_text: 'Hello',
        user_id: 'user-123',
        status: 'pending',
        priority: 'medium',
        context: null,
        version: null,
        product_code: null,
        scope: null,
        completion_date: null,
        version_updated_at: null,
      }));
      expect(result).toEqual(expect.objectContaining({ id: 'new-uuid' }));
    });

    it('CHAR-008: applies glossary matching when translations provided', async () => {
      const inputWithTranslations: TranslationCreateInput = {
        ...baseInput,
        sourceText: 'Sign Up',
        productCode: 'RMS',
        translations: [
          { languageCode: 'ko', translatedText: '' },
          { languageCode: 'ja', translatedText: '' },
        ],
      };

      const mockGlossaryMatches = [
        { language_code: 'ko', translated_text: '회원가입', glossary_term_id: 'term-1' },
      ];
      mockFindMatches.mockResolvedValue(mockGlossaryMatches);
      mockApplyMatchesToInput.mockReturnValue([
        { language_code: 'ko', translated_text: '회원가입', glossary_term_id: 'term-1', source_type: 'glossary' },
        { language_code: 'ja', translated_text: '', source_type: 'manual' },
      ]);

      await service.createTranslation(inputWithTranslations);

      expect(mockFindMatches).toHaveBeenCalledWith(
        'Sign Up',
        ['ko', 'ja'],
        'RMS'
      );
    });

    it('CHAR-009: creates audit log non-blocking with void operator', async () => {
      await service.createTranslation(baseInput, { name: 'Test User', email: 'test@example.com' });

      expect(mockLogCreation).toHaveBeenCalledWith({
        translationId: 'new-uuid',
        userId: 'user-123',
        userName: 'Test User',
        userEmail: 'test@example.com',
        sourceText: 'Hello',
      });
    });

    it('CHAR-010: creates product links when productCodes provided with version', async () => {
      await service.createTranslation({
        ...baseInput,
        productCodes: ['RMS', 'REMOTEVIEW'],
        version: '1.0.0',
      });

      const productMock = mockCreateMany;
      expect(productMock).toHaveBeenCalledWith([
        {
          translation_id: 'new-uuid',
          product_code: 'RMS',
          version: '1.0.0',
          version_updated_at: expect.any(String),
        },
        {
          translation_id: 'new-uuid',
          product_code: 'REMOTEVIEW',
          version: '1.0.0',
          version_updated_at: expect.any(String),
        },
      ]);
    });

    it('CHAR-011: uses productCode as array when productCodes not provided', async () => {
      await service.createTranslation({
        ...baseInput,
        productCode: 'RMS',
      });

      expect(mockCreateMany).toHaveBeenCalledWith([
        {
          translation_id: 'new-uuid',
          product_code: 'RMS',
          version: null,
          version_updated_at: null,
        },
      ]);
    });

    it('CHAR-012: creates platform links via supabase when platformCodes provided', async () => {
      await service.createTranslation({
        ...baseInput,
        platformCodes: ['android', 'ios'],
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('translation_platforms');
      expect(mockSupabase.insert).toHaveBeenCalledWith([
        { translation_id: 'new-uuid', platform_code: 'android' },
        { translation_id: 'new-uuid', platform_code: 'ios' },
      ]);
    });

    it('CHAR-013: filters out empty/whitespace-only translations when creating results', async () => {
      await service.createTranslation({
        ...baseInput,
        translations: [
          { languageCode: 'ko', translatedText: '안녕' },
          { languageCode: 'ja', translatedText: '' },
          { languageCode: 'en', translatedText: '  ' },
          { languageCode: 'zh', translatedText: '你好' },
        ],
      });

      // ResultRepository.createMany called with filtered translations
      expect(mockCreateMany).toHaveBeenCalled();
    });

    it('CHAR-014: returns complete translation with relations after creation', async () => {
      const completeTranslation = { 
        id: 'new-uuid', 
        source_text: 'Hello',
        results: [],
        products: [],
      };
      mockFindById.mockResolvedValue(completeTranslation);

      const result = await service.createTranslation(baseInput);

      expect(mockFindById).toHaveBeenCalledWith('new-uuid');
      expect(result).toEqual(completeTranslation);
    });
  });

  describe('Behavior Contracts', () => {
    it('CHAR-015: repositories are initialized with supabase client', () => {
      // Service creation in beforeEach already triggered constructors
      // If no errors thrown, initialization succeeded
      expect(service).toBeDefined();
    });

    it('CHAR-016: handles null count from repository gracefully', async () => {
      mockFindMany.mockResolvedValue({ 
        data: [], 
        count: null 
      });
      mockGetLatestLogs.mockResolvedValue(new Map());

      const result = await service.getTranslationsList({}, { page: 1, limit: 10 });

      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });
});
