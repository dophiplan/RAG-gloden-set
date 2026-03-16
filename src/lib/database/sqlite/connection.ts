/**
 * SQLite Connection Manager
 * 
 * 싱글톤 패턴을 사용한 연결 관리 및 환경별 설정을 제공합니다.
 * 
 * @example
 * ```typescript
 * // 연결 관리자 가져오기
 * import { getConnectionManager } from '@/lib/database/sqlite/connection';
 * 
 * const manager = getConnectionManager();
 * const db = manager.getConnection();
 * 
 * // 모든 연결 종료
 * await manager.closeAll();
 * ```
 */

import type { SqliteDatabase } from '../sqlite';
import { createSqliteClient, createInMemorySqliteClient } from '../sqlite';

// ============================================================================
// Types
// ============================================================================

/**
 * 연결 모드
 */
export type ConnectionMode = 'file' | 'memory';

/**
 * 환경 타입
 */
export type Environment = 'development' | 'test' | 'production';

/**
 * 연결 설정
 */
export interface ConnectionConfig {
  /** 데이터베이스 파일 경로 (file 모드에서 사용) */
  dbPath?: string;
  /** 연결 모드 */
  mode?: ConnectionMode;
  /** 환경 타입 */
  environment?: Environment;
  /** 최대 연결 수 (연결 풀링 사용 시) */
  maxConnections?: number;
  /** WAL 모드 활성화 (better-sqlite3에서만 사용) */
  enableWAL?: boolean;
  /** 외부 키 제약조건 활성화 */
  enableForeignKeys?: boolean;
  /** 동시 쓰기 모드 (busy timeout ms) */
  busyTimeout?: number;
}

/**
 * 연결 정보
 */
interface ConnectionInfo {
  db: SqliteDatabase;
  config: ConnectionConfig;
  createdAt: Date;
  lastUsedAt: Date;
  useCount: number;
}

// ============================================================================
// Error Classes
// ============================================================================

class ConnectionManagerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConnectionManagerError';
  }
}

// ============================================================================
// Connection Manager
// ============================================================================

class ConnectionManager {
  private connections: Map<string, ConnectionInfo> = new Map();
  private defaultConfig: ConnectionConfig;
  private static instance: ConnectionManager | null = null;

  private constructor() {
    this.defaultConfig = this.loadConfigFromEnv();
  }

  /**
   * 싱글톤 인스턴스를 가져옵니다.
   */
  static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  /**
   * 환경변수에서 설정을 로드합니다.
   */
  private loadConfigFromEnv(): ConnectionConfig {
    const env = process.env.NODE_ENV as Environment || 'development';
    
    return {
      dbPath: process.env.SQLITE_DB_PATH,
      mode: (process.env.SQLITE_MODE as ConnectionMode) || 'file',
      environment: env,
      maxConnections: parseInt(process.env.SQLITE_MAX_CONNECTIONS || '1', 10),
      enableWAL: process.env.SQLITE_ENABLE_WAL !== 'false',
      enableForeignKeys: process.env.SQLITE_ENABLE_FK !== 'false',
      busyTimeout: parseInt(process.env.SQLITE_BUSY_TIMEOUT || '5000', 10),
    };
  }

  /**
   * 환경별 기본 설정을 가져옵니다.
   */
  private getDefaultConfigForEnvironment(env: Environment): Partial<ConnectionConfig> {
    switch (env) {
      case 'development':
        return {
          enableWAL: true,
          enableForeignKeys: true,
          busyTimeout: 5000,
        };
      
      case 'test':
        return {
          mode: 'memory',
          enableWAL: false,
          enableForeignKeys: true,
          busyTimeout: 1000,
        };
      
      case 'production':
        return {
          enableWAL: true,
          enableForeignKeys: true,
          busyTimeout: 10000,
        };
      
      default:
        return {};
    }
  }

  /**
   * 연결 키를 생성합니다.
   */
  private createConnectionKey(config: ConnectionConfig): string {
    if (config.mode === 'memory') {
      return 'memory';
    }
    return config.dbPath || './data/app.db';
  }

  /**
   * 데이터베이스 연결을 가져옵니다.
   * 
   * @param config - 연결 설정 (선택적)
   * @returns SQLite 데이터베이스 인스턴스
   */
  getConnection(config?: ConnectionConfig): SqliteDatabase {
    const mergedConfig = {
      ...this.defaultConfig,
      ...(this.defaultConfig.environment 
        ? this.getDefaultConfigForEnvironment(this.defaultConfig.environment)
        : {}),
      ...config,
    };

    const key = this.createConnectionKey(mergedConfig);
    const existing = this.connections.get(key);

    if (existing) {
      existing.lastUsedAt = new Date();
      existing.useCount++;
      return existing.db;
    }

    // 새 연결 생성
    const db = mergedConfig.mode === 'memory'
      ? createInMemorySqliteClient()
      : createSqliteClient(mergedConfig.dbPath);

    // 추가 설정 적용
    this.applyPragmas(db, mergedConfig);

    this.connections.set(key, {
      db,
      config: mergedConfig,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      useCount: 1,
    });

    return db;
  }

  /**
   * PRAGMA 설정을 적용합니다.
   */
  private applyPragmas(db: SqliteDatabase, config: ConnectionConfig): void {
    // 외래 키 제약조건
    if (config.enableForeignKeys !== false) {
      db.run('PRAGMA foreign_keys = ON');
    }

    // busy timeout (동시 쓰기 대기)
    if (config.busyTimeout) {
      db.run(`PRAGMA busy_timeout = ${config.busyTimeout}`);
    }

    // journal_mode는 better-sqlite3에서 WAL 설정 시 사용
    // node:sqlite에서는 지원되지 않을 수 있음
    if (config.enableWAL && config.mode !== 'memory') {
      try {
        db.run('PRAGMA journal_mode = WAL');
      } catch {
        // WAL 모드 설정 실패 무시 (지원하지 않는 엔진)
      }
    }
  }

  /**
   * 특정 연결을 종료합니다.
   * 
   * @param key - 연결 키
   */
  closeConnection(key: string): void {
    const info = this.connections.get(key);
    if (info) {
      info.db.close();
      this.connections.delete(key);
    }
  }

  /**
   * 모든 연결을 종료합니다.
   */
  closeAll(): void {
    this.connections.forEach((info, key) => {
      try {
        info.db.close();
      } catch (error) {
        console.error(`연결 종료 실패 (${key}):`, error);
      }
    });
    this.connections.clear();
  }

  /**
   * 현재 활성화된 연결 수를 반환합니다.
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * 연결 통계 정보를 반환합니다.
   */
  getStats(): Array<{
    key: string;
    createdAt: Date;
    lastUsedAt: Date;
    useCount: number;
    mode: ConnectionMode;
    engine: string;
  }> {
    const result: Array<{
      key: string;
      createdAt: Date;
      lastUsedAt: Date;
      useCount: number;
      mode: ConnectionMode;
      engine: string;
    }> = [];
    this.connections.forEach((info, key) => {
      result.push({
        key,
        createdAt: info.createdAt,
        lastUsedAt: info.lastUsedAt,
        useCount: info.useCount,
        mode: info.config.mode || 'file',
        engine: info.db.engine,
      });
    });
    return result;
  }

  /**
   * 연결 관리자를 재설정합니다.
   * (주로 테스트에서 사용)
   */
  reset(): void {
    this.closeAll();
    this.defaultConfig = this.loadConfigFromEnv();
  }

  /**
   * 기본 설정을 업데이트합니다.
   * 
   * @param config - 새로운 설정
   */
  setDefaultConfig(config: ConnectionConfig): void {
    this.defaultConfig = {
      ...this.defaultConfig,
      ...config,
    };
  }

  /**
   * 현재 설정을 가져옵니다.
   */
  getConfig(): ConnectionConfig {
    return { ...this.defaultConfig };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * 연결 관리자 인스턴스를 가져옵니다.
 * 
 * @returns ConnectionManager 인스턴스
 * 
 * @example
 * ```typescript
 * const manager = getConnectionManager();
 * const db = manager.getConnection();
 * 
 * // 테스트용 메모리 연결
 * const testDb = manager.getConnection({ mode: 'memory' });
 * ```
 */
export function getConnectionManager(): ConnectionManager {
  return ConnectionManager.getInstance();
}

/**
 * 데이터베이스 연결을 가져옵니다.
 * getConnectionManager().getConnection()의 편의 함수입니다.
 * 
 * @param config - 연결 설정 (선택적)
 * @returns SQLite 데이터베이스 인스턴스
 * 
 * @example
 * ```typescript
 * import { getConnection } from '@/lib/database/sqlite/connection';
 * 
 * const db = getConnection();
 * const users = db.all('SELECT * FROM users');
 * ```
 */
export function getConnection(config?: ConnectionConfig): SqliteDatabase {
  return getConnectionManager().getConnection(config);
}

/**
 * 테스트용 메모리 연결을 가져옵니다.
 * 
 * @returns 메모리 기반 SQLite 데이터베이스 인스턴스
 * 
 * @example
 * ```typescript
 * import { getTestConnection } from '@/lib/database/sqlite/connection';
 * 
 * const db = getTestConnection();
 * 
 * // 테스트 후 정리
 * afterAll(() => {
 *   db.close();
 * });
 * ```
 */
export function getTestConnection(): SqliteDatabase {
  return getConnectionManager().getConnection({
    mode: 'memory',
    environment: 'test',
  });
}

/**
 * 모든 데이터베이스 연결을 종료합니다.
 * 
 * @example
 * ```typescript
 * import { closeAllConnections } from '@/lib/database/sqlite/connection';
 * 
 * // 앱 종료 시
 * process.on('SIGINT', () => {
 *   closeAllConnections();
 *   process.exit(0);
 * });
 * ```
 */
export function closeAllConnections(): void {
  getConnectionManager().closeAll();
}

/**
 * 프로덕션 환경을 위한 연결을 설정합니다.
 * 
 * @param dbPath - 데이터베이스 파일 경로
 * @returns SQLite 데이터베이스 인스턴스
 */
export function createProductionConnection(dbPath: string): SqliteDatabase {
  return getConnectionManager().getConnection({
    dbPath,
    environment: 'production',
    enableWAL: true,
    enableForeignKeys: true,
    busyTimeout: 10000,
  });
}

/**
 * 개발 환경을 위한 연결을 설정합니다.
 * 
 * @param dbPath - 데이터베이스 파일 경로 (기본값: ./data/app.db)
 * @returns SQLite 데이터베이스 인스턴스
 */
export function createDevelopmentConnection(dbPath?: string): SqliteDatabase {
  return getConnectionManager().getConnection({
    dbPath,
    environment: 'development',
    enableWAL: true,
    enableForeignKeys: true,
    busyTimeout: 5000,
  });
}
