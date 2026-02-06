'use client';

import { useState, useCallback } from 'react';
import Button from './ui/Button';
import Card from './ui/Card';
import Badge from './ui/Badge';
import Input from './ui/Input';
import Select from './ui/Select';
import { ExtractedText, DuplicateCheckResult, PRODUCTS, ProductCode } from '@/types';

// Maximum file size: 45MB
const MAX_FILE_SIZE = 45 * 1024 * 1024;

interface PDFUploaderProps {
  onExtracted?: (texts: ExtractedText[]) => void;
  onDuplicateCheck?: (results: DuplicateCheckResult[]) => void;
}

const productOptions = [
  { value: '', label: '제품 선택 *' },
  ...Object.entries(PRODUCTS).map(([code, name]) => ({
    value: code,
    label: name,
  })),
];

export default function PDFUploader({ onExtracted, onDuplicateCheck }: PDFUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedTexts, setExtractedTexts] = useState<ExtractedText[]>([]);
  const [duplicateResults, setDuplicateResults] = useState<DuplicateCheckResult[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [version, setVersion] = useState<string>('');
  const [productCode, setProductCode] = useState<ProductCode | ''>('');

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFile = async (file: File) => {
    if (!file.type.includes('pdf')) {
      setError('PDF 파일만 업로드 가능합니다.');
      return;
    }

    // Check file size before upload
    if (file.size > MAX_FILE_SIZE) {
      const sizeInMB = (file.size / 1024 / 1024).toFixed(2);
      alert(`파일 크기는 45MB를 초과할 수 없습니다.\n현재 파일 크기: ${sizeInMB}MB`);
      return;
    }

    if (!productCode) {
      setError('제품을 선택해주세요.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setFileName(file.name);

    // Log upload info
    console.log('=== PDF Upload Start (Client) ===');
    console.log('File name:', file.name);
    console.log('File size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
    console.time('upload-time');

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Parse PDF
      const parseResponse = await fetch('/api/pdf/parse', {
        method: 'POST',
        body: formData,
      });

      if (!parseResponse.ok) {
        const errorData = await parseResponse.json();
        throw new Error(errorData.error || 'PDF 파싱 실패');
      }

      const parseData = await parseResponse.json();
      console.timeEnd('upload-time');
      console.log('PDF Parse Result:', parseData);
      console.log('Processing time (server):', parseData.processingTime, 's');
      console.log('Extracted texts:', parseData.totalExtracted);
      console.log('=== PDF Upload End (Client) ===');

      setExtractedTexts(parseData.texts || []);
      onExtracted?.(parseData.texts || []);

      // Check duplicates
      if (parseData.texts.length > 0) {
        const duplicateResponse = await fetch('/api/translations/check-duplicates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            texts: parseData.texts.map((t: ExtractedText) => t.text),
            product_code: productCode,
          }),
        });

        if (duplicateResponse.ok) {
          const duplicateData = await duplicateResponse.json();
          setDuplicateResults(duplicateData.results);
          onDuplicateCheck?.(duplicateData.results);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  }, [productCode]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [productCode]);

  const getDuplicateStatus = (text: string) => {
    return duplicateResults.find((r) => r.text === text);
  };

  const handleAddTranslations = () => {
    const newTexts = duplicateResults
      .filter((r) => r.status === 'new')
      .map((r) => r.text);

    if (newTexts.length > 0) {
      const params = new URLSearchParams();
      params.set('new', encodeURIComponent(JSON.stringify(newTexts)));
      if (version) params.set('version', version);
      if (productCode) params.set('product', productCode);
      window.location.href = `/translations?${params}`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Version and Product Selection */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="제품 *"
            value={productCode}
            onChange={(e) => setProductCode(e.target.value as ProductCode | '')}
            options={productOptions}
          />
          <Input
            label="버전"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="예: 2.0.0, 1.9.1"
          />
        </div>
      </Card>

      {/* Upload Area */}
      <Card padding="none">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative p-8 border-2 border-dashed rounded-lg transition-colors cursor-pointer
            ${isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
            }
            ${!productCode ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            disabled={!productCode}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />

          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-600">
              {productCode
                ? 'PDF 파일을 드래그하거나 클릭하여 업로드'
                : '먼저 제품을 선택해주세요'}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              따옴표(&apos; &apos; 또는 &quot; &quot;)로 감싼 텍스트가 추출됩니다
            </p>
            <p className="mt-1 text-xs font-medium text-gray-700">
              최대 용량: 45MB
            </p>
          </div>
        </div>
      </Card>

      {/* Loading */}
      {isLoading && (
        <Card>
          <div className="flex items-center justify-center py-8">
            <svg
              className="animate-spin h-8 w-8 text-blue-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="ml-3 text-gray-600">PDF 분석 중...</span>
          </div>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <p className="text-red-700">{error}</p>
        </Card>
      )}

      {/* Results */}
      {extractedTexts.length > 0 && !isLoading && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">추출된 텍스트</h3>
              <div className="flex items-center gap-2 mt-1">
                {fileName && (
                  <span className="text-sm text-gray-500">{fileName}</span>
                )}
                {productCode && (
                  <Badge variant="info">{PRODUCTS[productCode]}</Badge>
                )}
                {version && (
                  <Badge variant="warning">v{version}</Badge>
                )}
              </div>
            </div>
            <Badge variant="info">{extractedTexts.length}개 추출</Badge>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {extractedTexts.map((item, index) => {
              const duplicateStatus = getDuplicateStatus(item.text);

              return (
                <div
                  key={index}
                  className={`
                    flex items-start justify-between p-3 rounded-lg border
                    ${duplicateStatus?.status === 'exact_match'
                      ? 'bg-green-50 border-green-200'
                      : duplicateStatus?.status === 'similar'
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-gray-50 border-gray-200'
                    }
                  `}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 break-words">{item.text}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Line {item.lineNumber} • {item.matchType === 'single_quote' ? '작은따옴표' : '큰따옴표'}
                    </p>
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    {duplicateStatus?.status === 'exact_match' && (
                      <Badge variant="success">이미 번역됨</Badge>
                    )}
                    {duplicateStatus?.status === 'similar' && (
                      <Badge variant="warning">
                        유사 {Math.round((duplicateStatus.similarity || 0) * 100)}%
                      </Badge>
                    )}
                    {duplicateStatus?.status === 'new' && (
                      <Badge variant="info">번역 필요</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          {duplicateResults.length > 0 && (
            <div className="mt-4 pt-4 border-t flex gap-4 text-sm">
              <span className="text-green-600">
                이미 번역됨: {duplicateResults.filter((r) => r.status === 'exact_match').length}
              </span>
              <span className="text-yellow-600">
                유사 번역: {duplicateResults.filter((r) => r.status === 'similar').length}
              </span>
              <span className="text-blue-600">
                신규: {duplicateResults.filter((r) => r.status === 'new').length}
              </span>
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-4 pt-4 border-t flex gap-3">
            <Button onClick={handleAddTranslations}>
              신규 번역 추가
            </Button>
            <Button variant="secondary" onClick={() => {
              setExtractedTexts([]);
              setDuplicateResults([]);
              setFileName(null);
            }}>
              초기화
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
