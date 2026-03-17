/**
 * SQLite Helper for API Routes
 * 
 * API Routes에서 SQLite 지원을 위한 유틸리티 함수들을 제공합니다.
 */

import { getConnection } from '@/lib/database/sqlite/connection';

/**
 * 현재 SQLite 모드인지 확인
 */
export function isSQLiteMode(): boolean {
  return process.env.DATABASE_PROVIDER === 'sqlite' || 
         process.env.NEXT_PUBLIC_DATABASE_PROVIDER === 'sqlite';
}

/**
 * SQLite 데이터베이스 연결 가져오기
 */
export async function getSQLiteConnection() {
  return getConnection();
}
