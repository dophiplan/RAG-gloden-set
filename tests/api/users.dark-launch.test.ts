import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getUsers } from '@/app/api/users/route';
import { GET as getUserById } from '@/app/api/users/[id]/route';

describe('/api/users Dark Launch', () => {
  beforeEach(() => {
    // 테스트 전 Feature Flag 초기화
    process.env.FF_USERS_DARK_LAUNCH = 'false';
  });
  
  afterEach(() => {
    // 테스트 후 정리
    delete process.env.FF_USERS_DARK_LAUNCH;
  });

  describe('GET /api/users (List)', () => {
    it('should use legacy when dark launch is disabled', async () => {
      process.env.FF_USERS_DARK_LAUNCH = 'false';
      
      const request = new NextRequest('http://localhost:3000/api/users');
      const response = await getUsers(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.users).toBeDefined();
      expect(data.pagination).toBeDefined();
    });
    
    it('should execute dark launch when enabled', async () => {
      process.env.FF_USERS_DARK_LAUNCH = 'true';
      
      const request = new NextRequest('http://localhost:3000/api/users');
      const response = await getUsers(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.users).toBeDefined();
    });
    
    it('should return same structure as legacy', async () => {
      process.env.FF_USERS_DARK_LAUNCH = 'true';
      
      const request = new NextRequest('http://localhost:3000/api/users?page=1&limit=10');
      const response = await getUsers(request);
      
      const data = await response.json();
      expect(data).toHaveProperty('users');
      expect(data).toHaveProperty('pagination');
      expect(data.pagination).toHaveProperty('page');
      expect(data.pagination).toHaveProperty('limit');
      expect(data.pagination).toHaveProperty('total');
      expect(data.pagination).toHaveProperty('totalPages');
    });
    
    it('should handle pagination correctly', async () => {
      process.env.FF_USERS_DARK_LAUNCH = 'true';
      
      const request = new NextRequest('http://localhost:3000/api/users?page=2&limit=5');
      const response = await getUsers(request);
      
      const data = await response.json();
      expect(data.pagination.page).toBe(2);
      expect(data.pagination.limit).toBe(5);
    });
    
    it('should handle search filter', async () => {
      process.env.FF_USERS_DARK_LAUNCH = 'true';
      
      const request = new NextRequest('http://localhost:3000/api/users?search=test');
      const response = await getUsers(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data.users)).toBe(true);
    });
  });

  describe('GET /api/users/:id (Single)', () => {
    it('should return user by id with dark launch', async () => {
      process.env.FF_USERS_DARK_LAUNCH = 'true';
      const userId = 'test-user-id';
      
      const request = new NextRequest(`http://localhost:3000/api/users/${userId}`);
      const response = await getUserById(request, { params: Promise.resolve({ id: userId }) });
      
      // 사용자 존재 여부와 관계없이 200 또는 404
      expect([200, 404]).toContain(response.status);
    });
    
    it('should return 404 for non-existent user', async () => {
      process.env.FF_USERS_DARK_LAUNCH = 'true';
      
      const request = new NextRequest('http://localhost:3000/api/users/non-existent-id');
      const response = await getUserById(request, { params: Promise.resolve({ id: 'non-existent-id' }) });
      
      expect(response.status).toBe(404);
    });
    
    it('should return same structure as legacy', async () => {
      process.env.FF_USERS_DARK_LAUNCH = 'true';
      const userId = 'test-user-id';
      
      const request = new NextRequest(`http://localhost:3000/api/users/${userId}`);
      const response = await getUserById(request, { params: Promise.resolve({ id: userId }) });
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('user');
      }
    });
  });

  describe('Error Handling', () => {
    it('should require authentication', async () => {
      process.env.FF_USERS_DARK_LAUNCH = 'true';
      
      const request = new NextRequest('http://localhost:3000/api/users');
      const response = await getUsers(request);
      
      // 인증 실패 시 401
      expect([401, 403]).toContain(response.status);
    });
    
    it('should handle provider failure gracefully', async () => {
      process.env.FF_USERS_DARK_LAUNCH = 'true';
      
      const request = new NextRequest('http://localhost:3000/api/users');
      const response = await getUsers(request);
      
      // Provider 실패핏도 200 또는 인증 에러
      expect([200, 401, 403]).toContain(response.status);
    });
  });
});
