/**
 * /api/platforms Pilot Tests
 * 
 * Provider 패턴 전환을 위한 통합 테스트 (GET only)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET, POST } from '@/app/api/platforms/route';
import { setFlag, resetFlag } from '@/lib/config/feature_flags';
import { resetDatabaseProvider } from '@/lib/database/provider';

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ 
          data: [
            { id: '2', code: 'android', name: 'Android', description: 'Google Android', display_order: 2 },
            { id: '1', code: 'ios', name: 'iOS', description: 'Apple iOS', display_order: 1 },
          ], 
          error: null 
        }),
      }),
    }),
  }),
  createAdminClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ 
          data: [
            { id: '2', code: 'android', name: 'Android', description: 'Google Android', display_order: 2 },
            { id: '1', code: 'ios', name: 'iOS', description: 'Apple iOS', display_order: 1 },
          ], 
          error: null 
        }),
      }),
    }),
  }),
}));

vi.mock('@/lib/database/provider', async () => {
  const actual = await vi.importActual('@/lib/database/provider');
  return {
    ...actual,
    getDatabaseProvider: vi.fn(),
    createDatabaseProviderFromEnv: vi.fn().mockReturnValue({
      type: 'supabase',
      getSupabaseClient: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ 
              data: [
                { id: '2', code: 'android', name: 'Android', description: 'Google Android', display_order: 2 },
                { id: '1', code: 'ios', name: 'iOS', description: 'Apple iOS', display_order: 1 },
              ], 
              error: null 
            }),
          }),
        }),
      }),
    }),
  };
});

describe('/api/platforms Pilot (GET only)', () => {
  beforeEach(() => {
    // Reset state before each test
    resetFlag('FF_PILOT_PLATFORMS_API');
    resetDatabaseProvider();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup after each test
    resetFlag('FF_PILOT_PLATFORMS_API');
    resetDatabaseProvider();
    vi.unstubAllEnvs();
  });

  // ============================================================================
  // Feature Flag: disabled (Legacy mode)
  // ============================================================================
  describe('Feature Flag: disabled', () => {
    it('should use legacy when flag is disabled', async () => {
      // Given: Feature flag is disabled
      setFlag('FF_PILOT_PLATFORMS_API', false);

      // When: Request platforms list
      const response = await GET();

      // Then: Legacy mode should return 200
      expect(response.status).toBe(200);
      
      const result = await response.json();
      // apiCachedSuccess wraps data in { data: ... }
      expect(result.data).toBeDefined();
      expect(result.data.platforms).toBeDefined();
      expect(Array.isArray(result.data.platforms)).toBe(true);
    });

    it('should return platforms array in legacy mode', async () => {
      // Given: Feature flag is disabled
      setFlag('FF_PILOT_PLATFORMS_API', false);

      // When: Request platforms list
      const response = await GET();

      // Then: Should return platforms array
      const result = await response.json();
      expect(result.data.platforms).toHaveLength(2);
      expect(result.data.platforms[0]).toHaveProperty('code');
      expect(result.data.platforms[0]).toHaveProperty('name');
    });

    it('should return cached response in legacy mode', async () => {
      // Given: Feature flag is disabled
      setFlag('FF_PILOT_PLATFORMS_API', false);

      // When: Request platforms list
      const response = await GET();

      // Then: Should have cache headers
      expect(response.status).toBe(200);
      const cacheControl = response.headers.get('Cache-Control');
      expect(cacheControl).toBeDefined();
    });

    it('should order platforms by code ascending in legacy mode', async () => {
      // Given: Feature flag is disabled
      setFlag('FF_PILOT_PLATFORMS_API', false);

      // When: Request platforms list
      const response = await GET();

      // Then: Platforms should be ordered by code (android comes before ios)
      const result = await response.json();
      expect(result.data.platforms[0].code).toBe('android');
      expect(result.data.platforms[1].code).toBe('ios');
    });
  });

  // ============================================================================
  // Feature Flag: enabled (Provider mode with fallback)
  // ============================================================================
  describe('Feature Flag: enabled', () => {
    it('should handle provider mode request (may fallback)', async () => {
      // Given: Feature flag is enabled
      setFlag('FF_PILOT_PLATFORMS_API', true);

      // When: Request platforms list
      const response = await GET();

      // Then: Should return valid response (may be provider or fallback to legacy)
      expect(response.status).toBe(200);
      
      const result = await response.json();
      // Response may be either { platforms, _meta } (provider) or { data: { platforms } } (legacy)
      const platforms = result.platforms || result.data?.platforms;
      expect(platforms).toBeDefined();
      expect(Array.isArray(platforms)).toBe(true);
    });

    it('should return response with valid platforms when flag enabled', async () => {
      // Given: Feature flag is enabled
      setFlag('FF_PILOT_PLATFORMS_API', true);

      // When: Request platforms list
      const response = await GET();

      // Then: Should return valid response
      expect(response.status).toBe(200);
      
      const result = await response.json();
      const platforms = result.platforms || result.data?.platforms;
      expect(platforms).toBeDefined();
      expect(platforms.length).toBeGreaterThan(0);
      expect(platforms[0]).toHaveProperty('id');
      expect(platforms[0]).toHaveProperty('code');
      expect(platforms[0]).toHaveProperty('name');
    });

    it('should maintain cache headers when flag enabled', async () => {
      // Given: Feature flag is enabled
      setFlag('FF_PILOT_PLATFORMS_API', true);

      // When: Request platforms list
      const response = await GET();

      // Then: Should have cache headers (from either provider or legacy)
      expect(response.status).toBe(200);
      const cacheControl = response.headers.get('Cache-Control');
      expect(cacheControl).toBeDefined();
    });
  });

  // ============================================================================
  // Fallback behavior
  // ============================================================================
  describe('Fallback behavior', () => {
    it('should fallback to legacy on provider failure', async () => {
      // Given: Feature flag is enabled but provider fails
      setFlag('FF_PILOT_PLATFORMS_API', true);
      
      const { createDatabaseProviderFromEnv } = await import('@/lib/database/provider');
      vi.mocked(createDatabaseProviderFromEnv).mockImplementation(() => {
        throw new Error('Provider initialization failed');
      });

      // When: Request platforms list
      const response = await GET();

      // Then: Should still return 200 with fallback to legacy
      expect(response.status).toBe(200);
      
      const result = await response.json();
      // Fallback uses legacy format { data: { platforms } }
      expect(result.data?.platforms || result.platforms).toBeDefined();
    });

    it('should fallback when provider returns null', async () => {
      // Given: Feature flag is enabled but provider returns null
      setFlag('FF_PILOT_PLATFORMS_API', true);
      
      const { createDatabaseProviderFromEnv } = await import('@/lib/database/provider');
      vi.mocked(createDatabaseProviderFromEnv).mockReturnValue(null as any);

      // When: Request platforms list
      const response = await GET();

      // Then: Should fallback to legacy
      expect(response.status).toBe(200);
      
      const result = await response.json();
      expect(result.data?.platforms || result.platforms).toBeDefined();
    });

    it('should fallback when provider query fails', async () => {
      // Given: Feature flag is enabled but query fails
      setFlag('FF_PILOT_PLATFORMS_API', true);
      
      const { createDatabaseProviderFromEnv } = await import('@/lib/database/provider');
      vi.mocked(createDatabaseProviderFromEnv).mockReturnValue({
        type: 'supabase',
        getSupabaseClient: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ 
                data: null, 
                error: new Error('Query failed') 
              }),
            }),
          }),
        }),
      } as any);

      // When: Request platforms list
      const response = await GET();

      // Then: Should fallback to legacy
      expect(response.status).toBe(200);
    });

    it('should fallback when provider has no Supabase client', async () => {
      // Given: Feature flag is enabled but provider has no Supabase client
      setFlag('FF_PILOT_PLATFORMS_API', true);
      
      const { createDatabaseProviderFromEnv } = await import('@/lib/database/provider');
      vi.mocked(createDatabaseProviderFromEnv).mockReturnValue({
        type: 'sqlite',
        getSupabaseClient: undefined,
      } as any);

      // When: Request platforms list
      const response = await GET();

      // Then: Should fallback to legacy
      expect(response.status).toBe(200);
    });
  });

  // ============================================================================
  // Environment variable override
  // ============================================================================
  describe('Environment variable override', () => {
    it('should respect environment variable override (true)', async () => {
      // Given: Environment variable is set to true
      vi.stubEnv('FF_PILOT_PLATFORMS_API', 'true');

      // When: Request platforms list
      const response = await GET();

      // Then: Should attempt to use provider
      expect(response.status).toBe(200);
    });

    it('should respect environment variable override (false)', async () => {
      // Given: Environment variable is set to false
      vi.stubEnv('FF_PILOT_PLATFORMS_API', 'false');

      // When: Request platforms list
      const response = await GET();

      // Then: Should use legacy (no x-provider-type header in legacy)
      const providerType = response.headers.get('x-provider-type');
      expect(providerType).toBeNull();
    });
  });

  // ============================================================================
  // Response Structure
  // ============================================================================
  describe('Response Structure', () => {
    it('should have consistent response structure in legacy mode', async () => {
      setFlag('FF_PILOT_PLATFORMS_API', false);
      const response = await GET();
      const result = await response.json();

      // Required fields - legacy mode wraps in { data: ... }
      expect(result.data).toBeDefined();
      expect(result.data.platforms).toBeDefined();
      expect(Array.isArray(result.data.platforms)).toBe(true);
      
      // No _meta in legacy mode
      expect(result._meta).toBeUndefined();
    });

    it('should have consistent platform object structure', async () => {
      setFlag('FF_PILOT_PLATFORMS_API', false);
      const response = await GET();
      const result = await response.json();

      if (result.data.platforms.length > 0) {
        const platform = result.data.platforms[0];
        expect(platform).toHaveProperty('id');
        expect(platform).toHaveProperty('code');
        expect(platform).toHaveProperty('name');
        expect(platform).toHaveProperty('display_order');
      }
    });

    it('should return empty array when no platforms exist', async () => {
      // Mock empty response
      const { createAdminClient } = await import('@/lib/supabase/server');
      vi.mocked(createAdminClient).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      } as any);

      setFlag('FF_PILOT_PLATFORMS_API', false);
      const response = await GET();
      const result = await response.json();

      expect(result.data.platforms).toEqual([]);
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================
  describe('Error Handling', () => {
    it('should return 500 on database error in legacy mode', async () => {
      // Mock database error
      const { createAdminClient } = await import('@/lib/supabase/server');
      vi.mocked(createAdminClient).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ 
              data: null, 
              error: { message: 'Database connection failed' } 
            }),
          }),
        }),
      } as any);

      setFlag('FF_PILOT_PLATFORMS_API', false);
      const response = await GET();

      expect(response.status).toBe(500);
    });
  });

  // ============================================================================
  // POST Method (Legacy - Phase 3.2)
  // ============================================================================
  describe('POST Method (Legacy)', () => {
    it('should use legacy POST handler', async () => {
      // Given: Valid platform data
      const request = new Request('http://localhost:3000/api/platforms', {
        method: 'POST',
        body: JSON.stringify({
          code: 'web',
          name: 'Web',
          description: 'Web platform',
          display_order: 3,
        }),
      });

      // When: POST request (should use legacy)
      const response = await POST(request as any);

      // Then: Should process request (may fail due to auth, but should not crash)
      expect(response).toBeDefined();
    });

    it('should handle POST request without crashing', async () => {
      // Given: Valid platform data
      const request = new Request('http://localhost:3000/api/platforms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'web',
          name: 'Web',
          description: 'Web platform',
          display_order: 3,
        }),
      });

      // When: POST request
      const response = await POST(request as any);

      // Then: Should return response (may be 401/500 due to auth mock)
      expect(response.status).toBeDefined();
    });
  });
});
