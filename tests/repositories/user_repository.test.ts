/**
 * User Repository Test Suite
 * 
 * SupabaseUserRepository와 SqliteUserRepository를 동일한 테스트 케이스로 검증
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SupabaseUserRepository } from '@/repositories/implementations/supabase/user_repository';
import { SqliteUserRepository } from '@/repositories/implementations/sqlite/user_repository';
import type { IUserRepository, User, UserCreateData, UserUpdateData } from '@/repositories/interfaces/user_repository';
import type { SqliteDatabase } from '@/lib/database/sqlite';
import { createInMemorySqliteClient } from '@/lib/database/sqlite';

// ============================================================================
// Mock Supabase Client
// ============================================================================

class MockSupabaseClient {
  private users: Map<string, User> = new Map();
  private auditLogs: Array<{
    id: string;
    user_id: string | null;
    action: string;
    details: Record<string, unknown> | null;
    performed_by: string | null;
    created_at: string;
  }> = [];
  private idCounter = 1;

  reset() {
    this.users.clear();
    this.auditLogs = [];
    this.idCounter = 1;
  }

  private generateId(): string {
    return `mock-user-${this.idCounter++}`;
  }

  from(table: string) {
    const self = this;

    if (table === 'users') {
      return {
        select: (columns?: string, options?: { count?: 'exact' }) => {
          const builder = {
            eq: (column: string, value: string) => {
              if (column === 'id') {
                const user = self.users.get(value) || null;
                return {
                  single: () => Promise.resolve({ data: user, error: user ? null : { code: 'PGRST116' } }),
                  then: (cb: any) => cb({ data: user ? [user] : [], error: null, count: user ? 1 : 0 }),
                };
              }
              if (column === 'email') {
                let found: User | null = null;
                for (const u of self.users.values()) {
                  if (u.email === value) { found = u; break; }
                }
                return {
                  single: () => Promise.resolve({ data: found, error: found ? null : { code: 'PGRST116' } }),
                  then: (cb: any) => cb({ data: found ? [found] : [], error: null, count: found ? 1 : 0 }),
                };
              }
              if (column === 'role') {
                const filtered = Array.from(self.users.values()).filter(u => u.role === value);
                return { ...builder, _filtered: filtered };
              }
              if (column === 'status') {
                const filtered = Array.from(self.users.values()).filter(u => u.status === value);
                return { ...builder, _filtered: filtered };
              }
              return builder;
            },
            or: (condition: string) => {
              const searchMatch = condition.match(/ilike\.%([^%]+)%/);
              if (searchMatch) {
                const search = searchMatch[1].toLowerCase();
                const filtered = Array.from(self.users.values()).filter(
                  u => u.email.toLowerCase().includes(search) || (u.full_name && u.full_name.toLowerCase().includes(search))
                );
                return { ...builder, _filtered: filtered };
              }
              return builder;
            },
            range: (offset: number, limit: number) => {
              const data = (builder as any)._filtered || Array.from(self.users.values());
              const paginated = data.slice(offset, limit + 1);
              return { ...builder, _paginated: paginated, _total: data.length };
            },
            order: (column: string, { ascending }: { ascending: boolean }) => {
              return builder;
            },
            single: () => Promise.resolve({ data: null, error: { code: 'PGRST116' } }),
            then: (cb: any) => {
              const data = (builder as any)._paginated || (builder as any)._filtered || Array.from(self.users.values());
              const count = (builder as any)._total ?? self.users.size;
              cb({ data, error: null, count: options?.count === 'exact' ? count : null });
            },
          };
          return builder;
        },
        insert: (data: unknown) => {
          const items = Array.isArray(data) ? (data as UserCreateData[]) : [data as UserCreateData];
          const created: User[] = [];

          for (const item of items) {
            // Check for duplicate email
            for (const existing of self.users.values()) {
              if (existing.email === item.email) {
                return { select: () => ({ single: () => Promise.reject(new Error('Duplicate email')) }) };
              }
            }

            const id = self.generateId();
            const now = new Date().toISOString();
            const user: User = {
              id,
              email: item.email,
              full_name: item.full_name ?? null,
              role: item.role ?? 'user',
              status: item.status ?? 'pending',
              avatar_url: item.avatar_url ?? null,
              created_at: now,
              updated_at: now,
              last_sign_in_at: null,
            };
            self.users.set(id, user);
            created.push(user);
          }

          return {
            select: () => ({
              single: () => Promise.resolve({ data: created[0] ?? null, error: null }),
              then: (cb: any) => cb({ data: created, error: null }),
            }),
            then: (cb: any) => cb({ data: created, error: null }),
          };
        },
        update: (updates: unknown) => {
          const updateData = updates as UserUpdateData;
          return {
            eq: (column: string, value: string) => {
              if (column === 'id') {
                const user = self.users.get(value);
                if (!user) return { select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) };
                const updated: User = {
                  ...user,
                  ...(updateData.email && { email: updateData.email }),
                  ...(updateData.full_name !== undefined && { full_name: updateData.full_name }),
                  ...(updateData.role && { role: updateData.role }),
                  ...(updateData.status && { status: updateData.status }),
                  ...(updateData.avatar_url !== undefined && { avatar_url: updateData.avatar_url }),
                  updated_at: new Date().toISOString(),
                };
                self.users.set(value, updated);
                return { select: () => ({ single: () => Promise.resolve({ data: updated, error: null }) }) };
              }
              return { select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) };
            },
            in: (column: string, ids: string[]) => {
              let count = 0;
              for (const id of ids) {
                const user = self.users.get(id);
                if (user) {
                  const updated: User = {
                    ...user,
                    ...(updateData.email && { email: updateData.email }),
                    ...(updateData.full_name !== undefined && { full_name: updateData.full_name }),
                    ...(updateData.role && { role: updateData.role }),
                    ...(updateData.status && { status: updateData.status }),
                    ...(updateData.avatar_url !== undefined && { avatar_url: updateData.avatar_url }),
                    updated_at: new Date().toISOString(),
                  };
                  self.users.set(id, updated);
                  count++;
                }
              }
              return { then: (cb: any) => cb({ error: null, count }) };
            },
          };
        },
        delete: () => ({
          eq: (column: string, value: string) => {
            if (column === 'id') {
              const deleted = self.users.has(value) ? 1 : 0;
              self.users.delete(value);
              return { then: (cb: any) => cb({ error: null, count: deleted }) };
            }
            return { then: (cb: any) => cb({ error: null, count: 0 }) };
          },
          in: (column: string, ids: string[]) => {
            let count = 0;
            for (const id of ids) {
              if (self.users.has(id)) {
                self.users.delete(id);
                count++;
              }
            }
            return { then: (cb: any) => cb({ error: null, count }) };
          },
        }),
      };
    }

    if (table === 'user_audit_logs') {
      return {
        select: () => ({
          eq: (column: string, value: string) => ({
            order: (col: string, { ascending }: { ascending: boolean }) => ({
              limit: (n: number) => ({
                then: (cb: any) => {
                  let logs = self.auditLogs.filter(l => l.user_id === value);
                  if (!ascending) logs = logs.reverse();
                  cb({ data: logs.slice(0, n), error: null });
                },
              }),
            }),
          }),
          order: (col: string, { ascending }: { ascending: boolean }) => ({
            limit: (n: number) => ({
              then: (cb: any) => {
                let logs = [...self.auditLogs];
                if (!ascending) logs = logs.reverse();
                cb({ data: logs.slice(0, n), error: null });
              },
            }),
          }),
        }),
        insert: (data: { action: string; details: Record<string, unknown>; performed_by: string | null; created_at: string }) => {
          self.auditLogs.push({
            id: `audit-${self.idCounter++}`,
            user_id: (data.details?.user_id as string) ?? null,
            action: data.action,
            details: data.details,
            performed_by: data.performed_by,
            created_at: data.created_at,
          });
          return { then: (cb: any) => cb({ error: null }) };
        },
      };
    }

    return { select: () => ({ then: (cb: any) => cb({ data: [], error: null }) }) };
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('UserRepository', () => {
  const mockSupabase = new MockSupabaseClient();
  let sqliteDb: SqliteDatabase;
  let sqliteRepo: SqliteUserRepository;
  let supabaseRepo: SupabaseUserRepository;

  beforeEach(() => {
    mockSupabase.reset();
    supabaseRepo = new SupabaseUserRepository(mockSupabase as any);

    sqliteDb = createInMemorySqliteClient();
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        full_name TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        status TEXT NOT NULL DEFAULT 'pending',
        avatar_url TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_sign_in_at TEXT
      )
    `);
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS user_audit_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        action TEXT NOT NULL,
        details TEXT,
        performed_by TEXT,
        created_at TEXT NOT NULL
      )
    `);
    sqliteRepo = new SqliteUserRepository(sqliteDb);
  });

  const runTests = (name: string, repo: () => IUserRepository) => {
    describe(`${name} Implementation`, () => {
      describe('findById', () => {
        it('should find user by id', async () => {
          const created = await repo().create({ email: 'test@example.com', full_name: 'Test User', role: 'user', status: 'active' });
          const found = await repo().findById(created.id);
          expect(found).not.toBeNull();
          expect(found?.id).toBe(created.id);
          expect(found?.email).toBe('test@example.com');
        });

        it('should return null for non-existent id', async () => {
          const found = await repo().findById('non-existent-id');
          expect(found).toBeNull();
        });
      });

      describe('findByEmail', () => {
        it('should find user by email', async () => {
          await repo().create({ email: 'email-test@example.com', full_name: 'Email Test', role: 'translator' });
          const found = await repo().findByEmail('email-test@example.com');
          expect(found).not.toBeNull();
          expect(found?.email).toBe('email-test@example.com');
        });

        it('should return null for non-existent email', async () => {
          const found = await repo().findByEmail('nonexistent@example.com');
          expect(found).toBeNull();
        });
      });

      describe('create', () => {
        it('should create a user with default values', async () => {
          const created = await repo().create({ email: 'newuser@example.com' });
          expect(created.email).toBe('newuser@example.com');
          expect(created.role).toBe('user');
          expect(created.status).toBe('pending');
        });

        it('should create a user with all fields', async () => {
          const created = await repo().create({
            email: 'complete@example.com',
            full_name: 'Complete User',
            role: 'admin',
            status: 'active',
          });
          expect(created.email).toBe('complete@example.com');
          expect(created.full_name).toBe('Complete User');
          expect(created.role).toBe('admin');
        });

        it('should throw error for duplicate email', async () => {
          await repo().create({ email: 'dup@example.com' });
          await expect(repo().create({ email: 'dup@example.com' })).rejects.toThrow();
        });
      });

      describe('update', () => {
        it('should update user fields', async () => {
          const created = await repo().create({ email: 'update@example.com', full_name: 'Original' });
          const updated = await repo().update(created.id, { full_name: 'Updated', status: 'active' });
          expect(updated?.full_name).toBe('Updated');
          expect(updated?.status).toBe('active');
        });

        it('should return null for non-existent user', async () => {
          const updated = await repo().update('non-existent', { full_name: 'New' });
          expect(updated).toBeNull();
        });
      });

      describe('delete', () => {
        it('should delete user and return true', async () => {
          const created = await repo().create({ email: 'delete@example.com' });
          const deleted = await repo().delete(created.id);
          expect(deleted).toBe(true);
          expect(await repo().findById(created.id)).toBeNull();
        });

        it('should return false for non-existent user', async () => {
          const deleted = await repo().delete('non-existent-id');
          expect(deleted).toBe(false);
        });
      });

      describe('createMany', () => {
        it('should create multiple users', async () => {
          const created = await repo().createMany([
            { email: 'bulk1@example.com' },
            { email: 'bulk2@example.com' },
          ]);
          expect(created).toHaveLength(2);
        });

        it('should return empty array for empty input', async () => {
          const created = await repo().createMany([]);
          expect(created).toHaveLength(0);
        });
      });

      describe('updateMany', () => {
        it('should update multiple users', async () => {
          const users = await repo().createMany([
            { email: 'um1@example.com', status: 'pending' },
            { email: 'um2@example.com', status: 'pending' },
          ]);
          const count = await repo().updateMany(users.map(u => u.id), { status: 'active' });
          expect(count).toBe(2);
        });
      });

      describe('deleteMany', () => {
        it('should delete multiple users', async () => {
          const users = await repo().createMany([
            { email: 'dm1@example.com' },
            { email: 'dm2@example.com' },
          ]);
          const count = await repo().deleteMany(users.map(u => u.id));
          expect(count).toBe(2);
        });
      });

      describe('createAuditLog', () => {
        it('should create audit log without throwing', async () => {
          await expect(repo().createAuditLog('USER_LOGIN', { ip: '127.0.0.1' }, 'admin')).resolves.not.toThrow();
        });
      });

      describe('getAuditLogs', () => {
        it('should return audit logs', async () => {
          await repo().createAuditLog('ACTION_1', {}, null);
          const logs = await repo().getAuditLogs(undefined, 10);
          expect(Array.isArray(logs)).toBe(true);
        });
      });
    });
  };

  runTests('SQLite', () => sqliteRepo);
  runTests('Supabase', () => supabaseRepo);

  describe('Performance Comparison', () => {
    it('should complete operations in reasonable time', async () => {
      const users = Array.from({ length: 20 }, (_, i) => ({
        email: `perf-${i}@example.com`,
        role: ['admin', 'user'][i % 2] as UserCreateData['role'],
      }));

      const sqliteStart = performance.now();
      await sqliteRepo.createMany(users);
      await sqliteRepo.findMany({ role: 'admin' }, { page: 1, limit: 10 });
      const sqliteDuration = performance.now() - sqliteStart;

      const supabaseUsers = Array.from({ length: 20 }, (_, i) => ({
        email: `perf-s-${i}@example.com`,
        role: ['admin', 'user'][i % 2] as UserCreateData['role'],
      }));

      const supabaseStart = performance.now();
      await supabaseRepo.createMany(supabaseUsers);
      await supabaseRepo.findMany({ role: 'admin' }, { page: 1, limit: 10 });
      const supabaseDuration = performance.now() - supabaseStart;

      // Both should complete within 1 second
      expect(sqliteDuration).toBeLessThan(1000);
      expect(supabaseDuration).toBeLessThan(1000);
    });
  });
});
