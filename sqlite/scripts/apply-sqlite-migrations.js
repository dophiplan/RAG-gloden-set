#!/usr/bin/env node

/**
 * SQLite Migration Runner
 * 
 * Supabase PostgreSQL 스키마를 SQLite로 마이그레이션하는 스크립트
 * 
 * 사용법:
 *   node apply-sqlite-migrations.js [database_path] [options]
 * 
 * 옵션:
 *   --rollback <version>  : 지정된 버전으로 롤백
 *   --dry-run            : 실제 실행 없이 확인만
 *   --force              : 이미 적용된 마이그레이션도 재실행
 *   --seed               : 테스트 데이터도 함께 로드 (개발용)
 * 
 * 예시:
 *   node apply-sqlite-migrations.js
 *   node apply-sqlite-migrations.js ./dev.db
 *   node apply-sqlite-migrations.js ./dev.db --seed
 *   node apply-sqlite-migrations.js ./dev.db --rollback 001
 */

const fs = require('fs');
const path = require('path');

// SQLite3 모듈 동적 로드
try {
  var sqlite3 = require('sqlite3').verbose();
} catch (e) {
  console.error('Error: sqlite3 모듈이 설치되어 있지 않습니다.');
  console.error('설치 명령: npm install sqlite3');
  process.exit(1);
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_DB_PATH = './translation-manager.db';
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 파일 체크섬 계산 (간단한 해시)
 */
function calculateChecksum(content) {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

/**
 * 마이그레이션 파일 파싱
 */
function parseMigrationFilename(filename) {
  const match = filename.match(/^(\d{3})_(.+)\.sql$/);
  if (!match) return null;
  return {
    version: match[1],
    name: match[2],
    filename: filename
  };
}

/**
 * 마이그레이션 파일 목록 가져오기
 */
function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .map(parseMigrationFilename)
    .filter(Boolean)
    .sort((a, b) => a.version.localeCompare(b.version));

  return files;
}

/**
 * 마이그레이션 파일 내용 읽기
 */
function readMigrationFile(migration) {
  const filepath = path.join(MIGRATIONS_DIR, migration.filename);
  return fs.readFileSync(filepath, 'utf-8');
}

// ============================================================================
// Database Operations
// ============================================================================

class MigrationRunner {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
  }

  /**
   * 데이터베이스 연결
   */
  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) reject(err);
        else {
          // 외래 키 제약조건 활성화
          this.db.run('PRAGMA foreign_keys = ON;', (err) => {
            if (err) reject(err);
            else resolve();
          });
        }
      });
    });
  }

  /**
   * 데이터베이스 연결 종료
   */
  async close() {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * 마이그레이션 테이블 초기화
   */
  async initMigrationsTable() {
    return new Promise((resolve, reject) => {
      const sql = `
        CREATE TABLE IF NOT EXISTS _migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          version TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL DEFAULT (datetime('now')),
          checksum TEXT
        )
      `;
      this.db.run(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * 적용된 마이그레이션 목록 가져오기
   */
  async getAppliedMigrations() {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT version, name, applied_at, checksum FROM _migrations ORDER BY version';
      this.db.all(sql, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  /**
   * 특정 버전이 이미 적용되었는지 확인
   */
  async isMigrationApplied(version) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT 1 FROM _migrations WHERE version = ?';
      this.db.get(sql, [version], (err, row) => {
        if (err) reject(err);
        else resolve(!!row);
      });
    });
  }

  /**
   * 마이그레이션 기록 추가
   */
  async recordMigration(migration, checksum) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO _migrations (version, name, checksum)
        VALUES (?, ?, ?)
      `;
      this.db.run(sql, [migration.version, migration.name, checksum], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  /**
   * 마이그레이션 기록 삭제 (롤백용)
   */
  async removeMigrationRecord(version) {
    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM _migrations WHERE version = ?';
      this.db.run(sql, [version], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  /**
   * SQL 실행
   */
  async executeSql(sql) {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * 트랜잭션 시작
   */
  async beginTransaction() {
    return new Promise((resolve, reject) => {
      this.db.run('BEGIN TRANSACTION', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * 트랜잭션 커밋
   */
  async commit() {
    return new Promise((resolve, reject) => {
      this.db.run('COMMIT', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * 트랜잭션 롤백
   */
  async rollback() {
    return new Promise((resolve, reject) => {
      this.db.run('ROLLBACK', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * 모든 테이블 목록 가져오기
   */
  async getTables() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT name FROM sqlite_master
        WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
        AND name != '_migrations'
        ORDER BY name
      `;
      this.db.all(sql, (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(r => r.name));
      });
    });
  }

  /**
   * 테이블 행 수 가져오기
   */
  async getTableCount(tableName) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT COUNT(*) as count FROM "${tableName}"`;
      this.db.get(sql, (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.count : 0);
      });
    });
  }
}

// ============================================================================
// Migration Logic
// ============================================================================

class MigrationManager {
  constructor(dbPath, options = {}) {
    this.runner = new MigrationRunner(dbPath);
    this.options = options;
  }

  /**
   * 마이그레이션 실행
   */
  async run() {
    try {
      await this.runner.connect();
      console.log(`✓ Connected to database: ${this.runner.dbPath}`);

      // 마이그레이션 테이블 초기화
      await this.runner.initMigrationsTable();

      // 마이그레이션 파일 목록 가져오기
      const migrationFiles = getMigrationFiles();
      console.log(`✓ Found ${migrationFiles.length} migration files`);

      // 이미 적용된 마이그레이션 확인
      const appliedMigrations = await this.runner.getAppliedMigrations();
      console.log(`✓ ${appliedMigrations.length} migrations already applied`);

      // 롤백 모드
      if (this.options.rollbackTo) {
        await this.rollbackTo(this.options.rollbackTo);
        return;
      }

      // 마이그레이션 실행
      const pendingMigrations = migrationFiles.filter(m => {
        const isApplied = appliedMigrations.some(am => am.version === m.version);
        return this.options.force || !isApplied;
      });

      if (pendingMigrations.length === 0) {
        console.log('\n✓ All migrations are up to date');
        return;
      }

      console.log(`\n→ Applying ${pendingMigrations.length} migration(s)...\n`);

      for (const migration of pendingMigrations) {
        await this.applyMigration(migration);
      }

      // 결과 출력
      await this.printStatus();

    } catch (error) {
      console.error('\n✗ Migration failed:', error.message);
      console.error(error.stack);
      process.exit(1);
    } finally {
      await this.runner.close();
    }
  }

  /**
   * 단일 마이그레이션 적용
   */
  async applyMigration(migration) {
    const content = readMigrationFile(migration);
    const checksum = calculateChecksum(content);

    console.log(`  [${migration.version}] ${migration.name}`);

    if (this.options.dryRun) {
      console.log(`    (dry-run) Would apply migration`);
      return;
    }

    try {
      await this.runner.beginTransaction();

      // 마이그레이션 SQL 실행
      await this.runner.executeSql(content);

      // 마이그레이션 기록 (001은 _migrations 테이블이 이미 만들어질 때까지 기다림)
      if (migration.version !== '001') {
        await this.runner.recordMigration(migration, checksum);
      }

      await this.runner.commit();
      console.log(`    ✓ Applied successfully`);

    } catch (error) {
      await this.runner.rollback();
      throw new Error(`Migration ${migration.version} failed: ${error.message}`);
    }
  }

  /**
   * 특정 버전으로 롤백
   */
  async rollbackTo(targetVersion) {
    console.log(`\n→ Rolling back to version ${targetVersion}...\n`);

    const appliedMigrations = await this.runner.getAppliedMigrations();
    const migrationsToRollback = appliedMigrations
      .filter(m => m.version > targetVersion)
      .sort((a, b) => b.version.localeCompare(a.version)); // 내림차순

    if (migrationsToRollback.length === 0) {
      console.log('  No migrations to rollback');
      return;
    }

    console.log(`  Will rollback ${migrationsToRollback.length} migration(s)`);

    // 참고: SQLite는 롤백 스크립트를 직접 지원하지 않으므로
    // 테이블을 재생성하거나 수동으로 롤백 SQL을 작성해야 함
    // 여기서는 마이그레이션 기록만 삭제
    for (const migration of migrationsToRollback) {
      console.log(`  [${migration.version}] ${migration.name} - record removed`);
      await this.runner.removeMigrationRecord(migration.version);
    }

    console.log('\n  ⚠ Warning: Only migration records were removed.');
    console.log('  Database schema was not changed. Manual rollback may be required.');
  }

  /**
   * 현재 상태 출력
   */
  async printStatus() {
    console.log('\n=== Migration Status ===');

    const appliedMigrations = await this.runner.getAppliedMigrations();
    console.log(`Total applied migrations: ${appliedMigrations.length}`);

    appliedMigrations.forEach(m => {
      console.log(`  [${m.version}] ${m.name} - ${m.applied_at}`);
    });

    // 테이블 목록
    console.log('\n=== Tables ===');
    const tables = await this.runner.getTables();
    for (const table of tables) {
      const count = await this.runner.getTableCount(table);
      console.log(`  ${table}: ${count} rows`);
    }
  }
}

// ============================================================================
// CLI
// ============================================================================

function parseArgs(args) {
  const options = {
    dbPath: DEFAULT_DB_PATH,
    rollbackTo: null,
    dryRun: false,
    force: false,
    seed: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--rollback') {
      options.rollbackTo = args[++i];
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--seed') {
      options.seed = true;
    } else if (!arg.startsWith('--') && !options.dbPathSet) {
      options.dbPath = arg;
      options.dbPathSet = true;
    }
  }

  return options;
}

function printHelp() {
  console.log(`
SQLite Migration Runner

Usage:
  node apply-sqlite-migrations.js [database_path] [options]

Options:
  --rollback <version>  Rollback to specific version
  --dry-run            Show what would be executed without running
  --force              Re-run already applied migrations
  --seed               Include seed data (003_seed_test_data.sql)
  --help               Show this help

Examples:
  node apply-sqlite-migrations.js
  node apply-sqlite-migrations.js ./dev.db
  node apply-sqlite-migrations.js ./dev.db --seed
  node apply-sqlite-migrations.js ./dev.db --rollback 001
`);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  const options = parseArgs(args);

  console.log('========================================');
  console.log('  SQLite Migration Runner');
  console.log('========================================\n');

  const manager = new MigrationManager(options.dbPath, options);
  await manager.run();

  console.log('\n========================================');
  console.log('  Done!');
  console.log('========================================');
}

// Run
main().catch(console.error);
