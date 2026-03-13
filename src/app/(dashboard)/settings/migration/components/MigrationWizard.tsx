'use client';

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import StepIndicator from './StepIndicator';
import Button from '@/components/ui/Button';
import { useMigration } from '../contexts/MigrationContext';
import UploadStep from './steps/UploadStep';
import FieldMapping from './FieldMapping';
import PreviewCommitStep from './steps/PreviewCommitStep';
import MigrationResult from './MigrationResult';
import PrecommitConfirmModal from './PrecommitConfirmModal';
import Toast from './Toast';

const STEP_ORDER = ['upload', 'mapping', 'previewCommit'] as const;

export default function MigrationWizard() {
  const {
    state,
    nextStep,
    prevStep,
    goToStep,
    canProceedToMapping,
    canProceedToPreview,
    canCommit,
    parseFile,
    setProductCode,
    setSelectedVersion,
    updateCurrentMapping,
    updateAllMappings,
    saveCurrentMapping,
    loadPreview,
    updateEntry,
    updateEntriesBulk,
    deleteEntry,
    deleteEntries,
    toggleSelected,
    selectAll,
    clearSelected,
    resetState,
    commitMigration,
    commitSelectedMigration,
    showToast,
    hideToast,
    clearCommitResults,
  } = useMigration();

  const { currentStep, loading, file, productCode, sheetsData, selectedVersion, currentMapping, entries, summary, selectedIds, versionEntries, error, toast, commitResults } = state;
  
  // Pre-commit 모달 상태
  const [isPrecommitModalOpen, setIsPrecommitModalOpen] = useState(false);
  
  // 마이그레이션 실행 핸들러 - 모달 열기
  const handleOpenPrecommitModal = useCallback(() => {
    setIsPrecommitModalOpen(true);
  }, []);
  
  // 마이그레이션 실행 핸들러 - 모달에서 확인 후 실제 실행
  const handleConfirmMigration = useCallback(async () => {
    setIsPrecommitModalOpen(false);
    try {
      const result = await commitMigration();
      console.log('[MigrationWizard] Commit result:', result);
    } catch (err: any) {
      console.error('[MigrationWizard] Commit failed:', err);
      if (err?.message) {
        showToast(err.message, 'error');
      }
    }
  }, [commitMigration, showToast]);
  
  // Pre-commit 통계 계산
  const precommitStats = useMemo(() => {
    let total = entries.length;
    let importCount = 0;
    let mergeCount = 0;
    let skipCount = 0;
    
    for (const entry of entries) {
      const category = entry.category || 'translation';
      
      if (category === 'glossary') {
        if (entry.existing_in_glossary) {
          skipCount++;
        } else {
          importCount++;
        }
      } else {
        if (entry.existing_in_translation) {
          mergeCount++;
        } else {
          importCount++;
        }
      }
    }
    
    return { total, import: importCount, merge: mergeCount, skip: skipCount };
  }, [entries]);
  
  // Show error toast when error state changes
  useEffect(() => {
    if (error) {
      console.error('[MigrationWizard] Error:', error);
      showToast(error, 'error');
    }
  }, [error, showToast]);

  const currentStepIndex = STEP_ORDER.indexOf(currentStep);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === STEP_ORDER.length - 1;

  const canGoNext = useCallback(() => {
    if (currentStep === 'upload') return canProceedToMapping();
    if (currentStep === 'mapping') return canProceedToPreview();
    if (currentStep === 'previewCommit') return canCommit();
    return false;
  }, [currentStep, canProceedToMapping, canProceedToPreview, canCommit]);

  const handleNext = () => {
    if (currentStep === 'mapping') {
      loadPreview();
    } else {
      nextStep();
    }
  };

  const handleStepClick = useCallback((stepNum: number) => {
    // Navigate to the clicked step (0-indexed)
    const targetIndex = stepNum - 1;
    const currentIndex = currentStepIndex;
    
    // Only allow going back to previous steps
    if (targetIndex < currentIndex) {
      goToStep(STEP_ORDER[targetIndex]);
    }
  }, [currentStepIndex, goToStep]);

  // 결과 화면에서 미리보기로 돌아가기
  const handleCloseResults = useCallback(() => {
    clearCommitResults();
  }, [clearCommitResults]);

  // 결과 화면에서 새로운 마이그레이션 시작
  const handleResetFromResults = useCallback(() => {
    clearCommitResults();
    resetState();
  }, [clearCommitResults, resetState]);

  // 선택 항목만 마이그레이션 핸들러
  const handleBulkMigrate = useCallback(async (ids: string[]) => {
    if (!confirm(`선택한 ${ids.length}개 항목만 마이그레이션하시겠습니까?`)) {
      return;
    }
    try {
      const result = await commitSelectedMigration(ids);
      console.log('[MigrationWizard] Selected commit result:', result);
    } catch (err: any) {
      console.error('[MigrationWizard] Selected commit failed:', err);
      if (err?.message) {
        showToast(err.message, 'error');
      }
    }
  }, [commitSelectedMigration, showToast]);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Toast notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={hideToast}
          duration={5000}
        />
      )}
      
      {/* Pre-commit 확인 모달 */}
      <PrecommitConfirmModal
        isOpen={isPrecommitModalOpen}
        onClose={() => setIsPrecommitModalOpen(false)}
        onConfirm={handleConfirmMigration}
        stats={precommitStats}
        entries={entries}
      />
      
      {/* 결과 화면 (마이그레이션 완료 후) */}
      {commitResults ? (
        <MigrationResult 
          results={commitResults} 
          onReset={handleResetFromResults}
          onClose={handleCloseResults}
        />
      ) : (<>
          {/* Step Indicator at top - Clickable for navigation */}
          <div className="mb-2">
            <StepIndicator 
              currentStep={currentStepIndex + 1} 
              onStepClick={handleStepClick}
            />
          </div>

          {/* Step content area */}
          <div className="relative overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-in-out"
              style={{ transform: `translateX(-${currentStepIndex * 100}%)` }}
            >
              {/* Step 1: File Upload */}
              <div className="w-full flex-shrink-0 px-4">
                <UploadStep
                  file={file}
                  productCode={productCode}
                  parsedData={
                    selectedVersion && sheetsData.length > 0
                      ? {
                          columns: sheetsData.find((s) => s.name === selectedVersion)?.columns || [],
                          rowCount: sheetsData.find((s) => s.name === selectedVersion)?.rowCount || 0,
                        }
                      : null
                  }
                  onFileSelect={parseFile}
                  onProductSelect={setProductCode}
                  onParse={parseFile}
                  isLoading={loading}
                />
              </div>

              {/* Step 2: Field Mapping */}
              <div className="w-full flex-shrink-0 px-4">
                <FieldMapping sheetsData={sheetsData} />
              </div>

              {/* Step 3: Preview & Confirm */}
              <div className="w-full flex-shrink-0 px-4">
                <PreviewCommitStep
                  versionEntries={versionEntries}
                  previewData={entries}
                  selectedIds={selectedIds}
                  onToggleSelected={toggleSelected}
                  onSelectAll={selectAll}
                  onClearSelected={clearSelected}
                  onUpdateEntry={updateEntry}
                  onDeleteEntry={deleteEntry}
                  onBulkUpdate={(category) => {
                    if (selectedIds.length > 0) {
                      updateEntriesBulk(selectedIds, { category });
                    }
                  }}
                  onBulkDelete={(ids) => {
                    if (confirm(`${ids.length}개 항목을 삭제하시겠습니까?`)) {
                      deleteEntries(ids);
                    }
                  }}
                  onBulkMigrate={handleBulkMigrate}
                />
              </div>
            </div>
          </div>

          {/* Bottom navigation - 번역 요청하기와 동일한 레이아웃 */}
          <div className="flex items-center pt-4">
            {/* Left: 이전 button */}
            <div className="flex-1">
              {!isFirstStep && (
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={prevStep}
                  disabled={loading}
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    이전
                  </span>
                </Button>
              )}
            </div>

            {/* Center: Empty (removed dot navigation) */}
            <div className="flex-1" />

            {/* Right: 다음/완료 button */}
            <div className="flex-1 flex justify-end items-center gap-4">
              {/* 초기화 버튼 (첫 단계에서만) */}
              {isFirstStep && (file || productCode) && (
                <Button variant="ghost" size="lg" onClick={resetState} disabled={loading}>
                  초기화
                </Button>
              )}

              {!isLastStep ? (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleNext}
                  disabled={!canGoNext() || loading}
                  loading={loading}
                >
                  <span className="flex items-center gap-2">
                    다음
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleOpenPrecommitModal}
                  disabled={!canGoNext() || loading}
                  loading={loading}
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    마이그레이션 실행
                  </span>
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
