import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UsersService } from '@/services/users_service';

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
  ilike: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue({ data: [], count: 0, error: null }),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
});

describe('UsersService', () => {
  let service: UsersService;
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  const currentUserId = 'admin-123';

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    service = new UsersService(mockSupabase as any);
  });

  describe('uploadUsers', () => {
    it('should validate email format', async () => {
      const users = [
        { email: 'invalid-email', full_name: 'Invalid User' },
      ];

      const result = await service.uploadUsers(users, currentUserId);

      expect(result.success).toBe(false);
      expect(result.count).toBe(0);
      expect(result.errors?.[0]).toContain('Invalid email format');
    });

    it('should skip empty email entries', async () => {
      const users = [
        { full_name: 'No Email User' },
      ];

      const result = await service.uploadUsers(users, currentUserId);

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toBe('Email is required');
    });

    it('should check for duplicate emails', async () => {
      const users = [
        { email: 'existing@example.com', full_name: 'Existing User' },
      ];

      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'existing', email: 'existing@example.com' },
        error: null,
      });

      const result = await service.uploadUsers(users, currentUserId);

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('User already exists');
    });
  });

  describe('updateUsers', () => {
    it('should prevent self role change', async () => {
      const ids = [currentUserId];
      const updates = { role: 'user' as const };

      const result = await service.updateUsers(ids, updates, currentUserId);

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toBe('Cannot change your own role');
    });

    it('should allow updates without role change', async () => {
      const ids = [currentUserId];
      const updates = { full_name: 'New Name' };

      mockSupabase.in.mockReturnThis();
      mockSupabase.select.mockResolvedValueOnce({
        data: [{ id: currentUserId }],
        error: null,
      });

      const result = await service.updateUsers(ids, updates, currentUserId);

      expect(result.success).toBe(true);
    });
  });

  describe('deleteUsers', () => {
    it('should prevent self deletion', async () => {
      const ids = [currentUserId, 'user-2'];

      const result = await service.deleteUsers(ids, currentUserId);

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toBe('Cannot delete your own account');
    });

    it('should delete other users', async () => {
      const ids = ['user-1', 'user-2'];

      mockSupabase.in.mockResolvedValueOnce({ error: null, count: 2 });

      const result = await service.deleteUsers(ids, currentUserId);

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
    });
  });

  describe('getUsers', () => {
    it('should return paginated users', async () => {
      const mockUsers = [
        { id: 'user-1', email: 'user1@example.com' },
        { id: 'user-2', email: 'user2@example.com' },
      ];

      mockSupabase.order.mockResolvedValueOnce({
        data: mockUsers,
        count: 2,
        error: null,
      });

      const result = await service.getUsers({}, { page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.count).toBe(2);
    });

    it('should apply role filter', async () => {
      mockSupabase.order.mockResolvedValueOnce({
        data: [],
        count: 0,
        error: null,
      });

      await service.getUsers({ role: 'admin' });

      expect(mockSupabase.eq).toHaveBeenCalledWith('role', 'admin');
    });

    it('should apply search filter', async () => {
      mockSupabase.order.mockResolvedValueOnce({
        data: [],
        count: 0,
        error: null,
      });

      await service.getUsers({ search: 'test' });

      expect(mockSupabase.or).toHaveBeenCalled();
    });
  });

  describe('getUserById', () => {
    it('should return user by id', async () => {
      const mockUser = { id: 'user-1', email: 'user@example.com' };

      mockSupabase.single.mockResolvedValueOnce({
        data: mockUser,
        error: null,
      });

      const result = await service.getUserById('user-1');

      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });

      const result = await service.getUserById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getUserByEmail', () => {
    it('should return user by email', async () => {
      const mockUser = { id: 'user-1', email: 'user@example.com' };

      mockSupabase.single.mockResolvedValueOnce({
        data: mockUser,
        error: null,
      });

      const result = await service.getUserByEmail('user@example.com');

      expect(result).toEqual(mockUser);
    });
  });
});
