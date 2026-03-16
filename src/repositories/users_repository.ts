/**
 * Users Repository
 * 
 * @deprecated This file is kept for backward compatibility.
 * Use `@/repositories/implementations/supabase/user_repository` instead.
 * 
 * Provides data access for user management with integrated audit logging.
 * 
 * @example
 * ```typescript
 * // New recommended way
 * import { SupabaseUserRepository } from '@/repositories/implementations/supabase/user_repository';
 * 
 * // Old way (still works for backward compatibility)
 * import { UsersRepository } from '@/repositories/users_repository';
 * ```
 */

// Re-export from new implementation for 100% backward compatibility
export { SupabaseUserRepository as UsersRepository } from './implementations/supabase/user_repository';
export { SupabaseUserRepository } from './implementations/supabase/user_repository';

// Re-export types from interfaces
export type {
  User,
  UserCreateData,
  UserUpdateData,
  UserFilters,
  UserAuditLog,
  UserRole,
  UserStatus,
} from './interfaces/user_repository';
