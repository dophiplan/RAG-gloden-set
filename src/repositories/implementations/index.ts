/**
 * Repository Implementations
 * 
 * 다양한 데이터베이스 Provider별 Repository 구현체들을 제공합니다.
 * 
 * @example
 * ```typescript
 * // Supabase 구현체 사용
 * import { SupabaseTranslationRepository } from './supabase';
 * 
 * const repo = new SupabaseTranslationRepository(supabase);
 * 
 * // SQLite 구현체 사용
 * import { SqliteTranslationRepository } from './sqlite';
 * 
 * const db = createSqliteClient();
 * const repo = new SqliteTranslationRepository(db);
 * ```
 */

// Supabase implementations
export { SupabaseTranslationRepository } from './supabase/translation_repository';
export { SupabaseTranslationResultRepository } from './supabase/translation_result_repository';
export { SupabaseTranslationProductRepository } from './supabase/translation_product_repository';
export { SupabaseAuditLogRepository } from './supabase/audit_log_repository';

// SQLite implementations
export { SqliteTranslationRepository } from './sqlite/translation_repository';
export { SqliteTranslationResultRepository } from './sqlite/translation_result_repository';
export { SqliteTranslationProductRepository } from './sqlite/translation_product_repository';
export { SqliteAuditLogRepository } from './sqlite/audit_log_repository';
