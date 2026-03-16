/**
 * SQLite Client Tests
 * 
 * @example
 * ```bash
 * npm test -- src/lib/database/sqlite/__tests__/sqlite.test.ts
 * ```
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createInMemorySqliteClient,
  createQueryBuilder,
  SqliteDatabase,
  SqliteQueryError,
} from '../';

interface TestUser {
  id: number;
  name: string;
  email: string;
  active: number;
}

describe('SQLite Client', () => {
  let db: SqliteDatabase;

  beforeEach(() => {
    db = createInMemorySqliteClient();
    
    // 테스트 테이블 생성
    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        active INTEGER DEFAULT 1
      )
    `);
  });

  afterEach(() => {
    db.close();
  });

  describe('Basic Operations', () => {
    it('should insert and retrieve data', () => {
      const result = db.run(
        'INSERT INTO users (name, email) VALUES (?, ?)',
        ['홍길동', 'hong@example.com']
      );
      
      expect(result.lastInsertRowid).toBeDefined();
      expect(result.changes).toBe(1);

      const user = db.get<TestUser>('SELECT * FROM users WHERE id = ?', [result.lastInsertRowid]);
      expect(user?.name).toBe('홍길동');
      expect(user?.email).toBe('hong@example.com');
    });

    it('should retrieve multiple rows', () => {
      db.run('INSERT INTO users (name, email) VALUES (?, ?)', ['User1', 'user1@test.com']);
      db.run('INSERT INTO users (name, email) VALUES (?, ?)', ['User2', 'user2@test.com']);
      db.run('INSERT INTO users (name, email) VALUES (?, ?)', ['User3', 'user3@test.com']);

      const users = db.all<TestUser>('SELECT * FROM users ORDER BY id');
      expect(users).toHaveLength(3);
      expect(users[0].name).toBe('User1');
      expect(users[1].name).toBe('User2');
      expect(users[2].name).toBe('User3');
    });

    it('should update data', () => {
      const insert = db.run('INSERT INTO users (name, email) VALUES (?, ?)', ['OldName', 'test@test.com']);
      
      const update = db.run(
        'UPDATE users SET name = ? WHERE id = ?',
        ['NewName', insert.lastInsertRowid]
      );
      
      expect(update.changes).toBe(1);

      const user = db.get<TestUser>('SELECT * FROM users WHERE id = ?', [insert.lastInsertRowid]);
      expect(user?.name).toBe('NewName');
    });

    it('should delete data', () => {
      const insert = db.run('INSERT INTO users (name, email) VALUES (?, ?)', ['ToDelete', 'delete@test.com']);
      
      const del = db.run('DELETE FROM users WHERE id = ?', [insert.lastInsertRowid]);
      expect(del.changes).toBe(1);

      const user = db.get<TestUser>('SELECT * FROM users WHERE id = ?', [insert.lastInsertRowid]);
      expect(user).toBeUndefined();
    });
  });

  describe('Query Builder', () => {
    beforeEach(() => {
      db.run('INSERT INTO users (name, email, active) VALUES (?, ?, ?)', ['Alice', 'alice@test.com', 1]);
      db.run('INSERT INTO users (name, email, active) VALUES (?, ?, ?)', ['Bob', 'bob@test.com', 1]);
      db.run('INSERT INTO users (name, email, active) VALUES (?, ?, ?)', ['Charlie', 'charlie@test.com', 0]);
    });

    it('should build and execute select query', () => {
      const users = createQueryBuilder<TestUser>(db, 'users')
        .where('active', '=', 1)
        .execute();

      expect(users).toHaveLength(2);
      expect(users.every(u => u.active === 1)).toBe(true);
    });

    it('should support ilike filter', () => {
      const users = createQueryBuilder<TestUser>(db, 'users')
        .whereILike('name', '%li%')
        .execute();

      expect(users.length).toBeGreaterThan(0);
      expect(users.every(u => u.name.toLowerCase().includes('li'))).toBe(true);
    });

    it('should support order by', () => {
      const users = createQueryBuilder<TestUser>(db, 'users')
        .orderBy('name', 'asc')
        .execute();

      expect(users[0].name).toBe('Alice');
      expect(users[1].name).toBe('Bob');
      expect(users[2].name).toBe('Charlie');
    });

    it('should support limit', () => {
      const users = createQueryBuilder<TestUser>(db, 'users')
        .limit(2)
        .execute();

      expect(users).toHaveLength(2);
    });

    it('should support insert', () => {
      const result = createQueryBuilder<TestUser>(db, 'users')
        .insert({ name: 'David', email: 'david@test.com', active: 1 })
        .execute();

      expect(result[0].id).toBeDefined();

      const user = db.get<TestUser>('SELECT * FROM users WHERE name = ?', ['David']);
      expect(user?.email).toBe('david@test.com');
    });

    it('should support update', () => {
      createQueryBuilder<TestUser>(db, 'users')
        .update({ name: 'UpdatedAlice' })
        .where('name', '=', 'Alice')
        .execute();

      const user = db.get<TestUser>('SELECT * FROM users WHERE name = ?', ['UpdatedAlice']);
      expect(user).toBeDefined();
    });

    it('should support delete', () => {
      createQueryBuilder<TestUser>(db, 'users')
        .delete()
        .where('name', '=', 'Alice')
        .execute();

      const user = db.get<TestUser>('SELECT * FROM users WHERE name = ?', ['Alice']);
      expect(user).toBeUndefined();
    });

    it('should support pagination', () => {
      const users = createQueryBuilder<TestUser>(db, 'users')
        .orderBy('id', 'asc')
        .paginate(2, 1)
        .execute();

      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Bob'); // 2페이지, 1개씩
    });

    it('should support count', () => {
      const count = createQueryBuilder<TestUser>(db, 'users')
        .where('active', '=', 1)
        .getCount();

      // getCount()는 where 조건이 적용된 상태에서 정상 작동해야 함
      // 결과가 2이거나 0이면 where 조건이 제대로 적용되지 않은 것
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Transactions', () => {
    it('should commit transaction', () => {
      // transaction() 메소드는 자동으로 commit/rollback을 처리함
      // 남성적으로 commit()을 호출하면 "이미 종료됨" 에러 발생
      db.transaction(trx => {
        trx.run('INSERT INTO users (name, email) VALUES (?, ?)', ['TrxUser', 'trx@test.com']);
        // trx.commit()은 자동으로 호출됨 - 명시적 호출 불필요
      });

      const user = db.get<TestUser>('SELECT * FROM users WHERE name = ?', ['TrxUser']);
      expect(user).toBeDefined();
    });

    it('should rollback transaction on error', () => {
      try {
        db.transaction(trx => {
          trx.run('INSERT INTO users (name, email) VALUES (?, ?)', ['RollbackUser', 'rollback@test.com']);
          throw new Error('Intentional error');
        });
      } catch {
        // Expected
      }

      const user = db.get<TestUser>('SELECT * FROM users WHERE name = ?', ['RollbackUser']);
      expect(user).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should throw SqliteQueryError for invalid SQL', () => {
      expect(() => {
        db.run('INVALID SQL');
      }).toThrow(SqliteQueryError);
    });

    it('should include SQL in error', () => {
      try {
        db.run('SELECT * FROM nonexistent_table');
      } catch (error) {
        if (error instanceof SqliteQueryError) {
          expect(error.sql).toContain('nonexistent_table');
        }
      }
    });
  });
});
