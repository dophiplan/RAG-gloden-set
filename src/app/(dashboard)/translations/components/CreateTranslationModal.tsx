'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import FileUploader, { UploadedFile } from '@/components/FileUploader';
import TranslationFormFields from '@/components/translations/TranslationFormFields';
import { ProductCode, PriorityLevel, LanguageCode, ScopeType } from '@/types';
import { getDefaultLanguagesForProduct } from '@/lib/product-languages';
import { apiPost } from '@/lib/api-utils';
import { showError, showSuccess } from '@/lib/notifications';

type TabType = 'manual' | 'pdf';

interface CreateTranslationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProductCode?: ProductCode | null;
  onCreate: (
    sourceText: string,
    context: string,
    version: string,
    productCode: ProductCode | '',
    scope: ScopeType,
    priority: PriorityLevel,
    languages: LanguageCode[],
    platformCodes: string[],
    completionDate: string
  ) => Promise<boolean | undefined>;
  onPDFUpload?: (
    files: UploadedFile[],
    version: string,
    productCode: ProductCode | '',
    scope: ScopeType,
    priority: PriorityLevel,
    languages: LanguageCode[],
    platformCodes: string[],
    completionDate: string
  ) => Promise<void>;
}

const LANGUAGE_LABELS: Record<string, string> = {
  en: '영어',
  ja: '일본어',
  zh: '중국어(간체)',
  'zh-TW': '중국어(번체)',
  fr: '프랑스어',
  es: '스페인어',
  de: '독일어',
  pt: '포르투갈어',
};

export default function CreateTranslationModal({
  isOpen,
  onClose,
  initialProductCode,
  onCreate,
  onPDFUpload,
}: CreateTranslationModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('manual');

  // Manual form states
  const [newSourceText, setNewSourceText] = useState('');
  const [newContext, setNewContext] = useState('');
  const [newVersion, setNewVersion] = useState('');
  const [newProductCode, setNewProductCode] = useState<ProductCode | ''>(initialProductCode || '');
  const [newScope, setNewScope] = useState<ScopeType>('');
  const [newPriority, setNewPriority] = useState<PriorityLevel>('medium');
  const [selectedLanguages, setSelectedLanguages] = useState<LanguageCode[]>(['en', 'ja']);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [newCompletionDate, setNewCompletionDate] = useState('');
  
  // AI Translation states
  const [aiTranslations, setAiTranslations] = useState<Record<string, string>>({});
  const [isTranslating, setIsTranslating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // PDF upload states
  const [pdfFiles, setPdfFiles] = useState<UploadedFile[]>([]);
  const [pdfVersion, setPdfVersion] = useState('');
  const [pdfProductCode, setPdfProductCode] = useState<ProductCode | ''>(initialProductCode || '');
  const [pdfScope, setPdfScope] = useState<ScopeType>('');
  const [pdfPriority, setPdfPriority] = useState<PriorityLevel>('medium');
  const [pdfSelectedLanguages, setPdfSelectedLanguages] = useState<LanguageCode[]>(['en', 'ja']);
  const [pdfSelectedPlatforms, setPdfSelectedPlatforms] = useState<string[]>([]);
  const [pdfCompletionDate, setPdfCompletionDate] = useState('');
  const [uploading, setUploading] = useState(false);
  
  const [pdfError, setPdfError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update product code when modal opens with new initial value
  useEffect(() => {
    if (isOpen && initialProductCode) {
      setNewProductCode(initialProductCode);
      setPdfProductCode(initialProductCode);
    }
  }, [isOpen, initialProductCode]);

  // Update languages when product changes - for manual form
  useEffect(() => {
    if (newProductCode) {
      const defaultLangs = getDefaultLanguagesForProduct(newProductCode);
      setSelectedLanguages(defaultLangs);
    } else {
      setSelectedLanguages(['en', 'ja']);
    }
  }, [newProductCode]);

  // Update languages when product changes - for PDF form
  useEffect(() => {
    if (pdfProductCode) {
      const defaultLangs = getDefaultLanguagesForProduct(pdfProductCode);
      setPdfSelectedLanguages(defaultLangs);
    } else {
      setPdfSelectedLanguages(['en', 'ja']);
    }
  }, [pdfProductCode]);

  // Auto-translate when source text or languages change (with debounce)
  useEffect(() => {
    if (!newSourceText.trim() || newSourceText.length < 2) {
      setAiTranslations({});
      setShowPreview(false);
      return;
    }
    
    // Skip if no languages selected
    if (!selectedLanguages || selectedLanguages.length === 0) {
      return;
    }

    const timer = setTimeout(() => {
      handleAutoTranslate();
    }, 800);

    return () => clearTimeout(timer);
  }, [newSourceText, newContext, selectedLanguages]);

  const handleAutoTranslate = async () => {
    if (!newSourceText.trim()) return;
    
    // Validate languages
    if (!selectedLanguages || selectedLanguages.length === 0) {
      console.log('[AutoTranslate] No languages selected, skipping');
      return;
    }
    
    setIsTranslating(true);
    console.log('[AutoTranslate] Starting with languages:', selectedLanguages);
    
    try {
      const requestBody = {
        sourceText: newSourceText.trim(),
        context: newContext.trim() || undefined,
        targetLanguages: selectedLanguages,
      };
      console.log('[AutoTranslate] Request:', requestBody);
      
      const result = await apiPost<{
        translations: { languageCode: string; translatedText: string }[];
        provider: string;
      }>('/api/ai/translate', requestBody);

      console.log('[AutoTranslate] Success:', result);
      
      const translationsMap: Record<string, string> = {};
      result.translations.forEach((t) => {
        translationsMap[t.languageCode] = t.translatedText;
      });
      
      setAiTranslations(translationsMap);
      setShowPreview(true);
    } catch (error) {
      console.error('[AutoTranslate] Error:', error);
      // Silent fail - don't show error for auto-translate
    } finally {
      setIsTranslating(false);
    }
  };

  const handleCreate = async () => {
    if (selectedLanguages.length === 0) {
      setPdfError('번역 언어를 최소 1개 이상 선택해주세요.');
      return;
    }
    
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      // Create translation first
      const success = await onCreate(newSourceText, newContext, newVersion, newProductCode, newScope, newPriority, selectedLanguages, selectedPlatforms, newCompletionDate);
      
      if (success) {
        showSuccess('번역이 생성되었습니다.');
        resetManualForm();
        onClose();
      }
    } catch (error) {
      console.error('Create error:', error);
      showError('번역 생성에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePDFUpload = async () => {
    if (!onPDFUpload || pdfFiles.length === 0) return;

    if (pdfSelectedLanguages.length === 0) {
      setPdfError('번역 언어를 최소 1개 이상 선택해주세요.');
      return;
    }

    setPdfError('');
    setUploading(true);
    try {
      await onPDFUpload(pdfFiles, pdfVersion, pdfProductCode, pdfScope, pdfPriority, pdfSelectedLanguages, pdfSelectedPlatforms, pdfCompletionDate);
      resetPDFForm();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'PDF 업로드 중 오류가 발생했습니다.';
      setPdfError(message);
      console.error('PDF upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  const resetManualForm = () => {
    setNewSourceText('');
    setNewContext('');
    setNewVersion('');
    setNewProductCode('');
    setNewScope('');
    setNewPriority('medium');
    setSelectedLanguages(['en', 'ja']);
    setSelectedPlatforms([]);
    setNewCompletionDate('');
    setAiTranslations({});
    setShowPreview(false);
  };

  const resetPDFForm = () => {
    setPdfFiles([]);
    setPdfVersion('');
    setPdfProductCode('');
    setPdfScope('');
    setPdfPriority('medium');
    setPdfSelectedLanguages(['en', 'ja']);
    setPdfSelectedPlatforms([]);
    setPdfCompletionDate('');
    setPdfError('');
  };

  const handleClose = () => {
    resetManualForm();
    resetPDFForm();
    setActiveTab('manual');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="새 번역 추가"
      size="3xl"
    >
      {/* Tabs */}
      <div className="border-b border-gray-200 mb-4">
        <nav className="-mb-px flex space-x-4" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('manual')}
            className={`
              whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors
              ${
                activeTab === 'manual'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            직접 등록
          </button>
          <button
            onClick={() => setActiveTab('pdf')}
            className={`
              whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors
              ${
                activeTab === 'pdf'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            PDF 업로드
          </button>
        </nav>
      </div>

      {/* Manual Tab Content */}
      {activeTab === 'manual' && (
        <div className="space-y-4">
          <TranslationFormFields
            priority={newPriority}
            productCode={newProductCode}
            scope={newScope}
            selectedLanguages={selectedLanguages}
            completionDate={newCompletionDate}
            selectedPlatforms={selectedPlatforms}
            version={newVersion}
            onPriorityChange={setNewPriority}
            onProductCodeChange={setNewProductCode}
            onScopeChange={setNewScope}
            onLanguagesChange={setSelectedLanguages}
            onCompletionDateChange={setNewCompletionDate}
            onPlatformsChange={setSelectedPlatforms}
            onVersionChange={setNewVersion}
          />
          <Input
            label="원문"
            value={newSourceText}
            onChange={(e) => setNewSourceText(e.target.value)}
            placeholder="번역할 텍스트를 입력하세요"
            required
          />
          <Input
            label="문맥/설명"
            value={newContext}
            onChange={(e) => setNewContext(e.target.value)}
            placeholder="이 텍스트가 사용되는 화면이나 상황을 설명하세요"
          />

          {/* AI Translation Preview */}
          {showPreview && Object.keys(aiTranslations).length > 0 && (
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  AI 자동 번역 미리보기
                </h4>
                {isTranslating && (
                  <span className="text-xs text-blue-600 animate-pulse">번역 중...</span>
                )}
              </div>
              <div className="space-y-2">
                {selectedLanguages.map((lang) => (
                  <div key={lang} className="bg-white rounded p-2.5 border border-blue-100">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-500 w-24 shrink-0">
                        {LANGUAGE_LABELS[lang] || lang}
                      </span>
                      <p className="text-sm text-gray-800">
                        {aiTranslations[lang] || (
                          <span className="text-gray-400 italic">번역 중...</span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-blue-600 mt-2">
                * AI 번역 결과는 저장 후에도 수정할 수 있습니다.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={handleClose}>
              취소
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={!newSourceText.trim() || !newScope || selectedLanguages.length === 0 || isSubmitting}
              loading={isSubmitting}
            >
              {isSubmitting ? '생성 중...' : 'AI 번역하고 추가'}
            </Button>
          </div>
        </div>
      )}

      {/* PDF Tab Content */}
      {activeTab === 'pdf' && (
        <div className="space-y-4">
          <TranslationFormFields
            priority={pdfPriority}
            productCode={pdfProductCode}
            scope={pdfScope}
            selectedLanguages={pdfSelectedLanguages}
            completionDate={pdfCompletionDate}
            selectedPlatforms={pdfSelectedPlatforms}
            version={pdfVersion}
            onPriorityChange={setPdfPriority}
            onProductCodeChange={setPdfProductCode}
            onScopeChange={setPdfScope}
            onLanguagesChange={setPdfSelectedLanguages}
            onCompletionDateChange={setPdfCompletionDate}
            onPlatformsChange={setPdfSelectedPlatforms}
            onVersionChange={setPdfVersion}
          />

          <div>
            <label className="block text-sm font-semibold text-text-main mb-2">
              PDF 파일<span className="text-red-500 ml-1">*</span>
            </label>
            <FileUploader
              onFilesChange={setPdfFiles}
              maxFiles={5}
            />
          </div>

          {pdfError && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
              {pdfError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={handleClose}>
              취소
            </Button>
            <Button
              onClick={handlePDFUpload}
              disabled={pdfFiles.length === 0 || uploading || !pdfScope || pdfSelectedLanguages.length === 0}
            >
              {uploading ? '업로드 중...' : '업로드'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
