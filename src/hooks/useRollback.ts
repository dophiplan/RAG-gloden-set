'use client';

import { useState, useCallback } from 'react';
import { apiPost } from '@/lib/api-utils';
import { showSuccess, showError, showConfirm } from '@/lib/notifications';

export type TargetType = 'translation' | 'glossary';

export type ConflictResolution = 'overwrite' | 'keep_latest' | 'cancel';

export interface ConflictAction {
  id: string;
  action: string;
  field: string | null;
  user: string;
  at: string;
  changes: {
    from: string | null;
    to: string | null;
  };
}

export interface CheckConflictResult {
  hasConflict: boolean;
  conflictCount: number;
  newerActions: ConflictAction[];
  originalActionAt: string;
}

export interface RollbackResult {
  success: boolean;
  rollbackId?: string;
  rolledBackField?: string;
  restoredValue?: string | null;
  message?: string;
}

export interface UseRollbackReturn {
  isLoading: boolean;
  isChecking: boolean;
  conflicts: ConflictAction[];
  pendingAuditLogId: string | null;
  pendingTargetId: string | null;
  showConflictModal: boolean;
  
  // 충돌 검사
  checkConflict: (
    auditLogId: string,
    targetId: string
  ) => Promise<CheckConflictResult | null>;
  
  // 롤백 실행
  executeRollback: (
    auditLogId: string,
    targetId: string,
    resolution: ConflictResolution
  ) => Promise<RollbackResult>;
  
  // 충돌 해결 및 실행
  resolveAndExecute: (
    resolution: ConflictResolution
  ) => Promise<void>;
  
  // 모달 닫기
  closeConflictModal: () => void;
  
  // 편의 함수: 충돌 확인 → 사용자 확인 → 롤백 실행
  rollbackWithConfirm: (
    auditLogId: string,
    targetId: string,
    options?: {
      fieldName?: string | null;
      confirmMessage?: string;
    }
  ) => Promise<boolean>;
}

export function useRollback(
  targetType: TargetType,
  onSuccess?: () => void
): UseRollbackReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictAction[]>([]);
  const [pendingAuditLogId, setPendingAuditLogId] = useState<string | null>(null);
  const [pendingTargetId, setPendingTargetId] = useState<string | null>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);

  // 충돌 검사
  const checkConflict = useCallback(async (
    auditLogId: string,
    targetId: string
  ): Promise<CheckConflictResult | null> => {
    setIsChecking(true);
    try {
      const result = await apiPost<CheckConflictResult>('/api/rollback/check', {
        targetType,
        auditLogId,
        targetId,
      });
      return result;
    } catch (error) {
      console.error('[useRollback] Conflict check failed:', error);
      showError('충돌 검사 중 오류가 발생했습니다.');
      return null;
    } finally {
      setIsChecking(false);
    }
  }, [targetType]);

  // 롤백 실행
  const executeRollback = useCallback(async (
    auditLogId: string,
    targetId: string,
    resolution: ConflictResolution
  ): Promise<RollbackResult> => {
    if (resolution === 'cancel') {
      return { success: false, message: '사용자가 취소했습니다.' };
    }

    setIsLoading(true);
    try {
      const result = await apiPost<RollbackResult>('/api/rollback/execute', {
        targetType,
        auditLogId,
        targetId,
        conflictResolution: resolution,
      });

      if (result.success !== false) {
        showSuccess(result.message || '롤백이 완료되었습니다.');
        onSuccess?.();
      }

      return {
        ...result,
        success: result.success !== false,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '롤백 실행 중 오류가 발생했습니다.';
      showError(message);
      return { success: false, message };
    } finally {
      setIsLoading(false);
    }
  }, [targetType, onSuccess]);

  // 모달 닫기
  const closeConflictModal = useCallback(() => {
    setShowConflictModal(false);
    setPendingAuditLogId(null);
    setPendingTargetId(null);
    setConflicts([]);
  }, []);

  // 충돌 해결 및 실행 (모달에서 선택 후)
  const resolveAndExecute = useCallback(async (
    resolution: ConflictResolution
  ): Promise<void> => {
    if (!pendingAuditLogId || !pendingTargetId) {
      showError('대상 정보가 없습니다.');
      return;
    }

    if (resolution === 'cancel') {
      closeConflictModal();
      return;
    }

    setShowConflictModal(false);
    const result = await executeRollback(pendingAuditLogId, pendingTargetId, resolution);
    
    if (result.success) {
      setPendingAuditLogId(null);
      setPendingTargetId(null);
      setConflicts([]);
    }
  }, [pendingAuditLogId, pendingTargetId, executeRollback, closeConflictModal]);

  // 편의 함수: 충돌 확인 → 사용자 확인 → 롤백 실행
  const rollbackWithConfirm = useCallback(async (
    auditLogId: string,
    targetId: string,
    options?: {
      fieldName?: string | null;
      confirmMessage?: string;
    }
  ): Promise<boolean> => {
    const { fieldName, confirmMessage } = options || {};

    // 1. 충돌 검사
    const conflictResult = await checkConflict(auditLogId, targetId);
    if (!conflictResult) return false;

    // 2. 충돌이 있으면 모달 표시 (호출자가 모달을 처리)
    if (conflictResult.hasConflict) {
      setConflicts(conflictResult.newerActions);
      setPendingAuditLogId(auditLogId);
      setPendingTargetId(targetId);
      setShowConflictModal(true);
      return false; // 모달에서 사용자가 선택해야 함
    }

    // 3. 충돌 없으면 확인 대화상자
    const defaultMessage = fieldName
      ? `"${fieldName}" 필드를 이전 버전으로 복구하시겠습니까?`
      : '선택한 버전으로 복구하시겠습니까?';
    
    const confirmed = await showConfirm(confirmMessage || defaultMessage);
    if (!confirmed) return false;

    // 4. 롤백 실행
    const result = await executeRollback(auditLogId, targetId, 'overwrite');
    return result.success;
  }, [checkConflict, executeRollback]);

  return {
    isLoading,
    isChecking,
    conflicts,
    pendingAuditLogId,
    pendingTargetId,
    showConflictModal,
    checkConflict,
    executeRollback,
    resolveAndExecute,
    closeConflictModal,
    rollbackWithConfirm,
  };
}

export default useRollback;
