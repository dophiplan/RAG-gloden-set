/**
 * Optimistic Locking Types
 * 
 * Provides type definitions for version-based concurrent edit detection.
 * Supports both timestamp-based and version-number-based approaches.
 */

/**
 * Lock check result
 */
export interface LockCheckResult {
  /** Whether the lock check passed (no conflict) */
  success: boolean;
  /** Current server version for conflict resolution */
  serverVersion?: number;
  serverTimestamp?: string;
  /** Human-readable conflict message */
  message?: string;
  /** Error code for programmatic handling */
  errorCode?: 'EDIT_CONFLICT' | 'RECORD_NOT_FOUND' | 'INVALID_VERSION';
  /** Details for debugging */
  details?: {
    clientVersion?: number;
    clientTimestamp?: string;
    serverTimestamp?: string;
    entityId: string;
    entityType: string;
  };
}

/**
 * Version information for an entity
 */
export interface VersionInfo {
  /** Entity ID */
  id: string;
  /** Entity type (e.g., 'translation', 'glossary') */
  entityType: string;
  /** Monotonically increasing version number */
  version: number;
  /** Last update timestamp */
  updatedAt: string;
  /** User who made the last update */
  updatedBy?: string;
}

/**
 * Options for optimistic lock check
 */
export interface LockCheckOptions {
  /** Entity ID */
  id: string;
  /** Entity type */
  entityType: string;
  /** Expected version (for version-based locking) */
  expectedVersion?: number;
  /** Expected timestamp (for timestamp-based locking) */
  expectedTimestamp?: string;
  /** Tolerance in milliseconds for timestamp comparison (default: 1000ms) */
  timestampToleranceMs?: number;
}

/**
 * Update operation with version check
 */
export interface VersionedUpdate<T> {
  /** Entity ID */
  id: string;
  /** Update data */
  data: Partial<T>;
  /** Expected version before update */
  expectedVersion?: number;
  /** Expected timestamp before update */
  expectedTimestamp?: string;
}

/**
 * Bulk version check request
 */
export interface BulkVersionCheckRequest {
  /** Entity type */
  entityType: string;
  /** Array of IDs with expected versions */
  items: Array<{
    id: string;
    expectedVersion?: number;
    expectedTimestamp?: string;
  }>;
}

/**
 * Bulk version check result
 */
export interface BulkVersionCheckResult {
  /** Overall success (true only if all passed) */
  success: boolean;
  /** Results for each item */
  items: Array<{
    id: string;
    success: boolean;
    serverVersion?: number;
    serverTimestamp?: string;
    errorCode?: string;
    message?: string;
  }>;
  /** IDs that failed the version check */
  conflictIds: string[];
}

/**
 * Conflict resolution strategy
 */
export type ConflictResolutionStrategy = 
  | 'reject'      // Reject the update (default)
  | 'merge'       // Attempt to merge changes
  | 'overwrite'   // Force overwrite (admin only)
  | 'notify';     // Notify user and let them decide

/**
 * Configuration for optimistic locking
 */
export interface OptimisticLockConfig {
  /** Default timestamp tolerance in milliseconds */
  defaultTimestampToleranceMs: number;
  /** Whether to use version numbers in addition to timestamps */
  useVersionNumbers: boolean;
  /** Whether to auto-increment version on update */
  autoIncrementVersion: boolean;
  /** Default conflict resolution strategy */
  defaultConflictStrategy: ConflictResolutionStrategy;
}

/**
 * Default optimistic locking configuration
 */
export const DEFAULT_LOCK_CONFIG: OptimisticLockConfig = {
  defaultTimestampToleranceMs: 1000,  // 1 second
  useVersionNumbers: true,
  autoIncrementVersion: true,
  defaultConflictStrategy: 'reject',
};

/**
 * Error thrown when optimistic lock check fails
 */
export class OptimisticLockError extends Error {
  public readonly code: string;
  public readonly serverVersion?: number;
  public readonly serverTimestamp?: string;
  public readonly entityId: string;
  public readonly entityType: string;

  constructor(
    message: string,
    code: string,
    entityId: string,
    entityType: string,
    serverVersion?: number,
    serverTimestamp?: string
  ) {
    super(message);
    this.name = 'OptimisticLockError';
    this.code = code;
    this.entityId = entityId;
    this.entityType = entityType;
    this.serverVersion = serverVersion;
    this.serverTimestamp = serverTimestamp;
  }
}
