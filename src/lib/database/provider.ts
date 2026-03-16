/**
 * Database Provider
 * 
 * Repository들에 대한 의존성 주입 및 제공자 패턴 구현
 * 
 * @example
 * ```typescript
 * // 환경변수로 Provider 설정
 * DATABASE_PROVIDER=supabase
 * 
 * // Provider 사용
 * import { getDatabaseProvider } from '@/lib/database/provider';
 * 
 * const provider = getDatabaseProvider();
 * const userRepo = provider.users();
 * const translationRepo = provider.translations();
 * ```
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// Repository Interfaces
import type {
  IUserRepository,
  ITranslationRepository,
  IGlossaryRepository,
  IAuditLogRepository,
  ITranslationAuditRepository,
  ITranslationResultRepository,
  ITranslationProductRepository,
} from '@/repositories/interfaces';

// Repository Implementations (Supabase)
import { SupabaseUserRepository } from '@/repositories/implementations/supabase/user_repository';
import { TranslationRepository } from '@/repositories/translation_repository';
import { GlossaryRepository } from '@/repositories/glossary_repository';
import { AuditLogRepository } from '@/repositories/audit_log_repository';
import { TranslationAuditRepository } from '@/repositories/translation_audit_repository';
import { TranslationResultRepository } from '@/repositories/translation_result_repository';
import { TranslationProductRepository } from '@/repositories/translation_product_repository';

// Repository Implementations (SQLite)
import { SqliteUserRepository } from '@/repositories/implementations/sqlite/user_repository';
import { SqliteTranslationRepository } from '@/repositories/implementations/sqlite/translation_repository';
import { SqliteGlossaryRepository } from '@/repositories/implementations/sqlite/glossary_repository';
import { SqliteAuditLogRepository } from '@/repositories/implementations/sqlite/audit_log_repository';
import { SqliteTranslationResultRepository } from '@/repositories/implementations/sqlite/translation_result_repository';
import { SqliteTranslationProductRepository } from '@/repositories/implementations/sqlite/translation_product_repository';
import { getConnection } from '@/lib/database/sqlite/connection';
import { isEnabled } from '@/lib/config/feature_flags';

// ============================================================================
// Provider Types
// ============================================================================

/**
 * 데이터베이스 제공자 타입
 */
export type DatabaseProviderType = 'supabase' | 'sqlite' | 'mock' | 'custom';

/**
 * 데이터베이스 제공자 설정
 */
export interface DatabaseProviderConfig {
  /** 제공자 타입 */
  type: DatabaseProviderType;
  /** Supabase 클라이언트 (supabase 타입인 경우 필수) */
  supabase?: SupabaseClient;
  /** 커스텀 팩토리 (custom 타입인 경우 필수) */
  customFactory?: RepositoryFactory;
}

/**
 * Repository 팩토리 함수 타입
 */
export type RepositoryFactory = (supabase: SupabaseClient) => RepositorySet;

/**
 * Repository 집합
 */
export interface RepositorySet {
  /** 사용자 Repository */
  users: IUserRepository;
  /** 번역 Repository */
  translations: ITranslationRepository;
  /** 용어집 Repository */
  glossary: IGlossaryRepository;
  /** Audit Log Repository */
  auditLogs: IAuditLogRepository;
  /** Translation Audit Repository */
  translationAudits: ITranslationAuditRepository;
  /** 번역 결과 Repository */
  translationResults: ITranslationResultRepository;
  /** 번역-제품 Repository */
  translationProducts: ITranslationProductRepository;
}

/**
 * 데이터베이스 제공자 인터페이스
 */
export interface DatabaseProvider extends RepositorySet {
  /** 제공자 타입 */
  readonly type: DatabaseProviderType;
  /** 
   * Supabase 클라이언트 접근자
   * @note Supabase 특화 기능이 필요한 경우에만 사용
   */
  getSupabaseClient?(): SupabaseClient;
}

// ============================================================================
// Supabase Provider Implementation
// ============================================================================

/**
 * Supabase Database Provider
 */
class SupabaseDatabaseProvider implements DatabaseProvider {
  readonly type: DatabaseProviderType = 'supabase';

  readonly users: IUserRepository;
  readonly translations: ITranslationRepository;
  readonly glossary: IGlossaryRepository;
  readonly auditLogs: IAuditLogRepository;
  readonly translationAudits: ITranslationAuditRepository;
  readonly translationResults: ITranslationResultRepository;
  readonly translationProducts: ITranslationProductRepository;

  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    
    // Initialize repositories
    this.users = new SupabaseUserRepository(supabase);
    this.translations = new TranslationRepository(supabase);
    this.glossary = new GlossaryRepository(supabase);
    this.auditLogs = new AuditLogRepository(supabase);
    this.translationAudits = new TranslationAuditRepository(supabase);
    this.translationResults = new TranslationResultRepository(supabase);
    this.translationProducts = new TranslationProductRepository(supabase);
  }

  getSupabaseClient(): SupabaseClient {
    return this.supabase;
  }
}

// ============================================================================
// SQLite Provider Implementation
// ============================================================================

/**
 * SQLite Database Provider
 * 
 * SQLite 데이터베이스를 사용하는 Provider 구현
 * - 로컬 개발 및 테스트 환경용
 * - 오프라인 지원
 */
class SQLiteDatabaseProvider implements DatabaseProvider {
  readonly type: DatabaseProviderType = 'sqlite';

  readonly users: IUserRepository;
  readonly translations: ITranslationRepository;
  readonly glossary: IGlossaryRepository;
  readonly auditLogs: IAuditLogRepository;
  readonly translationAudits: ITranslationAuditRepository;
  readonly translationResults: ITranslationResultRepository;
  readonly translationProducts: ITranslationProductRepository;

  constructor() {
    // SQLite 데이터베이스 연결 가져오기
    const db = getConnection();

    // Initialize SQLite repositories with Feature Flag support
    // Note: USE_PROVIDER_PATTERN_* flags can be used to gradually migrate to SQLite

    // Users: Feature Flag로 SQLite/Provider 패턴 전환 가능
    if (isEnabled('USE_PROVIDER_PATTERN_USERS')) {
      this.users = new SqliteUserRepository(db);
    } else {
      this.users = new SqliteUserRepository(db); // Default to SQLite for local dev
    }

    // Translations: Feature Flag로 전환 가능
    if (isEnabled('USE_PROVIDER_PATTERN_TRANSLATIONS')) {
      this.translations = new SqliteTranslationRepository(db);
    } else {
      this.translations = new SqliteTranslationRepository(db);
    }

    this.auditLogs = new SqliteAuditLogRepository(db);
    this.translationResults = new SqliteTranslationResultRepository(db);
    this.translationProducts = new SqliteTranslationProductRepository(db);

    // Glossary: Feature Flag로 SQLite 활성화 가능 (safe rollback)
    if (isEnabled('USE_SQLITE_GLOSSARY')) {
      this.glossary = new SqliteGlossaryRepository(db);
    } else {
      this.glossary = createPlaceholderGlossaryRepository();
    }

    // Translation Audit: Feature Flag로 SQLite 활성화 가능 (safe rollback)
    if (isEnabled('USE_SQLITE_TRANSLATION_AUDIT')) {
      const { SqliteTranslationAuditRepository } = require('@/repositories/implementations/sqlite/translation_audit_repository');
      this.translationAudits = new SqliteTranslationAuditRepository(db);
    } else {
      this.translationAudits = createPlaceholderTranslationAuditRepository();
    }
  }
}

// ============================================================================
// Placeholder Repository Factories
// ============================================================================

/**
 * Glossary Repository placeholder (SQLite implementation pending)
 */
function createPlaceholderGlossaryRepository(): IGlossaryRepository {
  const error = new Error(
    'SQLite GlossaryRepository is not implemented yet. ' +
    'Please use supabase provider for glossary operations.'
  );
  const throwError = () => { throw error; };
  return {
    findMany: throwError,
    findById: throwError,
    findExactMatches: throwError,
    incrementHitCount: throwError,
    create: throwError,
    updateWithAudit: throwError,
    deleteWithAudit: throwError,
    approveWithAudit: throwError,
    rejectWithAudit: throwError,
    bulkApprove: throwError,
    bulkCreate: throwError,
    createAuditLog: throwError,
  } as unknown as IGlossaryRepository;
}

/**
 * Translation Audit Repository placeholder (SQLite implementation pending)
 */
function createPlaceholderTranslationAuditRepository(): ITranslationAuditRepository {
  const error = new Error(
    'SQLite TranslationAuditRepository is not implemented yet. ' +
    'Please use supabase provider for translation audit operations.'
  );
  const throwError = () => { throw error; };
  return {
    create: throwError,
    getLatestByTranslationIds: throwError,
    getByTranslationId: throwError,
    getWithPagination: throwError,
  } as unknown as ITranslationAuditRepository;
}

// ============================================================================
// Mock Provider Implementation (for testing)
// ============================================================================

/**
 * Mock Repository 에러
 */
class MockRepositoryError extends Error {
  constructor(repositoryName: string) {
    super(
      `Mock ${repositoryName} is not implemented. ` +
      `Please provide a custom factory or use the supabase provider.`
    );
    this.name = 'MockRepositoryError';
  }
}

/**
 * Mock Database Provider (for testing)
 * 
 * @note 실제 사용을 위해서는 customFactory를 통해 구현체를 제공해야 합니다.
 */
class MockDatabaseProvider implements DatabaseProvider {
  readonly type: DatabaseProviderType = 'mock';

  // These will throw errors unless custom implementations are provided
  get users(): IUserRepository {
    throw new MockRepositoryError('UsersRepository');
  }
  get translations(): ITranslationRepository {
    throw new MockRepositoryError('TranslationRepository');
  }
  get glossary(): IGlossaryRepository {
    throw new MockRepositoryError('GlossaryRepository');
  }
  get auditLogs(): IAuditLogRepository {
    throw new MockRepositoryError('AuditLogRepository');
  }
  get translationAudits(): ITranslationAuditRepository {
    throw new MockRepositoryError('TranslationAuditRepository');
  }
  get translationResults(): ITranslationResultRepository {
    throw new MockRepositoryError('TranslationResultRepository');
  }
  get translationProducts(): ITranslationProductRepository {
    throw new MockRepositoryError('TranslationProductRepository');
  }
}

// ============================================================================
// Custom Provider Implementation
// ============================================================================

/**
 * Custom Database Provider
 */
class CustomDatabaseProvider implements DatabaseProvider {
  readonly type: DatabaseProviderType = 'custom';
  readonly users: IUserRepository;
  readonly translations: ITranslationRepository;
  readonly glossary: IGlossaryRepository;
  readonly auditLogs: IAuditLogRepository;
  readonly translationAudits: ITranslationAuditRepository;
  readonly translationResults: ITranslationResultRepository;
  readonly translationProducts: ITranslationProductRepository;

  constructor(factory: RepositoryFactory, supabase: SupabaseClient) {
    const repositories = factory(supabase);
    
    this.users = repositories.users;
    this.translations = repositories.translations;
    this.glossary = repositories.glossary;
    this.auditLogs = repositories.auditLogs;
    this.translationAudits = repositories.translationAudits;
    this.translationResults = repositories.translationResults;
    this.translationProducts = repositories.translationProducts;
  }
}

// ============================================================================
// Provider Singleton
// ============================================================================

let providerInstance: DatabaseProvider | null = null;

/**
 * 데이터베이스 제공자 초기화
 * 
 * @param config - 제공자 설정
 * @returns 초기화된 제공자
 * 
 * @example
 * ```typescript
 * // Supabase 사용
 * import { createClient } from '@supabase/supabase-js';
 * import { initializeDatabaseProvider } from '@/lib/database/provider';
 * 
 * const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, ...);
 * const provider = initializeDatabaseProvider({
 *   type: 'supabase',
 *   supabase
 * });
 * 
 * // 또는 환경변수 사용
 * const provider = initializeDatabaseProvider({
 *   type: process.env.DATABASE_PROVIDER as DatabaseProviderType || 'supabase',
 *   supabase
 * });
 * ```
 */
export function initializeDatabaseProvider(config: DatabaseProviderConfig): DatabaseProvider {
  switch (config.type) {
    case 'supabase':
      if (!config.supabase) {
        throw new Error('Supabase client is required for supabase provider');
      }
      providerInstance = new SupabaseDatabaseProvider(config.supabase);
      break;

    case 'custom':
      if (!config.customFactory) {
        throw new Error('Custom factory is required for custom provider');
      }
      if (!config.supabase) {
        throw new Error('Supabase client is required for custom provider');
      }
      providerInstance = new CustomDatabaseProvider(config.customFactory, config.supabase);
      break;

    case 'mock':
      providerInstance = new MockDatabaseProvider();
      break;

    case 'sqlite':
      providerInstance = new SQLiteDatabaseProvider();
      break;

    default:
      throw new Error(`Unknown provider type: ${config.type}`);
  }

  return providerInstance;
}

/**
 * 데이터베이스 제공자 조회
 * 
 * @returns 초기화된 제공자
 * @throws Error 제공자가 초기화되지 않은 경우
 * 
 * @example
 * ```typescript
 * import { getDatabaseProvider } from '@/lib/database/provider';
 * 
 * const provider = getDatabaseProvider();
 * const users = await provider.users.findMany();
 * ```
 */
export function getDatabaseProvider(): DatabaseProvider {
  if (!providerInstance) {
    throw new Error(
      'Database provider not initialized. ' +
      'Call initializeDatabaseProvider() first.'
    );
  }
  return providerInstance;
}

/**
 * 데이터베이스 제공자 초기화 여부 확인
 * 
 * @returns 초기화 여부
 */
export function isDatabaseProviderInitialized(): boolean {
  return providerInstance !== null;
}

/**
 * 데이터베이스 제공자 초기화 해제
 * (주로 테스트에서 사용)
 */
export function resetDatabaseProvider(): void {
  providerInstance = null;
}

// ============================================================================
// Environment-based Configuration
// ============================================================================

/**
 * 환경변수에서 데이터베이스 제공자 설정 로드
 * 
 * 환경변수:
 * - DATABASE_PROVIDER: 'supabase' | 'mock' | 'custom' (기본값: 'supabase')
 * 
 * @returns 데이터베이스 제공자 타입
 */
export function getDatabaseProviderFromEnv(): DatabaseProviderType {
  const provider = process.env.DATABASE_PROVIDER || process.env.NEXT_PUBLIC_DATABASE_PROVIDER;
  
  if (provider === 'mock' || provider === 'custom' || provider === 'supabase' || provider === 'sqlite') {
    return provider;
  }
  
  return 'supabase';
}

/**
 * 환경변수 기반으로 데이터베이스 제공자 생성
 * 
 * @param supabase - Supabase 클라이언트
 * @returns 데이터베이스 제공자
 * 
 * @example
 * ```typescript
 * // .env.local
 * DATABASE_PROVIDER=supabase
 * 
 * // app/layout.tsx 또는 middleware
 * import { createDatabaseProviderFromEnv } from '@/lib/database/provider';
 * 
 * const provider = createDatabaseProviderFromEnv(supabase);
 * ```
 */
export function createDatabaseProviderFromEnv(supabase: SupabaseClient): DatabaseProvider {
  const type = getDatabaseProviderFromEnv();
  return initializeDatabaseProvider({ type, supabase });
}

// ============================================================================
// React Hook (for Client Components)
// ============================================================================

import { useMemo } from 'react';

/**
 * React Hook: 데이터베이스 제공자 사용
 * 
 * @param supabase - Supabase 클라이언트
 * @returns 데이터베이스 제공자
 * 
 * @example
 * ```typescript
 * 'use client';
 * 
 * import { useDatabaseProvider } from '@/lib/database/provider';
 * import { useSupabase } from '@/lib/supabase/client';
 * 
 * function UserList() {
 *   const supabase = useSupabase();
 *   const provider = useDatabaseProvider(supabase);
 *   
 *   const [users, setUsers] = useState([]);
 *   
 *   useEffect(() => {
 *     provider.users.findMany().then(result => setUsers(result.data));
 *   }, [provider]);
 *   
 *   return ...;
 * }
 * ```
 */
export function useDatabaseProvider(supabase: SupabaseClient): DatabaseProvider {
  return useMemo(() => {
    return initializeDatabaseProvider({ type: 'supabase', supabase });
  }, [supabase]);
}
