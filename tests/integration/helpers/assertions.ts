/**
 * Custom Assertions for Integration Tests
 * 
 * 통합 테스트를 위한 커스텀 assertion 헬퍼
 * 데이터베이스 상태 검증 및 비즈니스 로직 검증에 사용
 */

import { expect } from 'vitest';
import type { SqliteDatabase } from '@/lib/database/sqlite';

// ============================================================================
// Database State Assertions
// ============================================================================

/**
 * 테이블에 특정 조건의 레코드가 존재하는지 확인
 */
export async function expectRecordExists(
  db: SqliteDatabase,
  tableName: string,
  conditions: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const whereClauses = Object.keys(conditions).map(key => `${key} = ?`);
  const values = Object.values(conditions);
  
  const record = db.get<Record<string, unknown>>(
    `SELECT * FROM ${tableName} WHERE ${whereClauses.join(' AND ')}`,
    values
  );
  
  expect(record, `Expected record to exist in ${tableName} with conditions ${JSON.stringify(conditions)}`).toBeTruthy();
  return record!;
}

/**
 * 테이블에 특정 조건의 레코드가 존재하지 않는지 확인
 */
export function expectRecordNotExists(
  db: SqliteDatabase,
  tableName: string,
  conditions: Record<string, unknown>
): void {
  const whereClauses = Object.keys(conditions).map(key => `${key} = ?`);
  const values = Object.values(conditions);
  
  const record = db.get<Record<string, unknown>>(
    `SELECT * FROM ${tableName} WHERE ${whereClauses.join(' AND ')}`,
    values
  );
  
  expect(record, `Expected record NOT to exist in ${tableName} with conditions ${JSON.stringify(conditions)}`).toBeNull();
}

/**
 * 테이블의 레코드 수를 확인
 */
export function expectRecordCount(
  db: SqliteDatabase,
  tableName: string,
  expectedCount: number,
  conditions?: Record<string, unknown>
): void {
  let sql = `SELECT COUNT(*) as count FROM ${tableName}`;
  let values: unknown[] = [];
  
  if (conditions && Object.keys(conditions).length > 0) {
    const whereClauses = Object.keys(conditions).map(key => `${key} = ?`);
    sql += ` WHERE ${whereClauses.join(' AND ')}`;
    values = Object.values(conditions);
  }
  
  const result = db.get<{ count: number }>(sql, values);
  expect(result?.count ?? 0).toBe(expectedCount);
}

/**
 * 레코드의 특정 필드 값을 확인
 */
export function expectFieldValue(
  record: Record<string, unknown>,
  fieldName: string,
  expectedValue: unknown
): void {
  expect(record[fieldName]).toEqual(expectedValue);
}

/**
 * 레코드가 특정 필드를 포함하는지 확인
 */
export function expectHasFields(
  record: Record<string, unknown>,
  fieldNames: string[]
): void {
  for (const field of fieldNames) {
    expect(record).toHaveProperty(field);
  }
}

// ============================================================================
// Audit Log Assertions
// ============================================================================

export interface AuditLogExpectation {
  action: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  oldValue?: string | null;
  newValue?: string | null;
}

/**
 * Audit Log가 생성되었는지 확인
 */
export async function expectAuditLogCreated(
  db: SqliteDatabase,
  tableName: string,
  expectation: AuditLogExpectation
): Promise<void> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  
  if (expectation.action) {
    conditions.push('action = ?');
    values.push(expectation.action);
  }
  if (expectation.userId) {
    conditions.push('user_id = ?');
    values.push(expectation.userId);
  }
  if (expectation.oldValue !== undefined) {
    conditions.push('old_value = ?');
    values.push(expectation.oldValue);
  }
  if (expectation.newValue !== undefined) {
    conditions.push('new_value = ?');
    values.push(expectation.newValue);
  }
  
  const record = db.get<Record<string, unknown>>(
    `SELECT * FROM ${tableName} WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT 1`,
    values
  );
  
  expect(record, `Expected audit log to be created in ${tableName}`).toBeTruthy();
}

// ============================================================================
// Timestamp Assertions
// ============================================================================

/**
 * ISO 8601 형식의 타임스탬프인지 확인
 */
export function expectValidTimestamp(value: unknown): void {
  if (typeof value !== 'string') {
    throw new Error(`Expected string timestamp, got ${typeof value}`);
  }
  
  const date = new Date(value);
  expect(date.toISOString()).toBe(value);
}

/**
 * 최근 시간 내에 생성되었는지 확인 (기본 5초)
 */
export function expectRecentlyCreated(createdAt: string, withinMs: number = 5000): void {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const diff = now - created;
  
  expect(diff).toBeGreaterThanOrEqual(0);
  expect(diff).toBeLessThan(withinMs);
}

// ============================================================================
// JSON Assertions
// ============================================================================

/**
 * JSON 문자열이 유효한지 확인
 */
export function expectValidJSON(value: string): unknown {
  let parsed: unknown;
  expect(() => {
    parsed = JSON.parse(value);
  }).not.toThrow();
  return parsed;
}

/**
 * JSON 배열 필드 검증
 */
export function expectJSONArrayField(
  record: Record<string, unknown>,
  fieldName: string,
  expectedLength?: number
): unknown[] {
  const value = record[fieldName];
  expect(typeof value).toBe('string');
  
  const parsed = expectValidJSON(value as string);
  expect(Array.isArray(parsed)).toBe(true);
  
  if (expectedLength !== undefined) {
    expect((parsed as unknown[]).length).toBe(expectedLength);
  }
  
  return parsed as unknown[];
}

// ============================================================================
// Soft Delete Assertions
// ============================================================================

/**
 * 소프트 삭제되었는지 확인
 */
export function expectSoftDeleted(
  record: Record<string, unknown>
): void {
  expect(record.is_deleted).toBe(true);
  expect(record.deleted_at).toBeTruthy();
  expectValidTimestamp(record.deleted_at as string);
}

/**
 * 소프트 삭제되지 않았는지 확인
 */
export function expectNotSoftDeleted(
  record: Record<string, unknown>
): void {
  expect(record.is_deleted).toBeFalsy();
  expect(record.deleted_at).toBeNull();
}

// ============================================================================
// Pagination Assertions
// ============================================================================

export interface PaginatedResult<T> {
  data: T[];
  count: number;
}

/**
 * 페이지네이션 결과 검증
 */
export function expectPaginationResult<T>(
  result: PaginatedResult<T>,
  expectedPageSize: number,
  expectedTotal: number
): void {
  expect(Array.isArray(result.data)).toBe(true);
  expect(result.data.length).toBeLessThanOrEqual(expectedPageSize);
  expect(result.count).toBe(expectedTotal);
}

// ============================================================================
// UUID Assertions
// ============================================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 유효한 UUID 형식인지 확인
 */
export function expectValidUUID(value: unknown): void {
  expect(typeof value).toBe('string');
  expect(value).toMatch(UUID_REGEX);
}

// ============================================================================
// Array Assertions
// ============================================================================

/**
 * 배열이 특정 길이를 가지는지 확인
 */
export function expectArrayLength<T>(
  arr: T[],
  expectedLength: number
): void {
  expect(arr.length).toBe(expectedLength);
}

/**
 * 배열이 비어있는지 확인
 */
export function expectEmptyArray<T>(arr: T[]): void {
  expect(arr.length).toBe(0);
}

/**
 * 배열이 비어있지 않은지 확인
 */
export function expectNonEmptyArray<T>(arr: T[]): void {
  expect(arr.length).toBeGreaterThan(0);
}

/**
 * 배열의 모든 항목이 특정 조건을 만족하는지 확인
 */
export function expectEvery<T>(
  arr: T[],
  predicate: (item: T) => boolean,
  message?: string
): void {
  const allMatch = arr.every(predicate);
  expect(allMatch, message || 'Expected all items to match predicate').toBe(true);
}

/**
 * 배열에 특정 항목이 포함되는지 확인
 */
export function expectIncludes<T>(
  arr: T[],
  predicate: (item: T) => boolean,
  message?: string
): T {
  const found = arr.find(predicate);
  expect(found, message || 'Expected array to include matching item').toBeTruthy();
  return found!;
}
