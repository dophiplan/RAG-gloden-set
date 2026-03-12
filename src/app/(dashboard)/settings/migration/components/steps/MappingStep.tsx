'use client';

import React from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import { useTheme } from '@/context/ThemeContext';

interface MappingStepProps {
  sheetsData: Array<{ name: string; columns: string[]; rowCount: number }>;
  selectedSheet: string | null;
  fieldMapping: {
    source: string | null;
    translations: string[];
    metadata: Record<string, string>;
  };
  onSheetSelect: (sheet: string) => void;
  onUpdateMapping: (mapping: Partial<MappingStepProps['fieldMapping']>) => void;
  onAddTranslationColumn: () => void;
  onRemoveTranslationColumn: (index: number) => void;
  onClearMapping: () => void;
}

export default function MappingStep({
  sheetsData,
  selectedSheet,
  fieldMapping,
  onSheetSelect,
  onUpdateMapping,
  onAddTranslationColumn,
  onRemoveTranslationColumn,
  onClearMapping,
}: MappingStepProps) {
  const { theme } = useTheme();
  
  const currentSheet = sheetsData.find(s => s.name === selectedSheet);
  const columns = currentSheet?.columns || [];
  const hasMultipleSheets = sheetsData.length > 1;

  const isColumnMapped = (column: string): boolean => {
    return (
      fieldMapping.source === column ||
      fieldMapping.translations.includes(column) ||
      Object.values(fieldMapping.metadata).includes(column)
    );
  };

  const handleSourceSelect = (column: string) => {
    if (isColumnMapped(column) && fieldMapping.source !== column) return;
    onUpdateMapping({ source: column });
  };

  const handleTranslationToggle = (column: string) => {
    if (isColumnMapped(column) && !fieldMapping.translations.includes(column)) return;
    
    const newTranslations = fieldMapping.translations.includes(column)
      ? fieldMapping.translations.filter(t => t !== column)
      : [...fieldMapping.translations, column];
    onUpdateMapping({ translations: newTranslations });
  };

  const handleMetadataSelect = (key: string, column: string | null) => {
    if (column && isColumnMapped(column) && fieldMapping.metadata[key] !== column) return;
    
    const newMetadata = { ...fieldMapping.metadata };
    if (column) {
      newMetadata[key] = column;
    } else {
      delete newMetadata[key];
    }
    onUpdateMapping({ metadata: newMetadata });
  };

  const sheetOptions = [
    { value: '', label: '시트를 선택하세요' },
    ...sheetsData.map(sheet => ({
      value: sheet.name,
      label: `${sheet.name} (${sheet.columns.length}컬럼, ${sheet.rowCount}행)`,
    })),
  ];

  const columnOptions: Array<{ value: string; label: string; disabled?: boolean }> = [
    { value: '', label: '선택 안함' },
    ...columns.map(col => ({
      value: col,
      label: col,
      disabled: isColumnMapped(col),
    })),
  ];

  return (
    <Card className="w-full">
      {/* Card Header */}
      <div 
        className="flex items-center gap-3 px-6 py-4 rounded-t-xl"
        style={{ backgroundColor: '#818CF8' }}
      >
        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
          <span className="text-[#818CF8] font-semibold text-sm">2</span>
        </div>
        <h2 className="text-white font-semibold text-lg">정보 입력</h2>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Sheet Selector - only show for Excel with multiple sheets */}
        {hasMultipleSheets && (
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              시트 선택
              <span className="text-xs text-gray-500 font-normal ml-2">
                ({sheetsData.length}개 시트 감지됨)
              </span>
            </label>
            <Select
              value={selectedSheet || ''}
              onChange={(e) => onSheetSelect(e.target.value)}
              options={sheetOptions}
              className="w-full md:w-80"
            />
          </div>
        )}

        {/* Sheet Info */}
        {currentSheet && (
          <div className="flex items-center gap-4 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
            <span className="font-medium">현재 시트:</span>
            <span className="text-[#818CF8] font-semibold">{currentSheet.name}</span>
            <span className="text-gray-400">|</span>
            <span>{currentSheet.columns.length}개 컬럼</span>
            <span className="text-gray-400">|</span>
            <span>{currentSheet.rowCount}개 행</span>
          </div>
        )}

        {/* Field Mapping Section */}
        {selectedSheet ? (
          <div className="space-y-6">
            {/* Source Column */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">
                  원문 컬럼
                  <span className="text-red-500 ml-1">*</span>
                </h3>
                {fieldMapping.source && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    {fieldMapping.source}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {columns.map(column => {
                  const isMapped = isColumnMapped(column);
                  const isSelected = fieldMapping.source === column;
                  return (
                    <button
                      key={column}
                      onClick={() => handleSourceSelect(column)}
                      disabled={isMapped && !isSelected}
                      className={`
                        px-3 py-2 rounded-lg text-xs font-medium transition-all
                        ${isSelected
                          ? 'bg-[#818CF8] text-white shadow-sm'
                          : isMapped
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-50 text-gray-700 hover:bg-blue-50 hover:text-blue-600 border border-gray-200'
                        }
                      `}
                    >
                      {column}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Translation Columns */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">
                  번역 컬럼
                  <span className="text-xs text-gray-500 font-normal ml-2">
                    (여러 개 선택 가능)
                  </span>
                </h3>
                {fieldMapping.translations.length > 0 && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    {fieldMapping.translations.length}개 선택됨
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {columns.map(column => {
                  const isMappedAsSource = fieldMapping.source === column;
                  const isMappedAsMeta = Object.values(fieldMapping.metadata).includes(column);
                  const isMapped = isMappedAsSource || isMappedAsMeta;
                  const isSelected = fieldMapping.translations.includes(column);
                  return (
                    <button
                      key={column}
                      onClick={() => handleTranslationToggle(column)}
                      disabled={isMapped && !isSelected}
                      className={`
                        px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between
                        ${isSelected
                          ? 'bg-green-500 text-white shadow-sm'
                          : isMapped
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-50 text-gray-700 hover:bg-green-50 hover:text-green-600 border border-gray-200'
                        }
                      `}
                    >
                      <span className="truncate">{column}</span>
                      {isSelected && (
                        <svg className="w-3 h-3 ml-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Metadata Mapping */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                메타데이터 매핑
                <span className="text-xs text-gray-500 font-normal ml-2">
                  (선택사항)
                </span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { key: 'key_id', label: 'KEY / ID' },
                  { key: 'product_category', label: '제품분류', required: true },
                  { key: 'version', label: '버전' },
                  { key: 'context', label: '문맥' },
                  { key: 'description', label: '설명' },
                  { key: 'product_code', label: '제품코드' },
                  { key: 'platform', label: '플랫폼' },
                ].map(({ key, label, required }) => (
                  <div key={key} className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">
                      {label}
                      {required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <Select
                      value={fieldMapping.metadata[key] || ''}
                      onChange={(e) => handleMetadataSelect(key, e.target.value || null)}
                      options={columnOptions.map(opt => ({
                        ...opt,
                        disabled: opt.disabled && opt.value !== fieldMapping.metadata[key],
                      }))}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">매핑 요약</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 min-w-[80px]">원문:</span>
                  {fieldMapping.source ? (
                    <span className="text-[#818CF8] font-medium bg-blue-50 px-2 py-0.5 rounded">
                      {fieldMapping.source}
                    </span>
                  ) : (
                    <span className="text-gray-400 italic">미선택</span>
                  )}
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-gray-500 min-w-[80px]">번역:</span>
                  {fieldMapping.translations.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {fieldMapping.translations.map(t => (
                        <span 
                          key={t} 
                          className="text-green-700 font-medium bg-green-50 px-2 py-0.5 rounded text-xs"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-400 italic">미선택</span>
                  )}
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-gray-500 min-w-[80px]">메타데이터:</span>
                  {Object.keys(fieldMapping.metadata).length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(fieldMapping.metadata).map(([key, value]) => (
                        <span 
                          key={key} 
                          className="text-purple-700 font-medium bg-purple-50 px-2 py-0.5 rounded text-xs"
                        >
                          {key}: {value}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-400 italic">없음</span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearMapping}
              >
                매핑 초기화
              </Button>
              {fieldMapping.source && (
                <div className="text-xs text-green-600 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  원문 매핑 완료
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            {hasMultipleSheets ? (
              <>
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p>시트를 선택하면 필드 매핑이 표시됩니다</p>
              </>
            ) : (
              <>
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p>파일에서 컬럼을 읽을 수 없습니다</p>
              </>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
