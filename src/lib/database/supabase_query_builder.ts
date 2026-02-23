import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Type-safe Supabase Query Builder
 * 
 * Provides a fluent interface for building Supabase queries
 * with proper TypeScript type safety.
 * 
 * @example
 * const query = new SupabaseQueryBuilder<TranslationAuditLog>(supabase)
 *   .from('translation_audit_logs')
 *   .select('*')
 *   .in('translation_id', ['id1', 'id2'])
 *   .order('created_at', { ascending: false })
 *   .build();
 * 
 * const { data, error } = await query;
 */
export class SupabaseQueryBuilder<T = any> {
  private query: any | null = null;
  private tableName: string = '';

  constructor(private supabase: SupabaseClient) {}

  /**
   * Select table to query from
   */
  from(tableName: string): this {
    this.tableName = tableName;
    this.query = this.supabase.from(tableName);
    return this;
  }

  /**
   * Select columns to retrieve
   */
  select(columns: string = '*', options?: { count?: 'exact' | 'planned' | 'estimated' }): this {
    if (!this.query) {
      throw new Error('Must call from() before select()');
    }
    // Only pass options if defined to match original Supabase behavior
    if (options) {
      this.query = this.query.select(columns, options);
    } else {
      this.query = this.query.select(columns);
    }
    return this;
  }

  /**
   * Filter by column equals value
   */
  eq(column: keyof T, value: any): this {
    if (!this.query) {
      throw new Error('Must call from() and select() before eq()');
    }
    this.query = this.query.eq(column as string, value);
    return this;
  }

  /**
   * Filter by column in array of values
   */
  in(column: keyof T, values: any[]): this {
    if (!this.query) {
      throw new Error('Must call from() and select() before in()');
    }
    this.query = this.query.in(column as string, values);
    return this;
  }

  /**
   * Order results by column
   */
  order(column: keyof T, options?: { ascending?: boolean; nullsFirst?: boolean }): this {
    if (!this.query) {
      throw new Error('Must call from() and select() before order()');
    }
    this.query = this.query.order(column as string, options);
    return this;
  }

  /**
   * Limit results to a range
   */
  range(from: number, to: number): this {
    if (!this.query) {
      throw new Error('Must call from() and select() before range()');
    }
    this.query = this.query.range(from, to);
    return this;
  }

  /**
   * Filter by ILIKE (case-insensitive pattern matching)
   */
  ilike(column: keyof T, pattern: string): this {
    if (!this.query) {
      throw new Error('Must call from() and select() before ilike()');
    }
    this.query = this.query.ilike(column as string, pattern);
    return this;
  }

  /**
   * OR condition between filters
   */
  or(filters: string): this {
    if (!this.query) {
      throw new Error('Must call from() and select() before or()');
    }
    this.query = this.query.or(filters);
    return this;
  }

  /**
   * Build and return the final query
   */
  build(): any {
    if (!this.query) {
      throw new Error('Query not built. Call from() and select() first.');
    }
    return this.query;
  }

  /**
   * Execute the query and return results
   */
  async execute(): Promise<{ data: T[] | null; error: any; count?: number | null }> {
    if (!this.query) {
      throw new Error('Query not built. Call from() and select() first.');
    }
    return this.query;
  }
}

/**
 * Helper function to create a new query builder instance
 */
export function createQuery<T = any>(supabase: SupabaseClient): SupabaseQueryBuilder<T> {
  return new SupabaseQueryBuilder<T>(supabase);
}
