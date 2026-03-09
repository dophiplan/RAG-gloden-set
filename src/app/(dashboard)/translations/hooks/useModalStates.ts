import { useState, useEffect } from 'react';
import { EmailTemplateType } from '@/types';
import type { TranslationWithAudit } from './useTranslationData';

/**
 * Hook for managing all modal states in the translations page
 * Centralizes modal open/close logic and selection state
 */
export function useModalStates(translations: TranslationWithAudit[]) {
  // Create translation modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Quick add translation modal
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false);

  // Email modal
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailTemplateType, setEmailTemplateType] = useState<EmailTemplateType>('translation_request');

  // Deployment modal
  const [isDeploymentModalOpen, setIsDeploymentModalOpen] = useState(false);

  // Version history sidebar
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedTranslations, setSelectedTranslations] = useState<TranslationWithAudit[]>([]);

  // Update selected translations when selection or translations change
  useEffect(() => {
    const selected = (translations || []).filter((t) => selectedIds.includes(t.id));
    setSelectedTranslations(selected);
  }, [selectedIds, translations]);

  // Helper functions
  const openCreateModal = () => setIsCreateModalOpen(true);
  const closeCreateModal = () => setIsCreateModalOpen(false);

  const openQuickAddModal = () => setIsQuickAddModalOpen(true);
  const closeQuickAddModal = () => setIsQuickAddModalOpen(false);

  const openEmailModal = (templateType: EmailTemplateType) => {
    setEmailTemplateType(templateType);
    setIsEmailModalOpen(true);
  };
  const closeEmailModal = () => setIsEmailModalOpen(false);

  const openDeploymentModal = () => setIsDeploymentModalOpen(true);
  const closeDeploymentModal = () => setIsDeploymentModalOpen(false);

  const openHistoryPanel = () => setHistoryPanelOpen(true);
  const closeHistoryPanel = () => setHistoryPanelOpen(false);

  const clearSelection = () => setSelectedIds([]);

  const toggleSelectAll = () => {
    if (selectedIds.length === (translations || []).length) {
      setSelectedIds([]);
    } else {
      setSelectedIds((translations || []).map(t => t.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Computed values
  const canEmail = (selectedTranslations || []).length > 0;
  const isAllSelected = selectedIds.length > 0 && selectedIds.length === (translations || []).length;

  return {
    // Create modal
    isCreateModalOpen,
    openCreateModal,
    closeCreateModal,

    // Quick add modal
    isQuickAddModalOpen,
    openQuickAddModal,
    closeQuickAddModal,

    // Email modal
    isEmailModalOpen,
    emailTemplateType,
    openEmailModal,
    closeEmailModal,

    // Deployment modal
    isDeploymentModalOpen,
    openDeploymentModal,
    closeDeploymentModal,

    // History panel
    historyPanelOpen,
    isVersionHistoryPanelOpen: historyPanelOpen, // Alias
    openHistoryPanel,
    openVersionHistoryPanel: openHistoryPanel, // Alias
    closeHistoryPanel,
    closeVersionHistoryPanel: closeHistoryPanel, // Alias

    // Selection
    selectedIds,
    setSelectedIds,
    selectedTranslations,
    clearSelection,
    toggleSelectAll,
    toggleSelect,

    // Computed
    canEmail,
    isAllSelected,
  };
}
