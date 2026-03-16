/**
 * Repository Interfaces
 * 
 * 모든 Repository 인터페이스를 한 곳에서 export
 * 
 * @example
 * ```typescript
 * // 인터페이스 사용
 * import { 
 *   IUserRepository, 
 *   ITranslationRepository,
 *   IGlossaryRepository 
 * } from '@/repositories/interfaces';
 * 
 * // 구현체에서 사용
 * class UserRepository implements IUserRepository {
 *   // implementation
 * }
 * ```
 */

// ============================================================================
// Base Repository Interfaces
// ============================================================================

export type {
  // Base interfaces
  IBaseRepository,
  IReadOnlyRepository,
  IWriteOnlyRepository,
  IAuditableRepository,
  ILockableRepository,
  
  // Common types
  PaginationParams,
  PaginatedResult,
  UserInfo,
  OptimisticLockOptions,
  LockCheckResult,
} from './base_repository';

// ============================================================================
// User Repository
// ============================================================================

export type {
  IUserRepository,
  UserRepositoryProvider,
  User,
  UserRole,
  UserStatus,
  UserCreateData,
  UserUpdateData,
  UserFilters,
  UserAuditLog,
} from './user_repository';

// ============================================================================
// Translation Repository
// ============================================================================

export type {
  ITranslationRepository,
  TranslationRepositoryProvider,
  TranslationFilters,
  TranslationCreateData,
  TranslationUpdateData,
} from './translation_repository';

// ============================================================================
// Glossary Repository
// ============================================================================

export type {
  IGlossaryRepository,
  GlossaryRepositoryProvider,
  GlossaryTerm,
  GlossaryCreateData,
  GlossaryUpdateData,
  GlossaryFilters,
  GlossaryAuditLog,
  ApprovalStatus,
  GlossaryExactMatch,
  BulkApproveResult,
} from './glossary_repository';

// ============================================================================
// Audit Log Repository
// ============================================================================

export type {
  IAuditLogRepository,
  ITranslationAuditRepository,
  AuditLogRepositoryProvider,
  TranslationAuditRepositoryProvider,
  GroupedAuditLogs,
} from './audit_log_repository';

// ============================================================================
// Translation Result Repository
// ============================================================================

export type {
  ITranslationResultRepository,
  TranslationResultRepositoryProvider,
  TranslationResultCreateData,
  TranslationResultUpdateData,
} from './translation_result_repository';

// ============================================================================
// Translation Product Repository
// ============================================================================

export type {
  ITranslationProductRepository,
  TranslationProductRepositoryProvider,
  TranslationProductCreateData,
} from './translation_product_repository';

// ============================================================================
// Supabase Extension Interfaces
// ============================================================================

export type {
  // Upsert
  ISupabaseUpsertRepository,
  UpsertOptions,
  
  // RPC
  ISupabaseRpcRepository,
  RpcOptions,
  
  // Realtime
  ISupabaseRealtimeRepository,
  RealtimeEve[기밀마스킹]ype,
  RealtimeCallback,
  
  // Batch
  ISupabaseBatchRepository,
  BatchResult,
  
  // Combined
  ISupabaseExtendedRepository,
} from './supabase_extensions';
