/**
 * Users Service
 * 
 * Business logic layer for user management operations.
 * Handles validation, bulk operations, and audit logging.
 * 
 * @example
 * ```typescript
 * const service = new UsersService(supabase);
 * 
 * // Upload users
 * const users = await service.uploadUsers(
 *   [{ email: 'test@example.com', ... }],
 *   'admin-user-id'
 * );
 * ```
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { 
  UsersRepository, 
  UserCreateData, 
  UserUpdateData,
  User,
  UserFilters
} from '@/repositories/users_repository';
import type { PaginationParams, PaginatedResult } from '@/repositories/translation_repository';

export interface UserUploadData {
  email: string;
  full_name?: string | null;
  role?: 'admin' | 'translator' | 'reviewer' | 'user';
}

export interface BulkOperationResult {
  success: boolean;
  count: number;
  errors?: string[];
}

export class UsersService {
  private repository: UsersRepository;

  constructor(private supabase: SupabaseClient) {
    this.repository = new UsersRepository(supabase);
  }

  /**
   * Validate email format
   */
  private validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate that user cannot delete themselves
   */
  private validateNotSelfDelete(ids: string[], currentUserId: string): void {
    if (ids.includes(currentUserId)) {
      throw new Error('Cannot delete your own account');
    }
  }

  /**
   * Validate that user cannot change their own role
   */
  private validateNotSelfRoleChange(
    ids: string[], 
    currentUserId: string, 
    updates: UserUpdateData
  ): void {
    if (updates.role && ids.includes(currentUserId)) {
      throw new Error('Cannot change your own role');
    }
  }

  /**
   * Upload multiple users
   */
  async uploadUsers(
    users: UserUploadData[],
    createdBy: string
  ): Promise<BulkOperationResult> {
    const errors: string[] = [];
    const validUsers: UserCreateData[] = [];

    // Validate each user
    for (const user of users) {
      if (!user.email) {
        errors.push('Email is required');
        continue;
      }

      if (!this.validateEmail(user.email)) {
        errors.push(`Invalid email format: ${user.email}`);
        continue;
      }

      // Check for duplicates
      const existing = await this.repository.findByEmail(user.email);
      if (existing) {
        errors.push(`User already exists: ${user.email}`);
        continue;
      }

      validUsers.push({
        email: user.email,
        full_name: user.full_name || null,
        role: user.role || 'user',
        status: 'active',
      });
    }

    if (validUsers.length === 0) {
      return {
        success: false,
        count: 0,
        errors,
      };
    }

    try {
      const createdUsers = await this.repository.createMany(validUsers);

      // Create audit log
      await this.repository.createAuditLog(
        'BULK_UPLOAD',
        {
          count: createdUsers.length,
          emails: createdUsers.map(u => u.email),
        },
        createdBy
      );

      return {
        success: true,
        count: createdUsers.length,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      return {
        success: false,
        count: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Update multiple users
   */
  async updateUsers(
    ids: string[],
    updates: UserUpdateData,
    currentUserId: string
  ): Promise<BulkOperationResult> {
    try {
      // Validation
      this.validateNotSelfRoleChange(ids, currentUserId, updates);

      const count = await this.repository.updateMany(ids, updates);

      // Create audit log
      await this.repository.createAuditLog(
        'BULK_UPDATE',
        {
          userIds: ids,
          updates,
        },
        currentUserId
      );

      return {
        success: true,
        count,
      };
    } catch (error) {
      return {
        success: false,
        count: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Delete multiple users
   */
  async deleteUsers(
    ids: string[],
    currentUserId: string
  ): Promise<BulkOperationResult> {
    try {
      // Validation
      this.validateNotSelfDelete(ids, currentUserId);

      const count = await this.repository.deleteMany(ids);

      // Create audit log
      await this.repository.createAuditLog(
        'BULK_DELETE',
        {
          deletedIds: ids,
          count,
        },
        currentUserId
      );

      return {
        success: true,
        count,
      };
    } catch (error) {
      return {
        success: false,
        count: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Get users with filters
   */
  async getUsers(
    filters: UserFilters = {},
    pagination: Partial<PaginationParams> = {}
  ): Promise<PaginatedResult<User>> {
    return this.repository.findMany(filters, pagination);
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<User | null> {
    return this.repository.findById(id);
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    return this.repository.findByEmail(email);
  }
}
