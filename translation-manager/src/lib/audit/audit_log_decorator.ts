/**
 * Audit Log Decorator
 * 
 * Provides automatic audit logging for repository and service methods.
 * Uses Higher-Order Function pattern for better TypeScript/Next.js compatibility.
 * 
 * Usage:
 * ```typescript
 * // Wrap a method with audit logging
 * const auditedUpdate = withAuditLog(
 *   this.update.bind(this),
 *   {
 *     action: 'update',
 *     entityType: 'translation',
 *     getEntityId: (result) => result.id,
 *   }
 * );
 * ```
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { AuditAction } from '@/types';

/**
 * Context for audit log creation
 */
export interface AuditContext {
  userId: string;
  userName?: string | null;
  userEmail: string;
  supabase: SupabaseClient;
}

/**
 * Configuration for audit log decorator
 */
export interface AuditLogConfig<T, R> {
  /** Audit action type */
  action: AuditAction;
  /** Entity type (e.g., 'translation', 'glossary') */
  entityType: string;
  /** Table name for audit log (if different from entityType) */
  tableName?: string;
  /** Extract entity ID from method arguments or result */
  getEntityId?: (args: T, result: R) => string | null;
  /** Extract field name for update operations */
  getFieldName?: (args: T) => string | null;
  /** Extract old value for update/delete operations */
  getOldValue?: (args: T) => string | null;
  /** Extract new value for create/update operations */
  getNewValue?: (args: T, result: R) => string | null;
  /** Custom message for audit log */
  getMessage?: (args: T, result: R) => string | null;
  /** Whether to skip audit log (conditional) */
  skipIf?: (args: T, result: R) => boolean;
  /** Custom metadata provider */
  getMetadata?: (args: T, result: R) => Record<string, unknown> | null;
}

/**
 * Result of audited operation
 */
export interface AuditedResult<R> {
  /** Original operation result */
  data: R;
  /** Whether audit log was created */
  auditLogged: boolean;
  /** Audit log error (if any) */
  auditError?: Error;
}

/**
 * Wrap a function with automatic audit logging
 * 
 * @param fn Original function to wrap
 * @param config Audit log configuration
 * @param context Audit context (user info, supabase client)
 * @returns Wrapped function with audit logging
 */
export function withAuditLog<T extends Record<string, unknown>, R>(
  fn: (args: T) => Promise<R>,
  config: AuditLogConfig<T, R>,
  contextProvider: () => Promise<AuditContext> | AuditContext
): (args: T) => Promise<AuditedResult<R>> {
  return async (args: T): Promise<AuditedResult<R>> => {
    // Execute original function
    let result: R;
    try {
      result = await fn(args);
    } catch (error) {
      // Don't create audit log on error - rethrow
      throw error;
    }

    // Check if we should skip audit log
    if (config.skipIf?.(args, result)) {
      return { data: result, auditLogged: false };
    }

    // Get audit context
    let context: AuditContext;
    try {
      context = await contextProvider();
    } catch (error) {
      console.error('[AuditLogDecorator] Failed to get audit context:', error);
      return { data: result, auditLogged: false };
    }

    // Create audit log (non-blocking)
    try {
      const created = await createAuditLog(args, result, config, context);
      return { data: result, auditLogged: created };
    } catch (error) {
      console.error('[AuditLogDecorator] Failed to create audit log:', error);
      return { data: result, auditLogged: false, auditError: error as Error };
    }
  };
}

/**
 * Create audit log entry
 * @returns true if audit log was created, false if skipped
 */
async function createAuditLog<T, R>(
  args: T,
  result: R,
  config: AuditLogConfig<T, R>,
  context: AuditContext
): Promise<boolean> {
  const entityId = config.getEntityId?.(args, result);
  if (!entityId) {
    console.warn('[AuditLogDecorator] No entity ID found, skipping audit log');
    return false;
  }

  const fieldName = config.getFieldName?.(args);
  const oldValue = config.getOldValue?.(args);
  const newValue = config.getNewValue?.(args, result);
  const message = config.getMessage?.(args, result);
  const metadata = config.getMetadata?.(args, result);

  const auditLog = {
    translation_id: config.entityType === 'translation' ? entityId : null,
    glossary_term_id: config.entityType === 'glossary' ? entityId : null,
    user_id: context.userId,
    user_name: context.userName || null,
    user_email: context.userEmail,
    action: config.action,
    field_name: fieldName || null,
    old_value: oldValue || null,
    new_value: newValue || (message ? `[${message}]` : null),
    metadata: metadata ? JSON.stringify(metadata) : null,
    created_at: new Date().toISOString(),
  };

  const tableName = config.tableName || getAuditLogTableName(config.entityType);

  const { error } = await context.supabase
    .from(tableName)
    .insert(auditLog);

  if (error) {
    throw new Error(`Failed to create audit log: ${error.message}`);
  }

  return true;
}

/**
 * Get audit log table name for entity type
 */
function getAuditLogTableName(entityType: string): string {
  const tableMap: Record<string, string> = {
    'translation': 'translation_audit_logs',
    'glossary': 'glossary_audit_logs', // May not exist yet
    'user': 'user_audit_logs',
  };

  return tableMap[entityType] || `${entityType}_audit_logs`;
}

/**
 * Pre-configured audit log wrapper for common operations
 */
export function createAuditedOperation<T extends Record<string, unknown>, R>(
  fn: (args: T) => Promise<R>,
  config: Omit<AuditLogConfig<T, R>, 'getEntityId'> & { entityIdPath: string },
  contextProvider: () => Promise<AuditContext> | AuditContext
): (args: T) => Promise<AuditedResult<R>> {
  const fullConfig: AuditLogConfig<T, R> = {
    ...config,
    getEntityId: (args: T, result: R) => {
      // Try to extract from result first, then from args
      const fromResult = getNestedValue(result, config.entityIdPath);
      if (fromResult) return String(fromResult);

      const fromArgs = getNestedValue(args, config.entityIdPath);
      if (fromArgs) return String(fromArgs);

      return null;
    },
  };

  return withAuditLog(fn, fullConfig, contextProvider);
}

/**
 * Helper to get nested object value by path
 */
function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return null;

  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) return null;
    if (typeof current !== 'object') return null;
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

/**
 * Builder for creating audit log configurations
 */
export class AuditLogConfigBuilder<T, R> {
  private config: Partial<AuditLogConfig<T, R>> = {};

  static create<T, R>(): AuditLogConfigBuilder<T, R> {
    return new AuditLogConfigBuilder<T, R>();
  }

  withAction(action: AuditAction): this {
    this.config.action = action;
    return this;
  }

  withEntityType(entityType: string): this {
    this.config.entityType = entityType;
    return this;
  }

  withTableName(tableName: string): this {
    this.config.tableName = tableName;
    return this;
  }

  withEntityIdExtractor(extractor: (args: T, result: R) => string | null): this {
    this.config.getEntityId = extractor;
    return this;
  }

  withFieldName(fieldName: string | ((args: T) => string | null)): this {
    this.config.getFieldName = typeof fieldName === 'function' 
      ? fieldName 
      : () => fieldName;
    return this;
  }

  withOldValueExtractor(extractor: (args: T) => string | null): this {
    this.config.getOldValue = extractor;
    return this;
  }

  withNewValueExtractor(extractor: (args: T, result: R) => string | null): this {
    this.config.getNewValue = extractor;
    return this;
  }

  withSkipCondition(condition: (args: T, result: R) => boolean): this {
    this.config.skipIf = condition;
    return this;
  }

  build(): AuditLogConfig<T, R> {
    if (!this.config.action) {
      throw new Error('Audit action is required');
    }
    if (!this.config.entityType) {
      throw new Error('Entity type is required');
    }
    return this.config as AuditLogConfig<T, R>;
  }
}

/**
 * Utility to create audit context from request
 */
export async function createAuditContextFromRequest(
  supabase: SupabaseClient
): Promise<AuditContext> {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Authentication required for audit logging');
  }

  // Get user profile for name
  const { data: profile } = await supabase
    .from('users')
    .select('name')
    .eq('id', user.id)
    .single();

  return {
    userId: user.id,
    userName: profile?.name || null,
    userEmail: user.email || 'unknown',
    supabase,
  };
}
