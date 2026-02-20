/**
 * Unit Tests: Audit Log Decorator
 * 
 * Tests the withAuditLog higher-order function and related utilities.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  withAuditLog,
  createAuditedOperation,
  AuditLogConfigBuilder,
  createAuditContextFromRequest,
  AuditContext,
} from '@/lib/audit/audit_log_decorator';
import { AuditAction } from '@/types';

// Mock Supabase client
function createMockSupabaseClient(insertError: Error | null = null) {
  return {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({
        error: insertError,
      }),
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      }),
    },
    // For user profile lookup
    single: vi.fn().mockResolvedValue({
      data: { name: 'Test User' },
      error: null,
    }),
  };
}

describe('AuditLogDecorator', () => {
  describe('withAuditLog', () => {
    it('should execute original function and create audit log', async () => {
      const mockClient = createMockSupabaseClient();
      const mockFn = vi.fn().mockResolvedValue({ id: 'test-123', name: 'Test' });
      
      const context: AuditContext = {
        userId: 'user-123',
        userName: 'Test User',
        userEmail: 'test@example.com',
        supabase: mockClient as any,
      };

      const auditedFn = withAuditLog(
        mockFn,
        {
          action: 'create' as AuditAction,
          entityType: 'translation',
          getEntityId: (args, result) => (result as { id: string }).id,
          getNewValue: (args, result) => (result as { name: string }).name,
        },
        () => context
      );

      const result = await auditedFn({ name: 'Test Input' });

      expect(result.data).toEqual({ id: 'test-123', name: 'Test' });
      expect(result.auditLogged).toBe(true);
      expect(mockFn).toHaveBeenCalledWith({ name: 'Test Input' });
      expect(mockClient.from).toHaveBeenCalledWith('translation_audit_logs');
    });

    it('should return auditLogged=false if entity ID not found', async () => {
      const mockClient = createMockSupabaseClient();
      const mockFn = vi.fn().mockResolvedValue({ id: 'test-123' });
      
      const context: AuditContext = {
        userId: 'user-123',
        userEmail: 'test@example.com',
        supabase: mockClient as any,
      };

      const auditedFn = withAuditLog(
        mockFn,
        {
          action: 'create' as AuditAction,
          entityType: 'translation',
          getEntityId: () => null, // No entity ID
        },
        () => context
      );

      const result = await auditedFn({});

      expect(result.data).toEqual({ id: 'test-123' });
      expect(result.auditLogged).toBe(false); // No audit log created
    });

    it('should rethrow original error and not create audit log on failure', async () => {
      const mockClient = createMockSupabaseClient();
      const error = new Error('Operation failed');
      const mockFn = vi.fn().mockRejectedValue(error);
      
      const context: AuditContext = {
        userId: 'user-123',
        userEmail: 'test@example.com',
        supabase: mockClient as any,
      };

      const auditedFn = withAuditLog(
        mockFn,
        {
          action: 'create' as AuditAction,
          entityType: 'translation',
          getEntityId: () => 'test-123',
        },
        () => context
      );

      await expect(auditedFn({})).rejects.toThrow('Operation failed');
      expect(mockClient.from).not.toHaveBeenCalled();
    });

    it('should return auditLogged=false if context fails', async () => {
      const mockFn = vi.fn().mockResolvedValue({ id: 'test-123' });

      const auditedFn = withAuditLog(
        mockFn,
        {
          action: 'create' as AuditAction,
          entityType: 'translation',
          getEntityId: () => 'test-123',
        },
        () => { throw new Error('Context error'); }
      );

      const result = await auditedFn({});

      expect(result.data).toEqual({ id: 'test-123' });
      expect(result.auditLogged).toBe(false);
    });

    it('should return auditLogged=false and auditError if audit log creation fails', async () => {
      const mockClient = createMockSupabaseClient(new Error('DB error'));
      const mockFn = vi.fn().mockResolvedValue({ id: 'test-123' });
      
      const context: AuditContext = {
        userId: 'user-123',
        userEmail: 'test@example.com',
        supabase: mockClient as any,
      };

      const auditedFn = withAuditLog(
        mockFn,
        {
          action: 'create' as AuditAction,
          entityType: 'translation',
          getEntityId: () => 'test-123',
        },
        () => context
      );

      const result = await auditedFn({});

      expect(result.data).toEqual({ id: 'test-123' });
      expect(result.auditLogged).toBe(false);
      expect(result.auditError).toBeDefined();
    });

    it('should skip audit log when skipIf returns true', async () => {
      const mockClient = createMockSupabaseClient();
      const mockFn = vi.fn().mockResolvedValue({ id: 'test-123' });
      
      const context: AuditContext = {
        userId: 'user-123',
        userEmail: 'test@example.com',
        supabase: mockClient as any,
      };

      const auditedFn = withAuditLog(
        mockFn,
        {
          action: 'create' as AuditAction,
          entityType: 'translation',
          getEntityId: () => 'test-123',
          skipIf: (args) => (args as { skipAudit: boolean }).skipAudit,
        },
        () => context
      );

      const result = await auditedFn({ skipAudit: true });

      expect(result.auditLogged).toBe(false);
      expect(mockClient.from).not.toHaveBeenCalled();
    });

    it('should use correct table name for glossary entity type', async () => {
      const mockClient = createMockSupabaseClient();
      const mockFn = vi.fn().mockResolvedValue({ id: 'glossary-123' });
      
      const context: AuditContext = {
        userId: 'user-123',
        userEmail: 'test@example.com',
        supabase: mockClient as any,
      };

      const auditedFn = withAuditLog(
        mockFn,
        {
          action: 'update' as AuditAction,
          entityType: 'glossary',
          getEntityId: () => 'glossary-123',
        },
        () => context
      );

      await auditedFn({});

      expect(mockClient.from).toHaveBeenCalledWith('glossary_audit_logs');
    });

    it('should include field name, old value, and new value in audit log', async () => {
      const mockClient = createMockSupabaseClient();
      const mockFn = vi.fn().mockResolvedValue({ id: 'test-123', status: 'active' });
      
      const context: AuditContext = {
        userId: 'user-123',
        userEmail: 'test@example.com',
        supabase: mockClient as any,
      };

      const auditedFn = withAuditLog(
        mockFn,
        {
          action: 'update' as AuditAction,
          entityType: 'translation',
          getEntityId: () => 'test-123',
          getFieldName: () => 'status',
          getOldValue: () => 'pending',
          getNewValue: (args, result) => (result as { status: string }).status,
        },
        () => context
      );

      await auditedFn({ status: 'active' });

      const insertCall = mockClient.from().insert;
      expect(insertCall).toHaveBeenCalledWith(
        expect.objectContaining({
          field_name: 'status',
          old_value: 'pending',
          new_value: 'active',
        })
      );
    });
  });

  describe('createAuditedOperation', () => {
    it('should extract entity ID from result using path', async () => {
      const mockClient = createMockSupabaseClient();
      const mockFn = vi.fn().mockResolvedValue({ 
        data: { id: 'nested-123', name: 'Test' } 
      });
      
      const context: AuditContext = {
        userId: 'user-123',
        userEmail: 'test@example.com',
        supabase: mockClient as any,
      };

      const auditedFn = createAuditedOperation(
        mockFn,
        {
          action: 'create' as AuditAction,
          entityType: 'translation',
          entityIdPath: 'data.id',
        },
        () => context
      );

      const result = await auditedFn({});

      expect(result.auditLogged).toBe(true);
      expect(mockClient.from).toHaveBeenCalled();
    });

    it('should extract entity ID from args if not in result', async () => {
      const mockClient = createMockSupabaseClient();
      const mockFn = vi.fn().mockResolvedValue({ success: true });
      
      const context: AuditContext = {
        userId: 'user-123',
        userEmail: 'test@example.com',
        supabase: mockClient as any,
      };

      const auditedFn = createAuditedOperation(
        mockFn,
        {
          action: 'delete' as AuditAction,
          entityType: 'translation',
          entityIdPath: 'id',
        },
        () => context
      );

      const result = await auditedFn({ id: 'arg-id-123' });

      expect(result.auditLogged).toBe(true);
    });
  });

  describe('AuditLogConfigBuilder', () => {
    it('should build config with all properties', () => {
      const config = AuditLogConfigBuilder.create<{ id: string }, { id: string }>()
        .withAction('update' as AuditAction)
        .withEntityType('translation')
        .withTableName('custom_audit_logs')
        .withEntityIdExtractor((args, result) => result?.id || args?.id || null)
        .withFieldName('status')
        .withOldValueExtractor(() => 'old')
        .withNewValueExtractor(() => 'new')
        .withSkipCondition(() => false)
        .build();

      expect(config.action).toBe('update');
      expect(config.entityType).toBe('translation');
      expect(config.tableName).toBe('custom_audit_logs');
      expect(config.getFieldName?.({} as { id: string })).toBe('status');
    });

    it('should throw if action not provided', () => {
      expect(() => {
        AuditLogConfigBuilder.create()
          .withEntityType('translation')
          .build();
      }).toThrow('Audit action is required');
    });

    it('should throw if entity type not provided', () => {
      expect(() => {
        AuditLogConfigBuilder.create()
          .withAction('create' as AuditAction)
          .build();
      }).toThrow('Entity type is required');
    });

    it('should support function for field name', () => {
      const config = AuditLogConfigBuilder.create<{ field: string }, unknown>()
        .withAction('update' as AuditAction)
        .withEntityType('translation')
        .withFieldName((args) => args.field)
        .build();

      expect(config.getFieldName?.({ field: 'dynamic_field' })).toBe('dynamic_field');
    });
  });

  describe('createAuditContextFromRequest', () => {
    it('should create context from authenticated request', async () => {
      const mockClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123', email: 'test@example.com' } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { name: 'Test User' },
                error: null,
              }),
            }),
          }),
        }),
      };

      const context = await createAuditContextFromRequest(mockClient as any);

      expect(context.userId).toBe('user-123');
      expect(context.userEmail).toBe('test@example.com');
      expect(context.userName).toBe('Test User');
    });

    it('should throw if not authenticated', async () => {
      const mockClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: new Error('Not authenticated'),
          }),
        },
      };

      await expect(createAuditContextFromRequest(mockClient as any))
        .rejects.toThrow('Authentication required');
    });
  });
});
