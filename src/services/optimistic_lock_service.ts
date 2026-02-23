/**
 * Optimistic Locking Service
 * 
 * Provides centralized optimistic locking functionality for concurrent edit detection.
 * Supports both timestamp-based and version-number-based locking strategies.
 * 
 * Architecture:
 * - Service layer abstraction for lock checking
 * - Can be used by Repositories or API handlers
 * - Supports backward compatibility with existing timestamp-based locking
 * - Provides version number support for future enhancements
 * 
 * @example
 * ```typescript
 * // In Repository
 * async update(id: string, data: Partial<T>, expectedVersion?: number) {
 *   await this.lockService.checkVersion({
 *     id, entityType: 'translation', expectedVersion
 *   });
 *   return this.supabase.from('translations').update(data).eq('id', id);
 * }
 * ```
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  LockCheckResult,
  LockCheckOptions,
  VersionInfo,
  BulkVersionCheckRequest,
  BulkVersionCheckResult,
  OptimisticLockConfig,
  DEFAULT_LOCK_CONFIG,
  OptimisticLockError,
  ConflictResolutionStrategy,
} from '@/types/optimistic_lock';

/**
 * Service for managing optimistic locking
 */
export class OptimisticLockService {
  private config: OptimisticLockConfig;

  constructor(
    private supabase: SupabaseClient,
    config: Partial<OptimisticLockConfig> = {}
  ) {
    this.config = { ...DEFAULT_LOCK_CONFIG, ...config };
  }

  /**
   * Check if an entity can be updated without conflicts
   * 
   * Supports both version-based and timestamp-based checks.
   * At least one of expectedVersion or expectedTimestamp must be provided.
   * 
   * @param options Lock check options
   * @returns Lock check result
   * @throws OptimisticLockError if version check fails
   */
  async checkVersion(options: LockCheckOptions): Promise<LockCheckResult> {
    const { id, entityType, expectedVersion, expectedTimestamp } = options;

    // If no version info provided, skip check (backward compatibility)
    if (expectedVersion === undefined && !expectedTimestamp) {
      return { success: true };
    }

    // Fetch current version info from database
    const currentVersion = await this.fetchCurrentVersion(id, entityType);

    if (!currentVersion) {
      return {
        success: false,
        errorCode: 'RECORD_NOT_FOUND',
        message: `${entityType} with id ${id} not found`,
        details: { entityId: id, entityType },
      };
    }

    // Version-based check (preferred)
    if (expectedVersion !== undefined && this.config.useVersionNumbers) {
      return this.checkVersionNumber(
        expectedVersion,
        currentVersion.version,
        id,
        entityType,
        currentVersion
      );
    }

    // Timestamp-based check (backward compatibility)
    if (expectedTimestamp) {
      return this.checkTimestamp(
        expectedTimestamp,
        currentVersion.updatedAt,
        options.timestampToleranceMs ?? this.config.defaultTimestampToleranceMs,
        id,
        entityType,
        currentVersion
      );
    }

    return { success: true };
  }

  /**
   * Check versions for multiple entities (bulk operation)
   * 
   * @param request Bulk version check request
   * @returns Results for each item
   */
  async checkVersionsBulk(
    request: BulkVersionCheckRequest
  ): Promise<BulkVersionCheckResult> {
    const { entityType, items } = request;

    if ((items || []).length === 0) {
      return { success: true, items: [], conflictIds: [] };
    }

    // Fetch current versions for all items
    const ids = (items || []).map(item => item.id);
    const currentVersions = await this.fetchCurrentVersions(ids, entityType);

    const results = (items || []).map(item => {
      const currentVersion = currentVersions.get(item.id);

      if (!currentVersion) {
        return {
          id: item.id,
          success: false,
          errorCode: 'RECORD_NOT_FOUND',
          message: `${entityType} with id ${item.id} not found`,
        };
      }

      // Version-based check
      if (item.expectedVersion !== undefined && this.config.useVersionNumbers) {
        if (item.expectedVersion !== currentVersion.version) {
          return {
            id: item.id,
            success: false,
            serverVersion: currentVersion.version,
            serverTimestamp: currentVersion.updatedAt,
            errorCode: 'EDIT_CONFLICT',
            message: `Version conflict: expected ${item.expectedVersion}, found ${currentVersion.version}`,
          };
        }
      }

      // Timestamp-based check
      if (item.expectedTimestamp) {
        const tolerance = this.config.defaultTimestampToleranceMs;
        const clie[기밀마스킹]ime = new Date(item.expectedTimestamp).getTime();
        const serverTime = new Date(currentVersion.updatedAt).getTime();

        if (Math.abs(serverTime - clie[기밀마스킹]ime) > tolerance) {
          return {
            id: item.id,
            success: false,
            serverVersion: currentVersion.version,
            serverTimestamp: currentVersion.updatedAt,
            errorCode: 'EDIT_CONFLICT',
            message: `Timestamp conflict: server has newer version`,
          };
        }
      }

      return {
        id: item.id,
        success: true,
        serverVersion: currentVersion.version,
        serverTimestamp: currentVersion.updatedAt,
      };
    });

    const conflictIds = results
      .filter(r => !r.success)
      .map(r => r.id);

    return {
      success: conflictIds.length === 0,
      items: results,
      conflictIds,
    };
  }

  /**
   * Get current version info for an entity
   * 
   * @param id Entity ID
   * @param entityType Entity type (determines table)
   * @returns Version info or null if not found
   */
  async getCurrentVersion(id: string, entityType: string): Promise<VersionInfo | null> {
    return this.fetchCurrentVersion(id, entityType);
  }

  /**
   * Increment version number for an update operation
   * 
   * @param currentVersion Current version number
   * @returns Next version number
   */
  getNextVersion(currentVersion: number): number {
    return currentVersion + 1;
  }

  /**
   * Create version check data for update payload
   * 
   * Automatically increments version if auto-increment is enabled.
   * 
   * @param currentVersion Current version number
   * @returns Update data with new version
   */
  createVersionUpdate(currentVersion: number): { version: number; updated_at: string } {
    return {
      version: this.config.autoIncrementVersion ? this.getNextVersion(currentVersion) : currentVersion,
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Check if error is an optimistic lock conflict
   * 
   * @param error Error to check
   * @returns true if it's a lock conflict
   */
  isLockConflict(error: unknown): boolean {
    return error instanceof OptimisticLockError ||
      (error instanceof Error && 
       (error.message.includes('EDIT_CONFLICT') || 
        error.message.includes('version conflict') ||
        error.message.includes('timestamp conflict')));
  }

  /**
   * Format conflict error for API response
   * 
   * @param result Lock check result with conflict
   * @returns Formatted error object for API response
   */
  formatConflictError(result: LockCheckResult): {
    code: string;
    message: string;
    details: Record<string, unknown>;
  } {
    return {
      code: result.errorCode || 'EDIT_CONFLICT',
      message: result.message || '다른 사용자가 이 항목을 수정했습니다. 페이지를 새로고침하여 최신 내용을 확인하세요.',
      details: {
        serverVersion: result.serverVersion,
        serverTimestamp: result.serverTimestamp,
        ...(result.details || {}),
      },
    };
  }

  /**
   * Assert that version check passes, throw error otherwise
   * 
   * @param options Lock check options
   * @throws OptimisticLockError if check fails
   */
  async assertVersion(options: LockCheckOptions): Promise<void> {
    const result = await this.checkVersion(options);

    if (!result.success) {
      throw new OptimisticLockError(
        result.message || 'Version conflict detected',
        result.errorCode || 'EDIT_CONFLICT',
        options.id,
        options.entityType,
        result.serverVersion,
        result.serverTimestamp
      );
    }
  }

  /**
   * Get the table name for an entity type
   * 
   * @param entityType Entity type
   * @returns Table name
   */
  private getTableName(entityType: string): string {
    // Map entity types to table names
    const tableMap: Record<string, string> = {
      'translation': 'translations',
      'glossary': 'glossary_terms',
      'product': 'products',
      'user': 'users',
    };

    return tableMap[entityType] || `${entityType}s`;
  }

  /**
   * Fetch current version from database
   * 
   * @param id Entity ID
   * @param entityType Entity type
   * @returns Version info or null
   */
  private async fetchCurrentVersion(
    id: string,
    entityType: string
  ): Promise<VersionInfo | null> {
    const tableName = this.getTableName(entityType);

    const { data, error } = await this.supabase
      .from(tableName)
      .select('id, version, updated_at, updated_by')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch version: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return {
      id: data.id,
      entityType,
      version: data.version || 0,
      updatedAt: data.updated_at,
      updatedBy: data.updated_by,
    };
  }

  /**
   * Fetch current versions for multiple entities
   * 
   * @param ids Entity IDs
   * @param entityType Entity type
   * @returns Map of id to version info
   */
  private async fetchCurrentVersions(
    ids: string[],
    entityType: string
  ): Promise<Map<string, VersionInfo>> {
    if ((ids || []).length === 0) {
      return new Map();
    }

    const tableName = this.getTableName(entityType);

    const { data, error } = await this.supabase
      .from(tableName)
      .select('id, version, updated_at, updated_by')
      .in('id', ids);

    if (error) {
      throw new Error(`Failed to fetch versions: ${error.message}`);
    }

    const versionMap = new Map<string, VersionInfo>();

    for (const item of data || []) {
      versionMap.set(item.id, {
        id: item.id,
        entityType,
        version: item.version || 0,
        updatedAt: item.updated_at,
        updatedBy: item.updated_by,
      });
    }

    return versionMap;
  }

  /**
   * Check version numbers for conflict
   * 
   * @param expectedVersion Client's expected version
   * @param serverVersion Current server version
   * @param id Entity ID
   * @param entityType Entity type
   * @param currentVersion Full version info
   * @returns Lock check result
   */
  private checkVersionNumber(
    expectedVersion: number,
    serverVersion: number,
    id: string,
    entityType: string,
    currentVersion: VersionInfo
  ): LockCheckResult {
    if (expectedVersion !== serverVersion) {
      return {
        success: false,
        errorCode: 'EDIT_CONFLICT',
        serverVersion,
        serverTimestamp: currentVersion.updatedAt,
        message: `다른 사용자가 이 ${entityType}을(를) 수정했습니다. 페이지를 새로고침하여 최신 내용을 확인하세요.`,
        details: {
          clientVersion: expectedVersion,
          entityId: id,
          entityType,
        },
      };
    }

    return { success: true };
  }

  /**
   * Check timestamps for conflict
   * 
   * @param expectedTimestamp Client's expected timestamp
   * @param serverTimestamp Current server timestamp
   * @param toleranceMs Tolerance in milliseconds
   * @param id Entity ID
   * @param entityType Entity type
   * @param currentVersion Full version info
   * @returns Lock check result
   */
  private checkTimestamp(
    expectedTimestamp: string,
    serverTimestamp: string,
    toleranceMs: number,
    id: string,
    entityType: string,
    currentVersion: VersionInfo
  ): LockCheckResult {
    const clie[기밀마스킹]ime = new Date(expectedTimestamp).getTime();
    const serverTime = new Date(serverTimestamp).getTime();

    // Handle invalid timestamps
    if (isNaN(clie[기밀마스킹]ime)) {
      return {
        success: false,
        errorCode: 'INVALID_VERSION',
        message: 'Invalid timestamp provided',
        details: {
          clie[기밀마스킹]imestamp: expectedTimestamp,
          entityId: id,
          entityType,
        },
      };
    }

    if (Math.abs(serverTime - clie[기밀마스킹]ime) > toleranceMs) {
      return {
        success: false,
        errorCode: 'EDIT_CONFLICT',
        serverVersion: currentVersion.version,
        serverTimestamp,
        message: '다른 사용자가 이 항목을 수정했습니다. 페이지를 새로고침하여 최신 내용을 확인하세요.',
        details: {
          clie[기밀마스킹]imestamp: expectedTimestamp,
          serverTimestamp,
          entityId: id,
          entityType,
        },
      };
    }

    return { success: true };
  }
}

/**
 * Factory function to create OptimisticLockService
 * 
 * @param supabase Supabase client
 * @param config Optional configuration
 * @returns OptimisticLockService instance
 */
export function createOptimisticLockService(
  supabase: SupabaseClient,
  config?: Partial<OptimisticLockConfig>
): OptimisticLockService {
  return new OptimisticLockService(supabase, config);
}
