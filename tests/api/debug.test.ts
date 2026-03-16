import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockReturnValue({
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
  }),
}));

vi.mock('@/lib/api-auth', () => ({
  requireMasterRole: vi.fn().mockResolvedValue({
    user: { id: 'user-1', email: 'test@example.com' },
    adminClient: {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockResolvedValue({
              data: [{ id: '1', name: 'User 1' }],
              error: null,
              count: 1,
            }),
          }),
        }),
      }),
    },
    error: null,
  }),
}));

vi.mock('@/lib/config/feature_flags', async () => {
  const actual = await vi.importActual('@/lib/config/feature_flags');
  return {
    ...actual,
    isEnabled: vi.fn().mockReturnValue(false),
  };
});

import { GET as getUsers } from '@/app/api/users/route';

describe('Debug', () => {
  it('should debug response structure', async () => {
    const request = new NextRequest('http://localhost:3000/api/users');
    const response = await getUsers(request);
    
    console.log('Response status:', response.status);
    const clonedResponse = response.clone();
    const text = await clonedResponse.text();
    console.log('Response body:', text);
    
    // 파싱해서 구조 확인
    const data = JSON.parse(text);
    console.log('Data keys:', Object.keys(data));
    if (data.data) {
      console.log('Data.data keys:', Object.keys(data.data));
    }
    
    expect(true).toBe(true);
  });
});
