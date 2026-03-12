'use client';

import React from 'react';
import StepIndicator from './StepIndicator';
import Button from '@/components/ui/Button';
import { useMigration, VersionMapping, EntryAction } from '../contexts/MigrationContext';
import UploadStep from './steps/UploadStep';
import FieldMapping from './FieldMapping';
import PreviewCommitStep from './steps/PreviewCommitStep';

const STEP_ORDER = ['upload', 'mapping', 'previewCommit'] as const;

export default function MigrationWizard() {
  const {
    state,
    nextStep,
    prevStep,
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
    toggleSelected,
    selectAll,
    clearSelected,
    resetState,
    commitMigration,
  } = useMigration();

  const { currentStep, loading, file, productCode, sheetsData, selectedVersion, currentMapping, entries, summary, selectedIds } = state;

  const currentStepIndex = STEP_ORDER.indexOf(currentStep);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === STEP_ORDER.length - 1;

  const canGoNext = () => {
    if (currentStep === 'upload') return canProceedToMapping();
    if (currentStep === 'mapping') return canProceedToPreview();
    if (currentStep === 'previewCommit') return canCommit();
    return false;
  };

  const handleNext = () => {
    if (currentStep === 'mapping') {
      loadPreview();
    } else {
      nextStep();
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Step Indicator at top */}
      <div className="mb-2">
        <StepIndicator currentStep={currentStepIndex + 1} />
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
            <FieldMapping
              sheetsData={sheetsData}
              selectedVersion={selectedVersion}
              onVersionChange={setSelectedVersion}
              onMappingChange={updateCurrentMapping}
              onAllMappingsChange={updateAllMappings}
              initialMappings={currentMapping}
            />
          </div>

          {/* Step 3: Preview & Confirm */}
          <div className="w-full flex-shrink-0 px-4">
            <PreviewCommitStep
              previewData={entries.map((e) => ({
                id: e.id,
                source_text: e.source_text,
                context: e.context,
                translations: e.translations,
                suggested_category: e.suggested_category,
                duplicate_status: e.duplicate_status,
                action: (e.action || 'import') as 'import' | 'skip' | 'merge' | 'overwrite',
              }))}
              selectedIds={selectedIds}
              onToggleSelected={toggleSelected}
              onSelectAll={selectAll}
              onClearSelected={clearSelected}
              onUpdateEntry={updateEntry}
              onBulkUpdate={(action) => {
                const targetIds = entries.filter(e => e.action === action).map(e => e.id);
                if (targetIds.length > 0) {
                  updateEntriesBulk(targetIds, { action: action as EntryAction });
                }
              }}
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

        {/* Center: PageIndicator (● ○ ○) */}
        <div className="flex-1 flex justify-center">
          <div className="flex items-center gap-2">
            {STEP_ORDER.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentStepIndex ? 'bg-primary' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>

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
              onClick={async () => {
                try {
                  await commitMigration();
                  // 성공 시 처리 (예: 완료 메시지, 리다이렉트 등)
                } catch (err) {
                  // 에러는 Context에서 처리
                }
              }}
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
    </div>
  );
}
