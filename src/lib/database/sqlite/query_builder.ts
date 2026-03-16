/**
 * SQLite Query Builder
 * 
 * PostgreSQL/Supabase 스타일의 쿼리를 SQLite로 변환하여 제공합니다.
 * - ARRAY(JSON) 처리 유틸리티
 * - ilike → LIKE+LOWER 변환
 * - Prepared statement 기반 (SQL 인젝션 방지)
 * 
 * @example
 * ```typescript
 * import { createQueryBuilder } from '@/lib/database/sqlite/query_builder';
 * import { createSqliteClient } from '@/lib/database/sqlite';
 * 
 * const db = createSqliteClient();
 * 
 * // 기본 쿼리
 * const users = db.query<User>('users')
 *   .select('*')
 *   .where('active', '=', true)
 *   .orderBy('created_at', 'desc')
 *   .limit(10)
 *   .execute();
 * 
 * // 복잡한 조건
 * const results = db.query('translations')
 *   .select('*')
 *   .where('status', '=', 'completed')
 *   .andWhere('language', 'in', ['ko', 'ja'])
 *   .andWhere('content', 'ilike', '%search%')
 *   .execute();
 * 
 * // 업데이트
 * db.query('users')
 *   .update({ name: '새 이름', updated_at: new Date() })
 *   .where('id', '=', userId)
 *   .execute();
 * 
 * // 삭제
 * db.query('users')
 *   .delete()
 *   .where('id', '=', userId)
 *   .execute();
 * ```
 */

import type { SqliteDatabase, SqliteRunResult } from '../sqlite';

// ============================================================================
// Types
// ============================================================================

/**
 * 조건 연산자
 */
export type Operator = 
  | '=' | '!=' | '<>' 
  | '<' | '>' | '<=' | '>=' 
  | 'like' | 'ilike' | 'not like' | 'not ilike'
  | 'in' | 'not in' 
  | 'is' | 'is not' 
  | 'between' | 'not between'
  | 'match'; // FTS (Full Text Search)

/**
 * 정렬 방향
 */
export type OrderDirection = 'asc' | 'desc';

/**
 * NULL 정렬 옵션
 */
export type NullsOption = 'first' | 'last';

/**
 * WHERE 조건
 */
export interface WhereClause {
  /** 컬럼명 */
  column: string;
  /** 연산자 */
  operator: Operator;
  /** 값 */
  value: unknown;
  /** 조건 연결 방식 ('AND' | 'OR') */
  boolean?: 'AND' | 'OR';
}

/**
 * ORDER BY 조건
 */
export interface OrderByClause {
  /** 컬럼명 */
  column: string;
  /** 정렬 방향 */
  direction: OrderDirection;
  /** NULL 정렬 옵션 */
  nulls?: NullsOption;
}

/**
 * 조인 타입
 */
export type JoinType = 'inner' | 'left' | 'right' | 'full';

/**
 * 조인 조건
 */
export interface JoinClause {
  /** 조인 타입 */
  type: JoinType;
  /** 조인할 테이블 */
  table: string;
  /** 첫 번째 컬럼 */
  first: string;
  /** 연산자 */
  operator: Operator;
  /** 두 번째 컬럼 */
  second: string;
}

/**
 * 집계 함수
 */
export interface AggregateClause {
  /** 함수명 */
  function: 'count' | 'sum' | 'avg' | 'min' | 'max';
  /** 컬럼명 */
  column: string;
  /** 별칭 */
  alias?: string;
}

/**
 * 쿼리 결과
 */
export interface QueryResult<T> {
  /** 조회된 데이터 */
  data: T[];
  /** 총 개수 (count 쿼리 시) */
  count?: number;
}

// ============================================================================
// Query Builder Implementation
// ============================================================================

export class QueryBuilder<T = any> {
  private db: SqliteDatabase;
  private tableName: string;
  private selectColumns: string[] = ['*'];
  private whereClauses: WhereClause[] = [];
  private joinClauses: JoinClause[] = [];
  private orderByClauses: OrderByClause[] = [];
  private groupByColumns: string[] = [];
  private havingClauses: WhereClause[] = [];
  private limitValue?: number;
  private offsetValue?: number;
  private aggregateClauses: AggregateClause[] = [];
  private isDistinct = false;
  
  // DML 관련
  private queryType: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private insertData: Partial<T> | Partial<T>[] = [];
  private updateData: Partial<T> = {};
  private conflictColumns: string[] = [];

  constructor(db: SqliteDatabase, tableName: string) {
    this.db = db;
    this.tableName = tableName;
  }

  // ============================================================================
  // SELECT
  // ============================================================================

  /**
   * 조회할 컬럼을 지정합니다.
   * @param columns - 컬럼명 또는 별칭이 있는 객체
   */
  select(columns: string | string[] | Record<string, string>): this {
    this.queryType = 'select';
    
    if (typeof columns === 'string') {
      this.selectColumns = columns === '*' ? ['*'] : [columns];
    } else if (Array.isArray(columns)) {
      this.selectColumns = columns;
    } else {
      // { alias: column } 형태
      this.selectColumns = Object.entries(columns).map(
        ([alias, col]) => `${col} as ${alias}`
      );
    }
    
    return this;
  }

  /**
   * DISTINCT를 적용합니다.
   */
  distinct(): this {
    this.isDistinct = true;
    return this;
  }

  /**
   * 집계 함수를 추가합니다.
   */
  count(column: string = '*', alias?: string): this {
    this.aggregateClauses.push({ function: 'count', column, alias });
    return this;
  }

  sum(column: string, alias?: string): this {
    this.aggregateClauses.push({ function: 'sum', column, alias });
    return this;
  }

  avg(column: string, alias?: string): this {
    this.aggregateClauses.push({ function: 'avg', column, alias });
    return this;
  }

  min(column: string, alias?: string): this {
    this.aggregateClauses.push({ function: 'min', column, alias });
    return this;
  }

  max(column: string, alias?: string): this {
    this.aggregateClauses.push({ function: 'max', column, alias });
    return this;
  }

  // ============================================================================
  // WHERE
  // ============================================================================

  /**
   * WHERE 조건을 추가합니다.
   */
  where(column: string, operator: Operator, value: unknown): this;
  where(conditions: Record<string, unknown>): this;
  where(
    column: string | Record<string, unknown>,
    operator?: Operator,
    value?: unknown
  ): this {
    if (typeof column === 'object') {
      for (const [key, val] of Object.entries(column)) {
        this.whereClauses.push({
          column: key,
          operator: '=',
          value: val,
          boolean: 'AND',
        });
      }
    } else if (operator !== undefined && value !== undefined) {
      this.whereClauses.push({
        column,
        operator,
        value,
        boolean: 'AND',
      });
    }
    return this;
  }

  /**
   * OR WHERE 조건을 추가합니다.
   */
  orWhere(column: string, operator: Operator, value: unknown): this {
    this.whereClauses.push({
      column,
      operator,
      value,
      boolean: 'OR',
    });
    return this;
  }

  /**
   * AND WHERE 조건을 추가합니다 (where와 동일).
   */
  andWhere(column: string, operator: Operator, value: unknown): this {
    return this.where(column, operator, value);
  }

  /**
   * WHERE IN 조건을 추가합니다.
   */
  whereIn(column: string, values: unknown[]): this {
    return this.where(column, 'in', values);
  }

  /**
   * WHERE NOT IN 조건을 추가합니다.
   */
  whereNotIn(column: string, values: unknown[]): this {
    return this.where(column, 'not in', values);
  }

  /**
   * WHERE NULL 조건을 추가합니다.
   */
  whereNull(column: string): this {
    return this.where(column, 'is', null);
  }

  /**
   * WHERE NOT NULL 조건을 추가합니다.
   */
  whereNotNull(column: string): this {
    return this.where(column, 'is not', null);
  }

  /**
   * WHERE BETWEEN 조건을 추가합니다.
   */
  whereBetween(column: string, min: unknown, max: unknown): this {
    return this.where(column, 'between', [min, max]);
  }

  /**
   * 대소문자 구분 없는 LIKE 검색을 추가합니다.
   * SQLite에서는 LIKE + LOWER()로 변환됩니다.
   */
  whereILike(column: string, pattern: string): this {
    return this.where(column, 'ilike', pattern);
  }

  // ============================================================================
  // JOIN
  // ============================================================================

  /**
   * INNER JOIN을 추가합니다.
   */
  join(table: string, first: string, operator: Operator, second: string): this {
    this.joinClauses.push({ type: 'inner', table, first, operator, second });
    return this;
  }

  /**
   * LEFT JOIN을 추가합니다.
   */
  leftJoin(table: string, first: string, operator: Operator, second: string): this {
    this.joinClauses.push({ type: 'left', table, first, operator, second });
    return this;
  }

  /**
   * RIGHT JOIN을 추가합니다.
   * (SQLite는 RIGHT JOIN을 직접 지원하지 않음, LEFT JOIN으로 변환)
   */
  rightJoin(table: string, first: string, operator: Operator, second: string): this {
    this.joinClauses.push({ type: 'right', table, first, operator, second });
    return this;
  }

  // ============================================================================
  // ORDER BY / GROUP BY / HAVING
  // ============================================================================

  /**
   * ORDER BY를 추가합니다.
   */
  orderBy(column: string, direction: OrderDirection = 'asc', nulls?: NullsOption): this {
    this.orderByClauses.push({ column, direction, nulls });
    return this;
  }

  /**
   * GROUP BY를 추가합니다.
   */
  groupBy(...columns: string[]): this {
    this.groupByColumns.push(...columns);
    return this;
  }

  /**
   * HAVING 조건을 추가합니다.
   */
  having(column: string, operator: Operator, value: unknown): this {
    this.havingClauses.push({
      column,
      operator,
      value,
      boolean: 'AND',
    });
    return this;
  }

  // ============================================================================
  // LIMIT / OFFSET
  // ============================================================================

  /**
   * LIMIT을 설정합니다.
   */
  limit(count: number): this {
    this.limitValue = count;
    return this;
  }

  /**
   * OFFSET을 설정합니다.
   */
  offset(count: number): this {
    this.offsetValue = count;
    return this;
  }

  /**
   * 페이지네이션을 설정합니다.
   */
  paginate(page: number, perPage: number): this {
    this.limitValue = perPage;
    this.offsetValue = (page - 1) * perPage;
    return this;
  }

  // ============================================================================
  // INSERT
  // ============================================================================

  /**
   * INSERT 쿼리를 생성합니다.
   */
  insert(data: Partial<T> | Partial<T>[]): this {
    this.queryType = 'insert';
    this.insertData = data;
    return this;
  }

  /**
   * UPSERT (INSERT OR REPLACE) 쿼리를 생성합니다.
   */
  upsert(data: Partial<T> | Partial<T>[], conflictColumns?: string[]): this {
    this.queryType = 'upsert';
    this.insertData = data;
    if (conflictColumns) {
      this.conflictColumns = conflictColumns;
    }
    return this;
  }

  // ============================================================================
  // UPDATE
  // ============================================================================

  /**
   * UPDATE 쿼리를 생성합니다.
   */
  update(data: Partial<T>): this {
    this.queryType = 'update';
    this.updateData = data;
    return this;
  }

  // ============================================================================
  // DELETE
  // ============================================================================

  /**
   * DELETE 쿼리를 생성합니다.
   */
  delete(): this {
    this.queryType = 'delete';
    return this;
  }

  // ============================================================================
  // Query Building
  // ============================================================================

  /**
   * SQL 쿼리와 파라미터를 생성합니다.
   */
  toSql(): { sql: string; params: unknown[] } {
    switch (this.queryType) {
      case 'select':
        return this.buildSelectQuery();
      case 'insert':
        return this.buildInsertQuery();
      case 'upsert':
        return this.buildUpsertQuery();
      case 'update':
        return this.buildUpdateQuery();
      case 'delete':
        return this.buildDeleteQuery();
      default:
        throw new Error('Unknown query type');
    }
  }

  private buildSelectQuery(): { sql: string; params: unknown[] } {
    const params: unknown[] = [];
    
    // SELECT
    let columns: string;
    if (this.aggregateClauses.length > 0) {
      columns = this.aggregateClauses
        .map(agg => {
          const func = `${agg.function.toUpperCase()}(${agg.column})`;
          return agg.alias ? `${func} as ${agg.alias}` : func;
        })
        .join(', ');
    } else {
      columns = this.selectColumns.join(', ');
    }
    
    const distinct = this.isDistinct ? 'DISTINCT ' : '';
    let sql = `SELECT ${distinct}${columns} FROM ${this.tableName}`;

    // JOIN
    for (const join of this.joinClauses) {
      const joinType = join.type.toUpperCase();
      // SQLite는 RIGHT JOIN을 직접 지원하지 않음
      if (join.type === 'right') {
        // LEFT JOIN으로 변환 (테이블 순서 변경 필요하지만 여기서는 단순화)
        sql += ` LEFT JOIN ${join.table} ON ${join.first} ${join.operator} ${join.second}`;
      } else {
        sql += ` ${joinType} JOIN ${join.table} ON ${join.first} ${join.operator} ${join.second}`;
      }
    }

    // WHERE
    const whereResult = this.buildWhereClause();
    if (whereResult.sql) {
      sql += ` WHERE ${whereResult.sql}`;
      params.push(...whereResult.params);
    }

    // GROUP BY
    if (this.groupByColumns.length > 0) {
      sql += ` GROUP BY ${this.groupByColumns.join(', ')}`;
    }

    // HAVING
    const havingResult = this.buildHavingClause();
    if (havingResult.sql) {
      sql += ` HAVING ${havingResult.sql}`;
      params.push(...havingResult.params);
    }

    // ORDER BY
    if (this.orderByClauses.length > 0) {
      const orderBys = this.orderByClauses.map(order => {
        let clause = `${order.column} ${order.direction.toUpperCase()}`;
        // SQLite 3.30+는 NULLS FIRST/LAST 지원
        if (order.nulls) {
          clause += ` NULLS ${order.nulls.toUpperCase()}`;
        }
        return clause;
      });
      sql += ` ORDER BY ${orderBys.join(', ')}`;
    }

    // LIMIT / OFFSET
    if (this.limitValue !== undefined) {
      sql += ` LIMIT ${this.limitValue}`;
    }
    if (this.offsetValue !== undefined) {
      sql += ` OFFSET ${this.offsetValue}`;
    }

    return { sql, params };
  }

  private buildInsertQuery(): { sql: string; params: unknown[] } {
    const dataArray = Array.isArray(this.insertData) 
      ? this.insertData 
      : [this.insertData];

    if (dataArray.length === 0) {
      throw new Error('Insert data cannot be empty');
    }

    const keys = Object.keys(dataArray[0]);
    const placeholders = keys.map(() => '?').join(', ');
    const sql = `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders})`;
    
    // 단일 행 삽입
    if (dataArray.length === 1) {
      return { sql, params: Object.values(dataArray[0]) };
    }

    // 다중 행 삽입 (SQLite 3.7.11+ 지원)
    const rowPlaceholders = dataArray.map(() => `(${placeholders})`).join(', ');
    const multiSql = `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES ${rowPlaceholders}`;
    const params = dataArray.flatMap(row => 
      keys.map(key => (row as any)[key])
    );
    
    return { sql: multiSql, params };
  }

  private buildUpsertQuery(): { sql: string; params: unknown[] } {
    const { sql, params } = this.buildInsertQuery();
    
    if (this.conflictColumns.length === 0) {
      // UPSERT without conflict columns -> REPLACE INTO
      const replaceSql = sql.replace('INSERT', 'INSERT OR REPLACE');
      return { sql: replaceSql, params };
    }

    // UPSERT with conflict columns -> ON CONFLICT
    const updateKeys = Object.keys(
      Array.isArray(this.insertData) ? this.insertData[0] : this.insertData
    ).filter(key => !this.conflictColumns.includes(key));
    
    const updates = updateKeys.map(key => `${key} = excluded.${key}`).join(', ');
    const upsertSql = `${sql} ON CONFLICT (${this.conflictColumns.join(', ')}) DO UPDATE SET ${updates}`;
    
    return { sql: upsertSql, params };
  }

  private buildUpdateQuery(): { sql: string; params: unknown[] } {
    const keys = Object.keys(this.updateData);
    const setClause = keys.map(key => `${key} = ?`).join(', ');
    
    let sql = `UPDATE ${this.tableName} SET ${setClause}`;
    const params = Object.values(this.updateData);

    const whereResult = this.buildWhereClause();
    if (whereResult.sql) {
      sql += ` WHERE ${whereResult.sql}`;
      params.push(...whereResult.params);
    }

    return { sql, params };
  }

  private buildDeleteQuery(): { sql: string; params: unknown[] } {
    let sql = `DELETE FROM ${this.tableName}`;
    const params: unknown[] = [];

    const whereResult = this.buildWhereClause();
    if (whereResult.sql) {
      sql += ` WHERE ${whereResult.sql}`;
      params.push(...whereResult.params);
    }

    return { sql, params };
  }

  private buildWhereClause(): { sql: string; params: unknown[] } {
    if (this.whereClauses.length === 0) {
      return { sql: '', params: [] };
    }

    const params: unknown[] = [];
    const conditions: string[] = [];

    for (let i = 0; i < this.whereClauses.length; i++) {
      const clause = this.whereClauses[i];
      const boolean = i === 0 ? '' : `${clause.boolean || 'AND'} `;
      const condition = this.buildCondition(clause, params);
      conditions.push(`${boolean}${condition}`);
    }

    return { sql: conditions.join(' '), params };
  }

  private buildHavingClause(): { sql: string; params: unknown[] } {
    if (this.havingClauses.length === 0) {
      return { sql: '', params: [] };
    }

    const params: unknown[] = [];
    const conditions: string[] = [];

    for (let i = 0; i < this.havingClauses.length; i++) {
      const clause = this.havingClauses[i];
      const boolean = i === 0 ? '' : `${clause.boolean || 'AND'} `;
      const condition = this.buildCondition(clause, params);
      conditions.push(`${boolean}${condition}`);
    }

    return { sql: conditions.join(' '), params };
  }

  private buildCondition(clause: WhereClause, params: unknown[]): string {
    const { column, operator, value } = clause;

    // ilike → LIKE + LOWER 변환
    if (operator === 'ilike' || operator === 'not ilike') {
      const not = operator === 'not ilike' ? 'NOT ' : '';
      params.push((value as string).toLowerCase());
      return `LOWER(${column}) ${not}LIKE ?`;
    }

    // IN / NOT IN
    if (operator === 'in' || operator === 'not in') {
      const not = operator === 'not in' ? 'NOT ' : '';
      const values = Array.isArray(value) ? value : [value];
      const placeholders = values.map(() => '?').join(', ');
      params.push(...values);
      return `${column} ${not}IN (${placeholders})`;
    }

    // BETWEEN
    if (operator === 'between' || operator === 'not between') {
      const not = operator === 'not between' ? 'NOT ' : '';
      const [min, max] = value as [unknown, unknown];
      params.push(min, max);
      return `${column} ${not}BETWEEN ? AND ?`;
    }

    // IS NULL / IS NOT NULL
    if (operator === 'is' || operator === 'is not') {
      if (value === null) {
        return `${column} ${operator.toUpperCase()} NULL`;
      }
      params.push(value);
      return `${column} ${operator.toUpperCase()} ?`;
    }

    // 일반 연산자
    params.push(value);
    return `${column} ${operator} ?`;
  }

  // ============================================================================
  // Execution
  // ============================================================================

  /**
   * 쿼리를 실행하고 결과를 반환합니다.
   */
  execute(): T[] {
    const { sql, params } = this.toSql();
    
    if (this.queryType === 'select') {
      return this.db.all<T>(sql, params);
    } else if (this.queryType === 'insert' || this.queryType === 'upsert') {
      const result = this.db.run(sql, params);
      // 삽입 결과를 반환 (ID 포함)
      return [{ 
        ...this.insertData, 
        id: result.lastInsertRowid 
      } as T];
    } else if (this.queryType === 'update') {
      this.db.run(sql, params);
      // 업데이트된 행을 반환하기 위해 다시 조회
      if (this.whereClauses.length > 0) {
        return this.db.all<T>(
          `SELECT * FROM ${this.tableName} WHERE ${this.buildWhereClause().sql}`,
          params.slice(Object.keys(this.updateData).length)
        );
      }
      return [];
    } else if (this.queryType === 'delete') {
      this.db.run(sql, params);
      return [];
    }
    
    throw new Error('Unknown query type');
  }

  /**
   * 단일 결과를 반환합니다.
   */
  first(): T | undefined {
    this.limitValue = 1;
    const { sql, params } = this.toSql();
    return this.db.get<T>(sql, params);
  }

  /**
   * 결과 존재 여부를 반환합니다.
   */
  exists(): boolean {
    return this.first() !== undefined;
  }

  /**
   * 총 개수를 반환합니다.
   * @note 이 메서드는 쿼리를 실행하여 개수를 반환합니다.
   */
  getCount(): number {
    this.queryType = 'select';
    this.selectColumns = [];
    this.aggregateClauses = [{ function: 'count', column: '*' }];
    const result = this.first() as { 'count(*)': number } | undefined;
    return result?.['count(*)'] || 0;
  }

  /**
   * 실행될 SQL을 문자열로 반환합니다 (디버깅용).
   */
  toString(): string {
    const { sql, params } = this.toSql();
    // 파라미터를 SQL에 치환하여 표시
    let displaySql = sql;
    for (const param of params) {
      if (typeof param === 'string') {
        displaySql = displaySql.replace('?', `'${param}'`);
      } else if (param === null) {
        displaySql = displaySql.replace('?', 'NULL');
      } else {
        displaySql = displaySql.replace('?', String(param));
      }
    }
    return displaySql;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * 새로운 QueryBuilder 인스턴스를 생성합니다.
 * 
 * @param db - SQLite 데이터베이스 인스턴스
 * @param tableName - 조회할 테이블 이름
 * @returns QueryBuilder 인스턴스
 * 
 * @example
 * ```typescript
 * import { createQueryBuilder } from '@/lib/database/sqlite/query_builder';
 * import { createSqliteClient } from '@/lib/database/sqlite';
 * 
 * const db = createSqliteClient();
 * const users = createQueryBuilder<User>(db, 'users')
 *   .where('active', '=', true)
 *   .orderBy('created_at', 'desc')
 *   .limit(10)
 *   .execute();
 * ```
 */
export function createQueryBuilder<T = any>(
  db: SqliteDatabase, 
  tableName: string
): QueryBuilder<T> {
  return new QueryBuilder<T>(db, tableName);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * JSON 배열을 문자열로 변환합니다 (저장 시).
 */
export function arrayToJson<T>(arr: T[]): string {
  return JSON.stringify(arr);
}

/**
 * JSON 문자열을 배열로 변환합니다 (조회 시).
 */
export function jsonToArray<T>(json: string | null): T[] {
  if (!json) return [];
  try {
    return JSON.parse(json) as T[];
  } catch {
    return [];
  }
}

/**
 * PostgreSQL의 ilike 패턴을 SQLite의 LIKE + LOWER로 변환합니다.
 */
export function convertIlike(column: string, pattern: string): { sql: string; value: string } {
  return {
    sql: `LOWER(${column}) LIKE ?`,
    value: pattern.toLowerCase(),
  };
}

/**
 * Supabase 스타일의 쿼리를 SQLite 쿼리로 변환합니다.
 */
export function convertSupabaseQuery(
  table: string,
  filters?: { column: string; operator: string; value: unknown }[],
  options?: {
    orderBy?: { column: string; ascending?: boolean };
    limit?: number;
    offset?: number;
  }
): { sql: string; params: unknown[] } {
  let sql = `SELECT * FROM ${table}`;
  const params: unknown[] = [];

  if (filters && filters.length > 0) {
    const conditions = filters.map(filter => {
      if (filter.operator === 'ilike') {
        params.push((filter.value as string).toLowerCase());
        return `LOWER(${filter.column}) LIKE ?`;
      }
      if (filter.operator === 'in') {
        const values = Array.isArray(filter.value) ? filter.value : [filter.value];
        params.push(...values);
        return `${filter.column} IN (${values.map(() => '?').join(', ')})`;
      }
      params.push(filter.value);
      return `${filter.column} ${filter.operator} ?`;
    });
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }

  if (options?.orderBy) {
    const direction = options.orderBy.ascending !== false ? 'ASC' : 'DESC';
    sql += ` ORDER BY ${options.orderBy.column} ${direction}`;
  }

  if (options?.limit) {
    sql += ` LIMIT ${options.limit}`;
  }

  if (options?.offset) {
    sql += ` OFFSET ${options.offset}`;
  }

  return { sql, params };
}
