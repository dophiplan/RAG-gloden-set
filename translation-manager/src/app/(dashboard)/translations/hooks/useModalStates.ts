import { useState, useEffect } from 'react';
import { Translation, EmailTemplateType } from '@/types';

/**
 * Hook for managing all modal states in the translations page
 * Centralizes modal open/close logic and selection state
 */
export function useModalStates(translations: Translation[]) {
  // Create translation modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Email modal
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailTemplateType, setEmailTemplateType] = useState<EmailTemplateType>('translation_request');

  // Deployment modal
  const [isDeploymentModalOpen, setIsDeploymentModalOpen] = useState(false);

  // Version history sidebar
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedTranslations, setSelectedTranslations] = useState<Translation[]>([]);

  // Update selected translations when selection or translations change
  useEffect(() => {
    const selected = translations.filter((t) => selectedIds.includes(t.id));
    setSelectedTranslations(selected);
  }, [selectedIds, translations]);

  // Helper functions
  const openCreateModal = () => setIsCreateModalOpen(true);
  const closeCreateModal = () => setIsCreateModalOpen(false);

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

  return {
    // Create modal
    isCreateModalOpen,
    openCreateModal,
    closeCreateModal,

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
    openHistoryPanel,
    closeHistoryPanel,

    // Selection
    selectedIds,
    setSelectedIds,
    selectedTranslations,
    clearSelection,
  };
}
