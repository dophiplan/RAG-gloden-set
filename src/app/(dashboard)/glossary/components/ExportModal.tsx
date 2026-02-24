'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { LanguageCode, ProductCode } from '@/types';
import { apiFetch } from '@/lib/api-utils';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFilters: {
    language?: LanguageCode | null;
    product_code?: ProductCode | null;
    source_type?: string | null;
    imported_after?: string | null;
    imported_before?: string | null;
    search?: string | null;
  };
  totalCount: number;
}

export default function ExportModal({
  isOpen,
  onClose,
  currentFilters,
  totalCount,
}: ExportModalProps) {
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);

    try {
      const params = new URLSearchParams();

      if (currentFilters.language) {
        params.append('language', currentFilters.language);
      }
      if (currentFilters.product_code) {
        params.append('product_code', currentFilters.product_code);
      }
      if (currentFilters.source_type) {
        params.append('source_type', currentFilters.source_type);
      }
      if (currentFilters.imported_after) {
        params.append('imported_after', currentFilters.imported_after);
      }
      if (currentFilters.imported_before) {
        params.append('imported_before', currentFilters.imported_before);
      }
      if (currentFilters.search) {
        params.append('search', currentFilters.search);
      }
      params.append('include_metadata', includeMetadata.toString());

      const response = await fetch(`/api/glossary/export?${params.toString()}`);

      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Extract filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : 'glossary_export.xlsx';

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      onClose();
    } catch (error) {
      console.error('Export error:', error);
      alert(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const getFilterSummary = () => {
    const filters: string[] = [];

    if (currentFilters.language) {
      filters.push(`언어: ${currentFilters.language.toUpperCase()}`);
    }
    if (currentFilters.product_code) {
      filters.push(`제품: ${currentFilters.product_code}`);
    }
    if (currentFilters.source_type) {
      const sourceTypeLabels: Record<string, string> = {
        manual: '수동',
        excel_import: 'Excel',
        ai_generated: 'AI',
      };
      filters.push(`출처: ${sourceTypeLabels[currentFilters.source_type] || currentFilters.source_type}`);
    }
    if (currentFilters.imported_after || currentFilters.imported_before) {
      const dateRange = [];
      if (currentFilters.imported_after) {
        dateRange.push(`${currentFilters.imported_after}부터`);
      }
      if (currentFilters.imported_before) {
        dateRange.push(`${currentFilters.imported_before}까지`);
      }
      filters.push(`기간: ${dateRange.join(' ')}`);
    }
    if (currentFilters.search) {
      filters.push(`검색: "${currentFilters.search}"`);
    }

    return filters.length > 0 ? filters : ['필터 없음 (전체 용어집)'];
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="용어집 내보내기">
      <div className="space-y-4">
        {/* Filter Summary */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-2">현재 필터</h3>
          <ul className="text-sm text-gray-700 space-y-1">
            {getFilterSummary().map((filter, index) => (
              <li key={index}>• {filter}</li>
            ))}
          </ul>
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-sm font-semibold text-indigo-600">
              내보낼 항목: {totalCount}개
            </p>
          </div>
        </div>

        {/* Options */}
        <div>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={includeMetadata}
              onChange={(e) => setIncludeMetadata(e.target.checked)}
              className="w-4 h-4 mt-0.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">
                메타데이터 포함
              </span>
              <p className="text-xs text-gray-500 mt-1">
                출처, 사용 횟수, 추가 날짜, 생성 날짜를 포함합니다.
              </p>
            </div>
          </label>
        </div>

        {/* Excel Format Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">📊 포함될 컬럼</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• term (용어)</li>
            <li>• translation (번역)</li>
            <li>• language_code (언어 코드)</li>
            <li>• product_code (제품 코드)</li>
            <li>• context (설명)</li>
            {includeMetadata && (
              <>
                <li>• source_type (출처)</li>
                <li>• imported_at (추가 날짜)</li>
                <li>• hit_count (사용 횟수)</li>
                <li>• created_at (생성 날짜)</li>
              </>
            )}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary" onClick={onClose} disabled={isExporting}>
            취소
          </Button>
          <Button onClick={handleExport} loading={isExporting}>
            {isExporting ? '내보내는 중...' : 'Excel 다운로드'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
