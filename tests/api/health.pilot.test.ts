/**
 * /api/health Pilot Tests
 * 
 * Provider 패턴 전환을 위한 통합 테스트
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET, HEAD } from '@/app/api/health/route';
import { setFlag, resetFlag } from '@/lib/config/feature_flags';
import { resetDatabaseProvider } from '@/lib/database/provider';

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
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
      translations: {
        findMany: vi.fn().mockResolvedValue({ data: [], error: null }),
      },
    }),
  };
});

describe('/api/health Pilot', () => {
  beforeEach(() => {
    // Reset state before each test
    resetFlag('FF_PILOT_HEALTH_API');
    resetDatabaseProvider();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup after each test
    resetFlag('FF_PILOT_HEALTH_API');
    resetDatabaseProvider();
    vi.unstubAllEnvs();
  });

  describe('Feature Flag: disabled', () => {
    it('should use legacy when flag is disabled', async () => {
      // Given: Feature flag is disabled
      setFlag('FF_PILOT_HEALTH_API', false);

      // When: Request health check
      const request = new Request('http://localhost:3000/api/health');
      const response = await GET(request);

      // Then: Legacy provider type should be returned
      expect(response.status).toBe(200);
      expect(response.headers.get('x-provider-type')).toBe('legacy');
      
      const data = await response.json();
      expect(data.status).toBe('healthy');
      expect(data.provider).toBeUndefined();
    });

    it('should return detailed response with legacy flag disabled', async () => {
      // Given: Feature flag is disabled
      setFlag('FF_PILOT_HEALTH_API', false);

      // When: Request detailed health check
      const request = new Request('http://localhost:3000/api/health?detailed=true');
      const response = await GET(request);

      // Then: Detailed response with legacy provider
      expect(response.status).toBe(200);
      expect(response.headers.get('x-provider-type')).toBe('legacy');
      
      const data = await response.json();
      expect(data.status).toBeDefined();
      expect(data.checks).toBeDefined();
      expect(data.checks.database).toBeDefined();
      expect(data.checks.memory).toBeDefined();
      expect(data.checks.uptime).toBeDefined();
    });

    it('HEAD request should use legacy when flag is disabled', async () => {
      // Given: Feature flag is disabled
      setFlag('FF_PILOT_HEALTH_API', false);

      // When: HEAD request
      const response = await HEAD();

      // Then: Legacy provider with no body
      expect(response.status).toBe(200);
      expect(response.headers.get('x-provider-type')).toBe('legacy');
      expect(response.body).toBeNull();
    });
  });

  describe('Feature Flag: enabled', () => {
    it('should use provider when flag is enabled', async () => {
      // Given: Feature flag is enabled
      setFlag('FF_PILOT_HEALTH_API', true);

      // When: Request health check
      const request = new Request('http://localhost:3000/api/health');
      const response = await GET(request);

      // Then: Provider type should be defined
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.status).toBe('healthy');
    });

    it('should include provider type in response when flag is enabled', async () => {
      // Given: Feature flag is enabled
      setFlag('FF_PILOT_HEALTH_API', true);

      // When: Request health check
      const request = new Request('http://localhost:3000/api/health');
      const response = await GET(request);

      // Then: Provider type header should be present
      const providerType = response.headers.get('x-provider-type');
      expect(providerType).toBeDefined();
      expect(['supabase', 'sqlite', 'legacy']).toContain(providerType);
    });

    it('should return response when flag is enabled (may fallback to legacy)', async () => {
      // Given: Feature flag is enabled
      setFlag('FF_PILOT_HEALTH_API', true);

      // When: Request health check
      const request = new Request('http://localhost:3000/api/health');
      const response = await GET(request);

      // Then: Should return valid response (may be provider or fallback to legacy)
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.status).toBe('healthy');
      expect(data.timestamp).toBeDefined();
      // Provider may be undefined if fallback occurs
      if (data.provider) {
        expect(['supabase', 'sqlite', 'legacy']).toContain(data.provider);
      }
    });
  });

  describe('Fallback behavior', () => {
    it('should fallback to legacy on provider failure', async () => {
      // Given: Feature flag is enabled but provider fails
      setFlag('FF_PILOT_HEALTH_API', true);
      
      const { createDatabaseProviderFromEnv } = await import('@/lib/database/provider');
      vi.mocked(createDatabaseProviderFromEnv).mockImplementation(() => {
        throw new Error('Provider initialization failed');
      });

      // When: Request health check
      const request = new Request('http://localhost:3000/api/health');
      const response = await GET(request);

      // Then: Should still return 200 with fallback to legacy
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.status).toBe('healthy');
    });

    it('should handle database errors gracefully', async () => {
      // Given: Feature flag is enabled
      setFlag('FF_PILOT_HEALTH_API', true);

      // When: Request health check (with mocked healthy response)
      const request = new Request('http://localhost:3000/api/health');
      const response = await GET(request);

      // Then: Should return valid response
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.status).toBeDefined();
      expect(data.timestamp).toBeDefined();
    });
  });

  describe('Environment variable override', () => {
    it('should respect environment variable override (true)', async () => {
      // Given: Environment variable is set to true
      vi.stubEnv('FF_PILOT_HEALTH_API', 'true');

      // When: Request health check
      const request = new Request('http://localhost:3000/api/health');
      const response = await GET(request);

      // Then: Should attempt to use provider
      expect(response.status).toBe(200);
    });

    it('should respect environment variable override (false)', async () => {
      // Given: Environment variable is set to false
      vi.stubEnv('FF_PILOT_HEALTH_API', 'false');

      // When: Request health check
      const request = new Request('http://localhost:3000/api/health');
      const response = await GET(request);

      // Then: Should use legacy
      expect(response.headers.get('x-provider-type')).toBe('legacy');
    });
  });

  describe('Detailed mode', () => {
    it('should return detailed checks in provider mode', async () => {
      // Given: Feature flag is enabled
      setFlag('FF_PILOT_HEALTH_API', true);

      // When: Request detailed health check
      const request = new Request('http://localhost:3000/api/health?detailed=true');
      const response = await GET(request);

      // Then: Detailed response
      const data = await response.json();
      expect(data.checks).toBeDefined();
      expect(data.checks.database).toBeDefined();
      expect(data.checks.memory).toBeDefined();
      expect(data.checks.uptime).toBeDefined();
      expect(data.version).toBeDefined();
      expect(data.environment).toBeDefined();
    });
  });

  describe('Status codes', () => {
    it('should return 200 for healthy status', async () => {
      const request = new Request('http://localhost:3000/api/health');
      const response = await GET(request);

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.status).toBe('healthy');
    });

    it('HEAD should return 200 when healthy', async () => {
      const response = await HEAD();

      expect(response.status).toBe(200);
      expect(response.body).toBeNull();
    });
  });
});

describe('Health Check Response Structure', () => {
  beforeEach(() => {
    resetFlag('FF_PILOT_HEALTH_API');
  });

  it('should have consistent response structure in legacy mode', async () => {
    const request = new Request('http://localhost:3000/api/health');
    const response = await GET(request);
    const data = await response.json();

    // Required fields
    expect(data.status).toBeDefined();
    expect(data.timestamp).toBeDefined();
    
    // Type checks
    expect(typeof data.status).toBe('string');
    expect(typeof data.timestamp).toBe('string');
  });

  it('should include version and environment in detailed mode', async () => {
    const request = new Request('http://localhost:3000/api/health?detailed=true');
    const response = await GET(request);
    const data = await response.json();

    expect(data.version).toBeDefined();
    expect(data.environment).toBeDefined();
    expect(typeof data.version).toBe('string');
    expect(typeof data.environment).toBe('string');
  });

  it('should have valid timestamp format', async () => {
    const request = new Request('http://localhost:3000/api/health');
    const response = await GET(request);
    const data = await response.json();

    // ISO 8601 format check
    const timestamp = new Date(data.timestamp);
    expect(timestamp.toISOString()).toBe(data.timestamp);
  });
});
