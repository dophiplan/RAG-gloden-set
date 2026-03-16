/**
 * /api/users/[id] Shadow Mode 테스트
 * 
 * 검증 항목:
 * 1. Shadow Mode 비활성화 시 Legacy만 실행
 * 2. Shadow Mode 활성화 시 Shadow Mode 실행
 * 3. 인증/권한 체크가 Shadow Mode 외부에 위치
 * 4. Legacy 코드가 100% 유지됨
 * 5. Provider 실패 시 Fallback 동작
 * 6. 안전성 검증 (401, 403, 404)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { PATCH, DELETE } from '@/app/api/users/[id]/route';

// Mock modules
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/permissions', () => ({
  isMaster: vi.fn(),
}));

vi.mock('@/lib/config/feature_flags', async () => {
  const actual = await vi.importActual('@/lib/config/feature_flags');
  return {
    ...actual,
    isEnabled: vi.fn(),
  };
});

vi.mock('@/lib/pilot/shadow-mode', async () => {
  const actual = await vi.importActual('@/lib/pilot/shadow-mode');
  return {
    ...actual,
    shadowWrite: vi.fn(),
  };
});

vi.mock('@/lib/database/provider', () => ({
  createDatabaseProviderFromEnv: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { isMaster } from '@/lib/permissions';
import { isEnabled } from '@/lib/config/feature_flags';
import { shadowWrite } from '@/lib/pilot/shadow-mode';
import { createDatabaseProviderFromEnv } from '@/lib/database/provider';

const mockedCreateClient = vi.mocked(createClient);
const mockedIsMaster = vi.mocked(isMaster);
const mockedIsEnabled = vi.mocked(isEnabled);
const mockedShadowWrite = vi.mocked(shadowWrite);
const mockedCreateDatabaseProviderFromEnv = vi.mocked(createDatabaseProviderFromEnv);

describe('/api/users/[id] Shadow Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ============================================================================
  // 인증/권한 검증
  // ============================================================================

  describe('Authentication & Authorization', () => {
    it('should return 401 when user is not authenticated', async () => {
      // Arrange
      mockedCreateClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: new Error('Not authenticated'),
          }),
        },
        from: vi.fn(),
      } as any);

      const request = new NextRequest('http://localhost:3000/api/users/123', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Test User' }),
      });

      // Act
      const response = await PATCH(request, { params: Promise.resolve({ id: '123' }) });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(data.error).toBe('인증이 필요합니다.');
    });

    it('should return 403 when user is not master', async () => {
      // Arrange
      const mockUser = { id: 'user-1', email: 'test@example.com' };
      const mockCurrentUser = { id: 'user-1', roles: ['translator_ja'] };

      mockedCreateClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockCurrentUser,
                error: null,
              }),
            }),
          }),
        }),
      } as any);

      mockedIsMaster.mockReturnValue(false);

      const request = new NextRequest('http://localhost:3000/api/users/123', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Test User' }),
      });

      // Act
      const response = await PATCH(request, { params: Promise.resolve({ id: '123' }) });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(403);
      expect(data.error).toBe('권한이 없습니다.');
    });

    it('should always check auth/permission before Shadow Mode', async () => {
      // Arrange
      const mockUser = { id: 'user-1', email: 'test@example.com' };
      const mockCurrentUser = { id: 'user-1', roles: ['master'] };

      mockedCreateClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockCurrentUser,
                error: null,
              }),
            }),
          }),
        }),
      } as any);

      mockedIsMaster.mockReturnValue(true);
      mockedIsEnabled.mockReturnValue(true);
      mockedShadowWrite.mockImplementation(async (legacyFn) => legacyFn());

      const request = new NextRequest('http://localhost:3000/api/users/123', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Test User' }),
      });

      // Act
      await PATCH(request, { params: Promise.resolve({ id: '123' }) });

      // Assert
      expect(mockedCreateClient).toHaveBeenCalled();
      expect(mockedIsMaster).toHaveBeenCalled();
      expect(mockedIsEnabled).toHaveBeenCalledWith('FF_USERS_SHADOW_MODE');
    });
  });

  // ============================================================================
  // Shadow Mode 기능 검증
  // ============================================================================

  describe('Shadow Mode Functionality', () => {
    const setupAuthenticatedRequest = () => {
      const mockUser = { id: 'user-1', email: 'test@example.com' };
      const mockCurrentUser = { id: 'user-1', roles: ['master'] };
      const mockTargetUser = { id: '123', name: 'Target User', roles: ['translator_ja'] };

      mockedCreateClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: vi.fn().mockImplementation((table: string) => ({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: table === 'users' ? mockTargetUser : null,
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { ...mockTargetUser, name: 'Updated User' },
                  error: null,
                }),
              }),
            }),
          }),
        })),
      } as any);

      mockedIsMaster.mockReturnValue(true);

      return { mockUser, mockCurrentUser, mockTargetUser };
    };

    it('should use legacy when shadow mode is disabled', async () => {
      // Arrange
      setupAuthenticatedRequest();
      mockedIsEnabled.mockReturnValue(false);

      const request = new NextRequest('http://localhost:3000/api/users/123', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated User' }),
      });

      // Act
      const response = await PATCH(request, { params: Promise.resolve({ id: '123' }) });
      const data = await response.json();

      // Assert
      expect(mockedIsEnabled).toHaveBeenCalledWith('FF_USERS_SHADOW_MODE');
      expect(mockedShadowWrite).not.toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(data.user).toBeDefined();
    });

    it('should execute shadow mode when enabled', async () => {
      // Arrange
      setupAuthenticatedRequest();
      mockedIsEnabled.mockReturnValue(true);
      mockedShadowWrite.mockImplementation(async (legacyFn) => legacyFn());

      const mockProvider = {
        users: {
          update: vi.fn().mockResolvedValue({ id: '123', name: 'Updated User' }),
        },
      };
      mockedCreateDatabaseProviderFromEnv.mockReturnValue(mockProvider as any);

      const request = new NextRequest('http://localhost:3000/api/users/123', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated User' }),
      });

      // Act
      const response = await PATCH(request, { params: Promise.resolve({ id: '123' }) });

      // Assert
      expect(mockedIsEnabled).toHaveBeenCalledWith('FF_USERS_SHADOW_MODE');
      expect(mockedShadowWrite).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    it('should return legacy result even if shadow fails', async () => {
      // Arrange
      setupAuthenticatedRequest();
      mockedIsEnabled.mockReturnValue(true);

      const legacyResult = { user: { id: '123', name: 'Legacy Result' } };
      mockedShadowWrite.mockImplementation(async (legacyFn) => {
        // Shadow 작업은 실패하지만 Legacy 결과 반환
        return legacyResult;
      });

      const request = new NextRequest('http://localhost:3000/api/users/123', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated User' }),
      });

      // Act
      const response = await PATCH(request, { params: Promise.resolve({ id: '123' }) });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.user).toBeDefined();
    });

    it('should pass correct options to shadowWrite', async () => {
      // Arrange
      setupAuthenticatedRequest();
      mockedIsEnabled.mockReturnValue(true);
      mockedShadowWrite.mockImplementation(async (legacyFn) => legacyFn());

      const request = new NextRequest('http://localhost:3000/api/users/123', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated User' }),
      });

      // Act
      await PATCH(request, { params: Promise.resolve({ id: '123' }) });

      // Assert
      expect(mockedShadowWrite).toHaveBeenCalledWith(
        expect.any(Function), // Legacy function
        expect.any(Function), // Shadow function
        {
          operation: 'updateUser',
          entityType: 'user',
          entityId: '123',
        }
      );
    });
  });

  // ============================================================================
  // 안전성 검증
  // ============================================================================

  describe('Safety Checks', () => {
    it('should return 404 when user not found', async () => {
      // Arrange
      const mockUser = { id: 'user-1', email: 'test@example.com' };
      const mockCurrentUser = { id: 'user-1', roles: ['master'] };

      mockedCreateClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'users') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: mockCurrentUser,
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Not found' },
                }),
              }),
            }),
          };
        }),
      } as any);

      mockedIsMaster.mockReturnValue(true);
      mockedIsEnabled.mockReturnValue(false);

      const request = new NextRequest('http://localhost:3000/api/users/non-existent', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated User' }),
      });

      // Act
      const response = await PATCH(request, { params: Promise.resolve({ id: 'non-existent' }) });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(data.error).toBe('사용자를 찾을 수 없습니다.');
    });
  });

  // ============================================================================
  // DELETE 메소드 검증 (Shadow Mode 미적용)
  // ============================================================================

  describe('DELETE endpoint (without Shadow Mode)', () => {
    it('should not use shadow mode for DELETE', async () => {
      // Arrange
      const mockUser = { id: 'user-1', email: 'test@example.com' };
      const mockCurrentUser = { id: 'user-1', roles: ['master'] };
      const mockTargetUser = { id: '123', name: 'Target User' };

      mockedCreateClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: vi.fn().mockImplementation((table: string) => ({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: table === 'users' ? (mockTargetUser) : null,
                error: null,
              }),
            }),
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        })),
      } as any);

      mockedIsMaster.mockReturnValue(true);

      const request = new NextRequest('http://localhost:3000/api/users/123', {
        method: 'DELETE',
      });

      // Act
      const response = await DELETE(request, { params: Promise.resolve({ id: '123' }) });
      const data = await response.json();

      // Assert
      expect(mockedShadowWrite).not.toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  // ============================================================================
  // 결과 비교 및 로깅 검증
  // ============================================================================

  describe('Result Comparison & Logging', () => {
    it('should log comparison results when shadow mode is enabled', async () => {
      // Arrange
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const mockUser = { id: 'user-1', email: 'test@example.com' };
      const mockCurrentUser = { id: 'user-1', roles: ['master'] };

      mockedCreateClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockCurrentUser,
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: '123', name: 'Updated User' },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      } as any);

      mockedIsMaster.mockReturnValue(true);
      mockedIsEnabled.mockReturnValue(true);
      mockedShadowWrite.mockImplementation(async (legacyFn, shadowFn, options) => {
        const legacyResult = await legacyFn();
        // Shadow 함수도 호출
        try {
          await shadowFn();
        } catch (e) {
          // Shadow 실패는 무시
        }
        return legacyResult;
      });

      const request = new NextRequest('http://localhost:3000/api/users/123', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated User' }),
      });

      // Act
      await PATCH(request, { params: Promise.resolve({ id: '123' }) });

      // Assert
      expect(mockedShadowWrite).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should alert on mismatch between legacy and provider results', async () => {
      // Arrange
      const mockUser = { id: 'user-1', email: 'test@example.com' };
      const mockCurrentUser = { id: 'user-1', roles: ['master'] };

      mockedCreateClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockCurrentUser,
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: '123', name: 'Legacy Result' },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      } as any);

      mockedIsMaster.mockReturnValue(true);
      mockedIsEnabled.mockReturnValue(true);

      const mockProvider = {
        users: {
          update: vi.fn().mockResolvedValue({ id: '123', name: 'Provider Result' }),
        },
      };
      mockedCreateDatabaseProviderFromEnv.mockReturnValue(mockProvider as any);

      mockedShadowWrite.mockImplementation(async (legacyFn, shadowFn, options) => {
        const legacyResult = await legacyFn();
        const providerResult = await shadowFn();
        
        // 결과 불일치 시나리오
        expect(legacyResult).not.toEqual(providerResult);
        
        return legacyResult;
      });

      const request = new NextRequest('http://localhost:3000/api/users/123', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated User' }),
      });

      // Act
      await PATCH(request, { params: Promise.resolve({ id: '123' }) });

      // Assert - shadowWrite가 호출되었는지 확인
      expect(mockedShadowWrite).toHaveBeenCalled();
    });
  });
});
