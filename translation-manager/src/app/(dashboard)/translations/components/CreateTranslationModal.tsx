import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import FileUploader, { UploadedFile } from '@/components/FileUploader';
import LanguageCheckboxGroup from '@/components/LanguageCheckboxGroup';
import { ProductCode, PriorityLevel, LanguageCode, ScopeType } from '@/types';
import { getDefaultLanguagesForProduct, getAllSelectableLanguages } from '@/lib/product-languages';
import { useProducts, useScopes, usePriorities } from '@/hooks/useReferenceData';

type TabType = 'manual' | 'pdf';

interface CreateTranslationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (
    sourceText: string,
    context: string,
    version: string,
    productCode: ProductCode | '',
    scope: ScopeType,
    priority: PriorityLevel,
    languages: LanguageCode[]
  ) => Promise<boolean | undefined>;
  onPDFUpload?: (
    files: UploadedFile[],
    version: string,
    productCode: ProductCode | '',
    scope: ScopeType,
    priority: PriorityLevel,
    languages: LanguageCode[]
  ) => Promise<void>;
}

export default function CreateTranslationModal({
  isOpen,
  onClose,
  onCreate,
  onPDFUpload,
}: CreateTranslationModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('manual');

  // Manual form states
  const [newSourceText, setNewSourceText] = useState('');
  const [newContext, setNewContext] = useState('');
  const [newVersion, setNewVersion] = useState('');
  const [newProductCode, setNewProductCode] = useState<ProductCode | ''>('');
  const [newScope, setNewScope] = useState<ScopeType>('');
  const [newPriority, setNewPriority] = useState<PriorityLevel>('중');
  const [selectedLanguages, setSelectedLanguages] = useState<LanguageCode[]>(['en', 'ja']);

  // PDF upload states
  const [pdfFiles, setPdfFiles] = useState<UploadedFile[]>([]);
  const [pdfVersion, setPdfVersion] = useState('');
  const [pdfProductCode, setPdfProductCode] = useState<ProductCode | ''>('');
  const [pdfScope, setPdfScope] = useState<ScopeType>('');
  const [pdfPriority, setPdfPriority] = useState<PriorityLevel>('중');
  const [pdfSelectedLanguages, setPdfSelectedLanguages] = useState<LanguageCode[]>(['en', 'ja']);
  const [uploading, setUploading] = useState(false);
  const [pdfError, setPdfError] = useState<string>('');

  // Fetch reference data from DB
  const { products } = useProducts();
  const { scopes } = useScopes();
  const { priorities } = usePriorities();

  // Generate select options dynamically
  const productSelectOptions = [
    { value: '', label: '제품 선택' },
    ...products.map(p => ({ value: p.code, label: p.name }))
  ];

  const scopeOptions = [
    { value: '', label: '제품 분류 선택 *' },
    ...scopes.map(s => ({ value: s.code, label: s.name }))
  ];

  const priorityOptions = priorities.map(p => ({
    value: p.code,
    label: p.label
  }));

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

    const success = await onCreate(newSourceText, newContext, newVersion, newProductCode, newScope, newPriority, selectedLanguages);
    if (success) {
      resetManualForm();
      onClose();
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
      await onPDFUpload(pdfFiles, pdfVersion, pdfProductCode, pdfScope, pdfPriority, pdfSelectedLanguages);
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
    setNewPriority('중');
    setSelectedLanguages(['en', 'ja']);
  };

  const resetPDFForm = () => {
    setPdfFiles([]);
    setPdfVersion('');
    setPdfProductCode('');
    setPdfScope('');
    setPdfPriority('중');
    setPdfSelectedLanguages(['en', 'ja']);
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
          <div className="grid grid-cols-4 gap-4">
            <Select
              label="제품"
              value={newProductCode}
              onChange={(e) => setNewProductCode(e.target.value as ProductCode | '')}
              options={productSelectOptions}
            />
            <Select
              label="제품 분류 *"
              value={newScope}
              onChange={(e) => setNewScope(e.target.value as ScopeType)}
              options={scopeOptions}
            />
            <Input
              label="버전"
              value={newVersion}
              onChange={(e) => setNewVersion(e.target.value)}
              placeholder="예: 2.0.0"
            />
            <Select
              label="중요도 *"
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value as PriorityLevel)}
              options={priorityOptions}
            />
          </div>
          <Input
            label="원문 *"
            value={newSourceText}
            onChange={(e) => setNewSourceText(e.target.value)}
            placeholder="번역할 텍스트를 입력하세요"
          />
          <Input
            label="문맥/설명"
            value={newContext}
            onChange={(e) => setNewContext(e.target.value)}
            placeholder="이 텍스트가 사용되는 화면이나 상황을 설명하세요"
          />
          <LanguageCheckboxGroup
            selectedLanguages={selectedLanguages}
            onChange={setSelectedLanguages}
            availableLanguages={getAllSelectableLanguages()}
            label="번역 언어 선택"
            required={true}
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={handleClose}>
              취소
            </Button>
            <Button onClick={handleCreate} disabled={!newSourceText.trim() || !newScope || selectedLanguages.length === 0}>
              추가
            </Button>
          </div>
        </div>
      )}

      {/* PDF Tab Content */}
      {activeTab === 'pdf' && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <Select
              label="제품"
              value={pdfProductCode}
              onChange={(e) => setPdfProductCode(e.target.value as ProductCode | '')}
              options={productSelectOptions}
            />
            <Select
              label="제품 분류 *"
              value={pdfScope}
              onChange={(e) => setPdfScope(e.target.value as ScopeType)}
              options={scopeOptions}
            />
            <Input
              label="버전"
              value={pdfVersion}
              onChange={(e) => setPdfVersion(e.target.value)}
              placeholder="예: 2.0.0"
            />
            <Select
              label="중요도 *"
              value={pdfPriority}
              onChange={(e) => setPdfPriority(e.target.value as PriorityLevel)}
              options={priorityOptions}
            />
          </div>

          <LanguageCheckboxGroup
            selectedLanguages={pdfSelectedLanguages}
            onChange={setPdfSelectedLanguages}
            availableLanguages={getAllSelectableLanguages()}
            label="번역 언어 선택"
            required={true}
          />

          <FileUploader
            onFilesChange={setPdfFiles}
            maxFiles={5}
          />

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
