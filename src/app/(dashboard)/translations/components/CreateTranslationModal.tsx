import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import FileUploader, { UploadedFile } from '@/components/FileUploader';
import TranslationFormFields from '@/components/translations/TranslationFormFields';
import { ProductCode, PriorityLevel, LanguageCode, ScopeType } from '@/types';
import { getDefaultLanguagesForProduct } from '@/lib/product-languages';

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
  
  // Update product code when modal opens with new initial value
  useEffect(() => {
    if (isOpen && initialProductCode) {
      setNewProductCode(initialProductCode);
      setPdfProductCode(initialProductCode);
    }
  }, [isOpen, initialProductCode]);
  const [pdfError, setPdfError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleCreate = async () => {
    if (selectedLanguages.length === 0) {
      setPdfError('번역 언어를 최소 1개 이상 선택해주세요.');
      return;
    }
    
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const success = await onCreate(newSourceText, newContext, newVersion, newProductCode, newScope, newPriority, selectedLanguages, selectedPlatforms, newCompletionDate);
      if (success) {
        resetManualForm();
        onClose();
      }
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

    setPdfError('');  // 에러 초기화
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

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={handleClose}>
              취소
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={!newSourceText.trim() || !newScope || selectedLanguages.length === 0 || isSubmitting}
              loading={isSubmitting}
            >
              {isSubmitting ? '생성 중...' : '추가'}
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
