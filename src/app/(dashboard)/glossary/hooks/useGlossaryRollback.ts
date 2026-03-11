import { useState, useCallback } from 'react';
import { showSuccess, showError, showConfirm } from '@/lib/notifications';
import { apiGet, apiPost } from '@/lib/api-utils';

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
      // @deprecated /api/glossary/revert 대신 통합 API 사용
      // GET /api/rollback?entity_type=glossary&entity_id={glossaryId}
      const result = await apiGet<{ data?: AuditLogEntry[]; logs?: AuditLogEntry[]; operations?: any[] }>(
        `/api/rollback?entity_type=glossary&entity_id=${glossaryId}&limit=50`
      );
      // API 응답 형식 호환성 처리
      const historyData = (result.data || result.logs || result.operations || result) as { data?: AuditLogEntry[] };
      setAuditHistory(historyData.data || []);
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
      // @deprecated /api/glossary/revert 대신 통합 API 사용
      // POST /api/rollback (operation: 'single')
      await apiPost('/api/rollback', {
        operation: 'single',
        entityType: 'glossary',
        entityId: auditLogId,  // glossary는 auditLogId를 entityId로 사용
        expectedVersion,
        conflictResolution: 'reject',
      });

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
      // @deprecated /api/glossary/bulk-revert 대신 통합 API 사용
      // POST /api/bulk?type=glossary&action=revert
      const result = await apiPost<{ data?: { conflicts?: unknown[]; summary?: { success: number; failed?: number } }; conflicts?: unknown[]; summary?: { success: number; failed?: number } }>(
        '/api/bulk?type=glossary&action=revert',
        {
          ids: items.map(item => item.glossaryId),
          auditLogIds: items.map(item => item.auditLogId),
          expectedVersions: items.map(item => item.expectedVersion),
          atomic,
        }
      );
      const data = (result.data || result);

      if (data.conflicts && data.conflicts.length > 0) {
        setConflicts(data.conflicts as RollbackConflict[]);
        setPendingItems(items.map(item => ({
          glossaryId: item.glossaryId,
          auditLogId: item.auditLogId,
          expectedVersion: item.expectedVersion,
        })));
        setShowConflictModal(true);
      }

      if ((data.summary?.success || 0) > 0) {
        showSuccess(`${data.summary?.success || 0}개 항목을 복구했습니다.`);
        onSuccess?.();
      }

      if ((data.summary?.failed || 0) > 0) {
        showError(`${data.summary?.failed || 0}개 항목 복구에 실패했습니다.`);
      }

      return {
        success: (data.summary?.success || 0) > 0,
        results: [],
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
          const result = await apiGet<{ data?: { version: number }; version?: number }>(`/api/glossary/${item.glossaryId}`);
          const data = (result.data || result) as { version?: number };
          return {
            ...item,
            expectedVersion: data.version,
          };
        })
      );

      // Retry rollback (통합 API 사용)
      await apiPost('/api/bulk?type=glossary&action=revert', {
        ids: itemsWithVersions.map(item => item.glossaryId),
        auditLogIds: itemsWithVersions.map(item => item.auditLogId),
        expectedVersions: itemsWithVersions.map(item => item.expectedVersion),
      });
      showSuccess('충돌을 해결하고 복구했습니다.');
      onSuccess?.();
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
