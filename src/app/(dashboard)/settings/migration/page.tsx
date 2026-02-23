'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { ProductCode } from '@/types';
import { useProducts } from '@/hooks/useReferenceData';
import MigrationPreviewTable from './components/MigrationPreviewTable';

interface PreviewEntry {
  id: string;
  source_text: string;
  context?: string;
  translations: Record<string, string>;
  suggested_category: 'glossary' | 'translation';
  word_count: number;
  duplicate_status: {
    status: 'exact' | 'similar' | 'new';
    similarity?: number;
    existing_id?: string;
    existing_translations?: Record<string, string>;
  };
  category?: 'glossary' | 'translation'; // User-modified category
  action?: 'import' | 'skip' | 'merge' | 'overwrite';
}

interface Summary {
  total: number;
  glossary_suggested: number;
  translation_suggested: number;
  exact_matches: number;
  similar_matches: number;
  new_entries: number;
}

type Step = 'upload' | 'preview' | 'confirm';

export default function MigrationPage() {
  const router = useRouter();
  const { products, productsMap } = useProducts();
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [productCode, setProductCode] = useState<ProductCode | 'ALL'>('ALL');
  const [version, setVersion] = useState('');
  const [entries, setEntries] = useState<PreviewEntry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasIssues, setHasIssues] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
    }
  };

  // Page-wide drag and drop handlers
  React.useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragCounter(prev => {
        const newCount = prev + 1;
        if (newCount === 1 && e.dataTransfer?.types.includes('Files')) {
          setIsDragging(true);
        }
        return newCount;
      });
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragCounter(prev => {
        const newCount = prev - 1;
        if (newCount <= 0) {
          setIsDragging(false);
          return 0;
        }
        return newCount;
      });
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragCounter(0);
      setIsDragging(false);

      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length > 0) {
        const file = files[0];
        if (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          setFile(file);
          setError('');
        } else {
          setError('CSV 또는 Excel 파일만 업로드 가능합니다.');
        }
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDragCounter(0);
        setIsDragging(false);
      }
    };

    window.addEventListener('dragenter', handleDragEnter as any);
    window.addEventListener('dragover', handleDragOver as any);
    window.addEventListener('dragleave', handleDragLeave as any);
    window.addEventListener('drop', handleDrop as any);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter as any);
      window.removeEventListener('dragover', handleDragOver as any);
      window.removeEventListener('dragleave', handleDragLeave as any);
      window.removeEventListener('drop', handleDrop as any);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleUpload = async () => {
    if (!file) {
      setError('파일을 선택해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (mode === 'simple') {
        // Simple mode: Check for issues first
        // First, get preview to check for issues
        const previewFormData = new FormData();
        previewFormData.append('file', file);
        // If "ALL" is selected, pass empty string to indicate common terms
        previewFormData.append('product_code', productCode === 'ALL' ? '' : productCode);

        const previewResponse = await fetch('/api/migration/preview', {
          method: 'POST',
          body: previewFormData,
        });

        const previewData = await previewResponse.json();

        if (!previewResponse.ok) {
          throw new Error(previewData.error || '파일 처리 중 오류가 발생했습니다.');
        }

        // Check if there are any issues (duplicates or similar)
        const hasDuplicates = previewData.summary.exact_matches > 0;
        const hasSimilar = previewData.summary.similar_matches > 0;

        const hasAnyIssues = hasDuplicates || hasSimilar;

        if (hasAnyIssues) {
          // Show preview for review
          const initializedEntries = previewData.entries.map((entry: PreviewEntry) => ({
            ...entry,
            category: entry.suggested_category,
            action: entry.duplicate_status.status === 'exact' ? 'skip' : 'import',
          }));

          setEntries(initializedEntries);
          setSummary(previewData.summary);
          setHasIssues(true);
          setStep('preview');
        } else {
          // No issues - direct import
          const formData = new FormData();
          formData.append('file', file);
          formData.append('product_code', productCode === 'ALL' ? '' : productCode);
          formData.append('mode', 'simple');

          const response = await fetch('/api/migration/commit', {
            method: 'POST',
            body: formData,
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || '가져오기 중 오류가 발생했습니다.');
          }

          alert(
            `✅ 가져오기 완료!\n\n` +
            `용어집: ${data.glossary.created}개 추가`
          );

          router.push('/glossary');
        }
      } else {
        // Advanced mode: Show preview
        const formData = new FormData();
        formData.append('file', file);
        formData.append('product_code', productCode === 'ALL' ? '' : productCode);

        const response = await fetch('/api/migration/preview', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || '미리보기 중 오류가 발생했습니다.');
        }

        // Initialize category and action for each entry
        const initializedEntries = data.entries.map((entry: PreviewEntry) => ({
          ...entry,
          category: entry.suggested_category,
          action: entry.duplicate_status.status === 'exact' ? 'skip' : 'import',
        }));

        setEntries(initializedEntries);
        setSummary(data.summary);
        setStep('preview');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/migration/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: entries.map((e) => ({
            id: e.id,
            source_text: e.source_text,
            context: e.context,
            translations: e.translations,
            category: e.category || e.suggested_category,
            action: e.action || 'import',
          })),
          product_code: productCode,
          version: version || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '마이그레이션 중 오류가 발생했습니다.');
      }

      // Show success message and redirect
      alert(
        `마이그레이션 완료!\n\n` +
        `용어집: ${data.glossary.created}개 생성, ${data.glossary.skipped}개 건너뜀\n` +
        `번역: ${data.translations.created}개 생성, ${data.translations.updated}개 업데이트, ${data.translations.skipped}개 건너뜀`
      );

      router.push('/translations');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateEntry = (id: string, updates: Partial<PreviewEntry>) => {
    setEntries((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, ...updates } : entry))
    );
  };

  const glossaryEntries = entries.filter((e) => (e.category || e.suggested_category) === 'glossary');
  const translationEntries = entries.filter((e) => (e.category || e.suggested_category) === 'translation');

  return (
    <DashboardLayout
      title="데이터 가져오기"
      subtitle="Excel/CSV 파일에서 용어집 및 번역 데이터를 가져옵니다."
    >
      {/* Page-wide drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-blue-500 bg-opacity-20 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-lg shadow-2xl p-8 border-4 border-dashed border-blue-500">
            <div className="flex flex-col items-center gap-4">
              <svg
                className="w-16 h-16 text-blue-500"
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
              <p className="text-xl font-semibold text-gray-900">파일을 여기에 드롭하세요</p>
              <p className="text-sm text-gray-600">CSV, Excel 파일 지원</p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">

      {/* Mode Toggle */}
      <div className="mb-6 flex items-center justify-center gap-2 p-1 bg-gray-100 rounded-lg w-fit mx-auto">
        <button
          onClick={() => setMode('simple')}
          className={`px-6 py-2 rounded-md font-medium transition-all ${
            mode === 'simple'
              ? 'bg-white text-[#818CF8] shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <span className="flex items-center gap-2">
            <span>⚡</span>
            <span>간단 모드</span>
          </span>
        </button>
        <button
          onClick={() => setMode('advanced')}
          className={`px-6 py-2 rounded-md font-medium transition-all ${
            mode === 'advanced'
              ? 'bg-white text-[#818CF8] shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <span className="flex items-center gap-2">
            <span>🔧</span>
            <span>고급 모드</span>
          </span>
        </button>
      </div>

      {/* Mode Description */}
      <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-xl">{mode === 'simple' ? '⚡' : '🔧'}</span>
          <p className="text-sm text-blue-900">
            {mode === 'simple'
              ? '간단 모드 - 용어집에 빠르게 추가합니다. 중복이 없으면 바로 가져오고, 중복이 있으면 확인 후 진행합니다.'
              : '고급 모드 - 미리보기를 통해 각 항목을 확인하고, 중복 처리 방법을 선택할 수 있습니다. (대량 데이터 마이그레이션용)'
            }
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      {mode === 'advanced' && (
      <div className="mb-8">
        <div className="flex items-center justify-center">
          {/* Step 1 */}
          <div className="flex items-center">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full ${
                step === 'upload'
                  ? 'bg-[#818CF8] text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              1
            </div>
            <span
              className={`ml-2 font-medium ${
                step === 'upload' ? 'text-[#818CF8]' : 'text-gray-600'
              }`}
            >
              업로드
            </span>
          </div>

          {/* Connector */}
          <div className="w-24 h-1 mx-4 bg-gray-200" />

          {/* Step 2 */}
          <div className="flex items-center">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full ${
                step === 'preview'
                  ? 'bg-[#818CF8] text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              2
            </div>
            <span
              className={`ml-2 font-medium ${
                step === 'preview' ? 'text-[#818CF8]' : 'text-gray-600'
              }`}
            >
              미리보기 및 분류
            </span>
          </div>

          {/* Connector */}
          <div className="w-24 h-1 mx-4 bg-gray-200" />

          {/* Step 3 */}
          <div className="flex items-center">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full ${
                step === 'confirm'
                  ? 'bg-[#818CF8] text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              3
            </div>
            <span
              className={`ml-2 font-medium ${
                step === 'confirm' ? 'text-[#818CF8]' : 'text-gray-600'
              }`}
            >
              확인 및 실행
            </span>
          </div>
        </div>
      </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">
            {mode === 'simple' ? '파일 선택' : '파일 업로드'}
          </h2>

          <div className="space-y-6">
            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Excel/CSV 파일 선택
              </label>

              {/* File upload area */}
              <div className="relative">
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  id="file-upload"
                  className="hidden"
                />
                <label
                  htmlFor="file-upload"
                  className="flex flex-col items-center justify-center w-full h-20 px-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 hover:border-[#818CF8] transition-all"
                >
                  <div className="flex flex-col items-center justify-center py-3">
                    <svg
                      className="w-8 h-8 mb-2 text-gray-400"
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
                    <p className="mb-1 text-sm text-gray-600">
                      <span className="font-semibold">클릭하여 파일 선택</span> 또는 드래그 앤 드롭
                    </p>
                    <p className="text-xs text-gray-500">CSV, XLSX, XLS 파일 지원</p>
                  </div>
                </label>
              </div>

              {/* Selected file display */}
              {file && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-sm font-medium text-blue-900">{file.name}</span>
                    <span className="text-xs text-blue-600">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      setFile(null);
                      setError('');
                    }}
                    className="text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {/* Product Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                제품 선택
              </label>
              <select
                value={productCode}
                onChange={(e) => setProductCode(e.target.value as ProductCode | 'ALL')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#818CF8] focus:border-transparent"
              >
                {mode === 'simple' && (
                  <option value="ALL">전체 (모든 제품 공통)</option>
                )}
                {products.map((product) => (
                  <option key={product.code} value={product.code}>
                    {product.name}
                  </option>
                ))}
              </select>
              {mode === 'simple' && productCode === 'ALL' && (
                <p className="mt-2 text-xs text-gray-500">
                  💡 모든 제품에서 공통으로 사용되는 용어입니다. (예: 로그인, 저장, 취소 등)
                </p>
              )}
            </div>

            {/* Version (Optional) - Only in advanced mode */}
            {mode === 'advanced' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  버전 (선택사항)
                </label>
                <input
                  type="text"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="예: v1.0.0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#818CF8] focus:border-transparent"
                />
              </div>
            )}

            {/* Upload Button */}
            <button
              onClick={handleUpload}
              disabled={!file || loading}
              className="w-full px-6 py-3 bg-[#818CF8] text-white font-semibold rounded-lg hover:bg-[#6366F1] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {loading
                ? (mode === 'simple' ? '가져오는 중...' : '처리 중...')
                : (mode === 'simple' ? '바로 가져오기' : '다음 단계')
              }
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 'preview' && summary && (
        <div>
          {mode === 'simple' && hasIssues ? (
            /* Simple Mode Preview - Only show issues */
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-2">⚠️ 확인이 필요한 항목이 있습니다</h2>
              <p className="text-sm text-gray-600 mb-6">
                파일에서 중복되거나 유사한 항목을 발견했습니다. 어떻게 처리할지 선택해주세요.
              </p>

              {/* Issue Summary */}
              <div className="space-y-4 mb-6">
                {summary.exact_matches > 0 && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">⚠️</span>
                      <div className="flex-1">
                        <h3 className="font-semibold text-yellow-900 mb-1">
                          중복 항목: {summary.exact_matches}개
                        </h3>
                        <p className="text-sm text-yellow-700">
                          이미 용어집에 동일한 항목이 있습니다.
                        </p>
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => {
                              setEntries(prev => prev.map(e =>
                                e.duplicate_status.status === 'exact' ? { ...e, action: 'overwrite' } : e
                              ));
                            }}
                            className="px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700"
                          >
                            덮어쓰기
                          </button>
                          <button
                            onClick={() => {
                              setEntries(prev => prev.map(e =>
                                e.duplicate_status.status === 'exact' ? { ...e, action: 'skip' } : e
                              ));
                            }}
                            className="px-3 py-1 text-sm border border-yellow-600 text-yellow-700 rounded hover:bg-yellow-50"
                          >
                            건너뛰기
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {summary.similar_matches > 0 && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">ℹ️</span>
                      <div className="flex-1">
                        <h3 className="font-semibold text-blue-900 mb-1">
                          유사 항목: {summary.similar_matches}개
                        </h3>
                        <p className="text-sm text-blue-700">
                          비슷한 항목이 있습니다. 새로운 항목으로 추가됩니다.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {summary.new_entries > 0 && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">✅</span>
                      <div className="flex-1">
                        <h3 className="font-semibold text-green-900 mb-1">
                          신규 항목: {summary.new_entries}개
                        </h3>
                        <p className="text-sm text-green-700">
                          새로운 항목이 용어집에 추가됩니다.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setStep('upload');
                    setHasIssues(false);
                  }}
                  className="px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={() => setStep('confirm')}
                  className="flex-1 px-6 py-3 bg-[#818CF8] text-white font-semibold rounded-lg hover:bg-[#6366F1]"
                >
                  확인하고 가져오기
                </button>
              </div>
            </div>
          ) : (
            /* Advanced Mode Preview - Full preview */
            <>
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">미리보기 및 분류</h2>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
                    <p className="text-sm text-gray-600">전체</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[#818CF8]">{glossaryEntries.length}</p>
                    <p className="text-sm text-gray-600">용어집</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[#6366F1]">{translationEntries.length}</p>
                    <p className="text-sm text-gray-600">번역</p>
                  </div>
                </div>
              </div>

              <MigrationPreviewTable
                glossaryEntries={glossaryEntries}
                translationEntries={translationEntries}
                onUpdateEntry={updateEntry}
              />

              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => setStep('upload')}
                  className="px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50"
                >
                  이전
                </button>
                <button
                  onClick={() => setStep('confirm')}
                  className="flex-1 px-6 py-3 bg-[#818CF8] text-white font-semibold rounded-lg hover:bg-[#6366F1]"
                >
                  다음 단계
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 'confirm' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">확인 및 실행</h2>

          <div className="space-y-4 mb-6">
            <div className="border-b pb-4">
              <h3 className="font-semibold text-gray-900 mb-2">용어집</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">추가</p>
                  <p className="text-lg font-semibold text-[#818CF8]">
                    {glossaryEntries.filter((e) => e.action === 'import' || e.action === 'merge' || e.action === 'overwrite').length}건
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">건너뛰기</p>
                  <p className="text-lg font-semibold text-gray-600">
                    {glossaryEntries.filter((e) => e.action === 'skip').length}건
                  </p>
                </div>
              </div>
            </div>

            <div className="border-b pb-4">
              <h3 className="font-semibold text-gray-900 mb-2">번역</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">추가</p>
                  <p className="text-lg font-semibold text-[#6366F1]">
                    {translationEntries.filter((e) => e.action === 'import').length}건
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">병합</p>
                  <p className="text-lg font-semibold text-blue-600">
                    {translationEntries.filter((e) => e.action === 'merge').length}건
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">건너뛰기</p>
                  <p className="text-lg font-semibold text-gray-600">
                    {translationEntries.filter((e) => e.action === 'skip').length}건
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-800">
              ⚠️ 마이그레이션을 실행하면 선택한 항목이 데이터베이스에 추가됩니다. 이 작업은 되돌릴 수 없습니다.
            </p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep('preview')}
              disabled={loading}
              className="px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              이전
            </button>
            <button
              onClick={handleCommit}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-[#818CF8] text-white font-semibold rounded-lg hover:bg-[#6366F1] disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {loading ? '마이그레이션 중...' : '마이그레이션 실행'}
            </button>
          </div>
        </div>
      )}
      </div>
    </DashboardLayout>
  );
}
