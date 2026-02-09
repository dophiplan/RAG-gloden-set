'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import FileUploader, { UploadedFile } from '@/components/FileUploader';
import LanguageCheckboxGroup from '@/components/LanguageCheckboxGroup';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { ProductCode, PriorityLevel, LanguageCode } from '@/types';
import { PRODUCT_SELECT_OPTIONS, SCOPE_OPTIONS, PRIORITY_OPTIONS } from '@/lib/constants';
import { getDefaultLanguagesForProduct, getAllSelectableLanguages } from '@/lib/product-languages';
import { showError, showSuccess } from '@/lib/notifications';

interface ParseResult {
  success: boolean;
  summary?: {
    total: number;
    successful: number;
    failed: number;
    totalTexts: number;
  };
  results?: Array<{
    fileName: string;
    success: boolean;
    texts?: string[];
    error?: string;
  }>;
  extracted_texts?: string[];
  total_extracted?: number;
  issues_created?: Array<{
    id: string;
    title: string;
    description: string;
  }>;
  error?: string;
}

export default function UploadPage() {
  const router = useRouter();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [scope, setScope] = useState<'SaaS' | 'Solution' | ''>('');
  const [productCode, setProductCode] = useState<ProductCode | ''>('');
  const [version, setVersion] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('중');
  const [selectedLanguages, setSelectedLanguages] = useState<LanguageCode[]>(['en', 'ja']);
  const [isUploading, setIsUploading] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTexts, setSelectedTexts] = useState<Set<number>>(new Set());

  // Update languages when product changes
  useEffect(() => {
    if (productCode) {
      const defaultLangs = getDefaultLanguagesForProduct(productCode);
      setSelectedLanguages(defaultLangs);
    } else {
      setSelectedLanguages(['en', 'ja']);
    }
  }, [productCode]);

  const handleFilesChange = (files: UploadedFile[]) => {
    setUploadedFiles(files);
    setParseResult(null);
    setError(null);
    setSelectedTexts(new Set());
  };

  // Auto-select all texts when parse result is available
  useEffect(() => {
    if (parseResult && parseResult.results) {
      const allTexts: string[] = [];
      parseResult.results.forEach((result) => {
        if (result.success && result.texts && Array.isArray(result.texts)) {
          allTexts.push(...result.texts);
        }
      });
      // Select all by default
      setSelectedTexts(new Set(allTexts.map((_, index) => index)));
    }
  }, [parseResult]);

  const handleParse = async () => {
    if (uploadedFiles.length === 0) {
      showError('파일을 업로드해주세요.');
      return;
    }

    if (!productCode) {
      showError('제품을 선택해주세요.');
      return;
    }

    if (!scope) {
      showError('제품 분류를 선택해주세요.');
      return;
    }

    setIsUploading(true);
    setError(null);
    setParseResult(null);

    try {
      const formData = new FormData();

      // Append all files
      uploadedFiles.forEach((uploadedFile) => {
        formData.append('files', uploadedFile.file);
      });

      // Append metadata
      if (scope) formData.append('scope', scope);
      if (productCode) formData.append('product_code', productCode);
      if (version) formData.append('version', version);

      const response = await fetch('/api/files/parse', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '파일 파싱에 실패했습니다.');
      }

      setParseResult(data);

      // Calculate total extracted texts
      const totalTexts = data.summary?.totalTexts || 0;

      // If parsing was successful, show success message
      if (data.success && totalTexts > 0) {
        showSuccess(`${totalTexts}개의 텍스트가 추출되었습니다.`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '오류가 발생했습니다.';
      setError(errorMsg);
      showError(errorMsg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleViewIssues = () => {
    router.push('/issues');
  };

  const handleAddTranslations = async () => {
    if (!parseResult) return;

    // Collect all extracted texts from results
    const allTexts: string[] = [];
    if (parseResult.results && Array.isArray(parseResult.results)) {
      parseResult.results.forEach((result) => {
        if (result.success && result.texts && Array.isArray(result.texts)) {
          allTexts.push(...result.texts);
        }
      });
    }

    // Filter only selected texts
    const selectedTextsArray = allTexts.filter((_, index) => selectedTexts.has(index));

    if (selectedTextsArray.length === 0) {
      showError('선택된 텍스트가 없습니다.');
      return;
    }

    if (!scope) {
      showError('제품 분류를 선택해주세요.');
      return;
    }

    if (selectedLanguages.length === 0) {
      showError('번역 언어를 최소 1개 이상 선택해주세요.');
      return;
    }

    try {
      // Save to database using bulk create API
      const response = await fetch('/api/translations/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: selectedTextsArray,
          version: version || undefined,
          product_code: productCode || undefined,
          scope: scope || undefined,
          priority: priority,
          languages: selectedLanguages,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('API Error:', error);
        const errorMessage = error.details
          ? `${error.error}\n상세: ${error.details}`
          : error.error || '번역 항목 저장 중 오류가 발생했습니다.';
        showError(errorMessage);
        return;
      }

      const data = await response.json();
      console.log('Bulk create success:', data);
      showSuccess(`${data.created}개의 번역 항목이 추가되었습니다.`);

      // Navigate with refresh flag to force data reload
      // Timestamp ensures URL change triggers useEffect
      if (productCode) {
        router.push(`/translations?product=${productCode}&refresh=${Date.now()}`);
      } else {
        router.push(`/translations?refresh=${Date.now()}`);
      }
    } catch (error) {
      console.error('Error adding translations:', error);
      showError('번역 항목 추가 중 오류가 발생했습니다.');
    }
  };

  return (
    <DashboardLayout
      title="PDF 업로드"
      subtitle="기획서 PDF 또는 이미지를 업로드하면 따옴표로 감싼 텍스트를 자동으로 추출합니다. 파싱에 실패한 경우 이슈로 등록되어 나중에 확인할 수 있습니다."
    >
      <div className="w-full">
        {/* 2-Column Layout: Configuration + File Upload */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Left: Configuration */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">파일 정보</h3>
            <div className="space-y-4">
              {/* 2x2 Grid for basic fields */}
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="제품 *"
                  value={productCode}
                  onChange={(e) => setProductCode(e.target.value as ProductCode | '')}
                  options={PRODUCT_SELECT_OPTIONS}
                />
                <Select
                  label="제품 분류 *"
                  value={scope}
                  onChange={(e) => setScope(e.target.value as 'SaaS' | 'Solution' | '')}
                  options={SCOPE_OPTIONS}
                />
                <Input
                  label="버전"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="예: 2.0.0"
                />
                <Select
                  label="중요도"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                  options={PRIORITY_OPTIONS}
                />
              </div>
              {/* Language selection - full width */}
              <LanguageCheckboxGroup
                selectedLanguages={selectedLanguages}
                onChange={setSelectedLanguages}
                availableLanguages={getAllSelectableLanguages()}
                label="번역 언어 선택"
                required={true}
              />
            </div>
          </Card>

          {/* Right: File Uploader */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">파일 업로드</h3>
            <FileUploader
              onFilesChange={handleFilesChange}
              maxFiles={5}
            />

            {/* Upload Button - shown when files are uploaded */}
            {uploadedFiles.length > 0 && (
              <div className="mt-6 pt-6 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">
                      {uploadedFiles.length}개 파일 준비됨
                    </p>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {scope && (
                        <Badge variant="info">
                          {scope}
                        </Badge>
                      )}
                      {productCode && (
                        <Badge variant="success">
                          {productCode}
                        </Badge>
                      )}
                      {version && (
                        <Badge variant="warning">
                          v{version}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={handleParse}
                    loading={isUploading}
                    disabled={isUploading || !productCode || !scope}
                  >
                    {isUploading ? '파싱 중...' : '파일 파싱'}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="flex-1">
                <p className="text-sm text-red-700">{error}</p>
                {parseResult?.issues_created && parseResult.issues_created.length > 0 && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleViewIssues}
                    className="mt-3"
                  >
                    이슈 확인
                  </Button>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Parse Results */}
        {parseResult && parseResult.success && (
          <Card>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">파싱 완료</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {parseResult.summary?.totalTexts || 0}개의 텍스트를 추출했습니다.
                  </p>
                </div>
                <Badge variant="success">완료</Badge>
              </div>

              {/* Issues Created */}
              {parseResult.issues_created && parseResult.issues_created.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-yellow-800 mb-1">
                        파싱 실패 항목이 이슈로 등록되었습니다
                      </h4>
                      <p className="text-sm text-yellow-700 mb-2">
                        {parseResult.issues_created.length}개의 이슈가 생성되었습니다.
                      </p>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleViewIssues}
                      >
                        이슈 확인
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Extracted Texts Preview */}
              {(() => {
                const allTexts: string[] = [];
                if (parseResult.results && Array.isArray(parseResult.results)) {
                  parseResult.results.forEach((result) => {
                    if (result.success && result.texts && Array.isArray(result.texts)) {
                      allTexts.push(...result.texts);
                    }
                  });
                }

                const allSelected = allTexts.length > 0 && selectedTexts.size === allTexts.length;
                const toggleAll = () => {
                  if (allSelected) {
                    setSelectedTexts(new Set());
                  } else {
                    setSelectedTexts(new Set(allTexts.map((_, index) => index)));
                  }
                };

                const toggleText = (index: number) => {
                  const newSelected = new Set(selectedTexts);
                  if (newSelected.has(index)) {
                    newSelected.delete(index);
                  } else {
                    newSelected.add(index);
                  }
                  setSelectedTexts(newSelected);
                };

                return allTexts.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-gray-700">
                        추출된 텍스트 ({selectedTexts.size}개 선택됨)
                      </h4>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleAll}
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-600">전체 선택</span>
                      </label>
                    </div>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {allTexts.map((text, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedTexts.has(index)}
                            onChange={() => toggleText(index)}
                            className="mt-0.5 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                          />
                          <p className="text-sm text-gray-900 flex-1">{text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  onClick={handleAddTranslations}
                  disabled={selectedTexts.size === 0}
                >
                  번역 항목으로 추가 ({selectedTexts.size}개)
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setUploadedFiles([]);
                    setParseResult(null);
                    setError(null);
                    setSelectedTexts(new Set());
                  }}
                >
                  초기화
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
