/**
 * Repository Factory Functions
 * 
 * This module provides factory functions for creating repository instances
 * with support for multiple database providers (Supabase, SQLite).
 * 
 * All factories use dynamic imports for bundle size optimization,
 * loading only the required implementation based on the configured provider.
 * 
 * @example
 * ```typescript
 * import { createUserRepository, createTranslationRepository } from '@/repositories/factories';
 * 
 * const userRepo = await createUserRepository(supabase);
 * const translationRepo = await createTranslationRepository(supabase);
 * ```
 */

// User Repository Factory
export { createUserRepository } from './user_repository_factory';

// Translation Repository Factory
export { createTranslationRepository } from './translation_repository_factory';

// Glossary Repository Factory
export { createGlossaryRepository } from './glossary_repository_factory';

// Audit Log Repository Factory
export { createAuditLogRepository } from './audit_log_repository_factory';

// Translation Result Repository Factory
export { createTranslationResultRepository } from './translation_result_repository_factory';

// Translation Product Repository Factory
export { createTranslationProductRepository } from './translation_product_repository_factory';

// Translation Audit Repository Factory (deprecated, use createAuditLogRepository)
export { createTranslationAuditRepository } from './translation_audit_repository_factory';
