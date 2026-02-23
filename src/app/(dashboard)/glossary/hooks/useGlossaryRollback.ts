import { useState, useCallback } from 'react';
import { showSuccess, showError, showConfirm } from '@/lib/notifications';

export interface AuditLogEntry {
  id: string;
  glossary_term_id: string;
  user_id: string;
  user_name: string | null;
  user_email: string;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  is_rollback: boolean;
  rollback_to_log_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface RollbackConflict {
  glossaryId: string;
  currentValue?: string;
  expectedValue?: string;
  serverVersion?: number;
}

export interface UseGlossaryRollbackReturn {
  isLoading: boolean;
  isHistoryLoading: boolean;
  auditHistory: AuditLogEntry[];
  conflicts: RollbackConflict[];
  showConflictModal: boolean;
  fetchAuditHistory: (glossaryId: string) => Promise<void>;
  rollbackField: (
    glossaryId: string,
    auditLogId: string,
    expectedVersion?: number,
    fieldName?: string
  ) => Promise<boolean>;
  bulkRollback: (
    items: Array<{
      glossaryId: string;
      auditLogId: string;
      expectedVersion?: number;
      term?: string;
    }>,
    atomic?: boolean
  ) => Promise<{ success: boolean; results: Array<{ glossaryId: string; success: boolean }> }>;
  resolveConflicts: (resolution: 'overwrite' | 'cancel') => Promise<void>;
  closeConflictModal: () => void;
  clearHistory: () => void;
}

export function useGlossaryRollback(
  onSuccess?: () => void
): UseGlossaryRollbackReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [auditHistory, setAuditHistory] = useState<AuditLogEntry[]>([]);
  const [conflicts, setConflicts] = useState<RollbackConflict[]>([]);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [pendingItems, setPendingItems] = useState<Array<{
    glossaryId: string;
    auditLogId: string;
    expectedVersion?: number;
  }> | null>(null);

  const fetchAuditHistory = useCallback(async (glossaryId: string) => {
    setIsHistoryLoading(true);
    try {
      const response = await fetch(`/api/glossary/revert?glossaryId=${glossaryId}&limit=50`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch history');
      }

      const result = await response.json();
      const data = result.data || result;
      setAuditHistory(data.data || []);
    } catch (error) {
      console.error('[useGlossaryRollback] Failed to fetch history:', error);
      showError('변경 이력을 불러오는데 실패했습니다.');
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  const rollbackField = useCallback(async (
    glossaryId: string,
    auditLogId: string,
    expectedVersion?: number,
    fieldName?: string
  ): Promise<boolean> => {
    const confirmed = await showConfirm(
      fieldName 
        ? `"${fieldName}" 필드를 이전 버전으로 복구하시겠습니까?`
        : '선택한 버전으로 복구하시겠습니까?'
    );
    
    if (!confirmed) return false;

    setIsLoading(true);
    try {
      const response = await fetch('/api/glossary/revert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          glossaryId,
          auditLogId,
          expectedVersion,
          conflictResolution: 'reject',
        }),
      });

      const result = await response.json();
      const data = result.data || result;

      if (!response.ok) {
        if (response.status === 409) {
          // Conflict
          setConflicts([{
            glossaryId,
            currentValue: data.currentValue,
            expectedValue: data.expectedValue,
            serverVersion: data.serverVersion,
          }]);
          setPendingItems([{ glossaryId, auditLogId, expectedVersion }]);
          setShowConflictModal(true);
          return false;
        }
        throw new Error(data.error || '롤백에 실패했습니다.');
      }

      showSuccess('성공적으로 복구되었습니다.');
      onSuccess?.();
      return true;
    } catch (error) {
      showError(error instanceof Error ? error.message : '롤백에 실패했습니다.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [onSuccess]);

  const bulkRollback = useCallback(async (
    items: Array<{
      glossaryId: string;
      auditLogId: string;
      expectedVersion?: number;
      term?: string;
    }>,
    atomic: boolean = false
  ): Promise<{ success: boolean; results: Array<{ glossaryId: string; success: boolean }> }> => {
    const confirmed = await showConfirm(
      `${items.length}개 항목을 복구하시겠습니까?`
    );
    
    if (!confirmed) {
      return { success: false, results: [] };
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/glossary/bulk-revert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(item => ({
            glossaryId: item.glossaryId,
            auditLogId: item.auditLogId,
            expectedVersion: item.expectedVersion,
          })),
          atomic,
        }),
      });

      const result = await response.json();
      const data = result.data || result;

      if (data.conflicts && data.conflicts.length > 0) {
        setConflicts(data.conflicts);
        setPendingItems(items.map(item => ({
          glossaryId: item.glossaryId,
          auditLogId: item.auditLogId,
          expectedVersion: item.expectedVersion,
        })));
        setShowConflictModal(true);
      }

      if (data.data?.summary?.success > 0) {
        showSuccess(`${data.data.summary.success}개 항목을 복구했습니다.`);
        onSuccess?.();
      }

      if (data.data?.summary?.failed > 0) {
        showError(`${data.data.summary.failed}개 항목 복구에 실패했습니다.`);
      }

      return {
        success: data.success,
        results: data.data?.results?.map((r: { glossaryId: string; success: boolean }) => ({
          glossaryId: r.glossaryId,
          success: r.success,
        })) || [],
      };
    } catch (error) {
      showError('일괄 복구에 실패했습니다.');
      return { success: false, results: [] };
    } finally {
      setIsLoading(false);
    }
  }, [onSuccess]);

  const resolveConflicts = useCallback(async (resolution: 'overwrite' | 'cancel') => {
    setShowConflictModal(false);
    
    if (resolution === 'cancel' || !pendingItems) {
      setPendingItems(null);
      setConflicts([]);
      return;
    }

    // Retry with overwrite
    setIsLoading(true);
    try {
      // Fetch current versions first
      const itemsWithVersions = await Promise.all(
        pendingItems.map(async (item) => {
          const response = await fetch(`/api/glossary/${item.glossaryId}`);
          const result = await response.json();
          const data = result.data || result;
          return {
            ...item,
            expectedVersion: data.version,
          };
        })
      );

      // Retry rollback
      const response = await fetch('/api/glossary/bulk-revert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsWithVersions }),
      });

      if (response.ok) {
        showSuccess('충돌을 해결하고 복구했습니다.');
        onSuccess?.();
      } else {
        showError('충돌 해결에 실패했습니다.');
      }
    } catch (error) {
      showError('충돌 해결 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
      setPendingItems(null);
      setConflicts([]);
    }
  }, [pendingItems, onSuccess]);

  const closeConflictModal = useCallback(() => {
    setShowConflictModal(false);
    setPendingItems(null);
    setConflicts([]);
  }, []);

  const clearHistory = useCallback(() => {
    setAuditHistory([]);
  }, []);

  return {
    isLoading,
    isHistoryLoading,
    auditHistory,
    conflicts,
    showConflictModal,
    fetchAuditHistory,
    rollbackField,
    bulkRollback,
    resolveConflicts,
    closeConflictModal,
    clearHistory,
  };
}
