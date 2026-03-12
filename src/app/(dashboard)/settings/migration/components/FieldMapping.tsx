'use client';

import React, { useCallback } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import MultiSelectDropdown from '@/components/ui/MultiSelectDropdown';
import { useMigration } from '../contexts/MigrationContext';
import { usePlatforms } from '@/hooks/useReferenceData';

interface FieldMappingProps {
  sheetsData: {
    name: string;
    columns: string[];
    rowCount: number;
  }[];
  platforms?: { code: string; name: string }[];
}

// 드래그 상태 타입
type DragItem =
  | { type: 'column'; column: string; sourceVersion: string }
  | { type: 'version'; version: string }
  | null;

// 드래그 상태 관리 (모듈 레벨 싱글톤)
class DragState {
  private static instance: DragState;
  private item: DragItem = null;

  static getInstance(): DragState {
    if (!DragState.instance) {
      DragState.instance = new DragState();
    }
    return DragState.instance;
  }

  set(item: DragItem) {
    this.item = item;
  }

  get(): DragItem {
    return this.item;
  }

  clear() {
    this.item = null;
  }
}

const dragState = DragState.getInstance();

export default function FieldMapping({ sheetsData, platforms: propPlatforms }: FieldMappingProps) {
  const {
    state,
    setSelectedVersion,
    setMappingField,
    clearMappingField,
    getMappingForVersion,
  } = useMigration();

  const { selectedVersion, versionMappings } = state;

  // 현재 선택된 버전의 매핑 가져오기
  const currentMapping = selectedVersion ? getMappingForVersion(selectedVersion) : null;
  
  // 플랫폼 데이터 가져오기 (props 우선, 없으면 hook)
  const { platforms: hookPlatforms } = usePlatforms();
  const platforms = propPlatforms || hookPlatforms || [];
  
  // 플랫폼 옵션
  const platformOptions = platforms.map((p) => ({ value: p.code, label: p.name }));
  
  // 현재 매핑된 플랫폼
  const currentPlatforms = currentMapping?.metadata?.platforms?.split(',').filter(Boolean) || [];

  // 현재 선택된 시트의 컬럼들
  const currentSheet = sheetsData.find((s) => s.name === selectedVersion);
  const fileColumns = currentSheet?.columns || [];

  // 다중 선택 상태
  const [selectedColumns, setSelectedColumns] = React.useState<string[]>([]);

  // 버전 선택 핸들러
  const handleVersionSelect = useCallback(
    (version: string) => {
      setSelectedVersion(version);
    },
    [setSelectedVersion]
  );

  // 드래그 시작 핸들러 (다중 선택 지원)
  const handleDragStart = useCallback(
    (e: React.DragEvent, column: string, sourceVersion: string) => {
      // 다중 선택된 컬럼이 있고, 현재 드래그하는 컬럼이 선택된 컬럼 목록에 있으면 모두 함께 드래그
      const columnsToDrag =
        selectedColumns.length > 0 && selectedColumns.includes(column)
          ? selectedColumns
          : [column];

      dragState.set({ type: 'column', column: columnsToDrag.join(','), sourceVersion });
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', columnsToDrag.join(','));
    },
    [selectedColumns]
  );

  // 드래그 종료 핸들러
  const handleDragEnd = useCallback(() => {
    dragState.clear();
  }, []);

  // 드롭 핸들러 - 원문
  const handleSourceDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      console.log('[handleSourceDrop] selectedVersion:', selectedVersion);
      if (!selectedVersion) {
        console.log('[handleSourceDrop] ERROR: selectedVersion is null');
        return;
      }

      const dragItem = dragState.get();
      console.log('[handleSourceDrop] dragItem:', dragItem);
      if (!dragItem || dragItem.type !== 'column') {
        console.log('[handleSourceDrop] ERROR: invalid dragItem');
        return;
      }

      // 현재 선택된 버전의 컬럼만 허용
      if (dragItem.sourceVersion !== selectedVersion) {
        console.log('[handleSourceDrop] ERROR: version mismatch', dragItem.sourceVersion, selectedVersion);
        return;
      }

      console.log('[handleSourceDrop] Setting source =', dragItem.column);
      setMappingField(selectedVersion, 'source', dragItem.column);
      dragState.clear();
    },
    [selectedVersion, setMappingField]
  );

  // 드롭 핸들러 - 번역 (다중 컬럼 지원)
  const handleTranslationDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!selectedVersion) return;

      const dragItem = dragState.get();
      if (!dragItem || dragItem.type !== 'column') return;

      if (dragItem.sourceVersion !== selectedVersion) return;

      // 다중 컬럼 파싱 (쉼표로 구분)
      const columns = dragItem.column.split(',').filter((c) => c);
      const curre[기밀마스킹]ranslations = currentMapping?.translations || [];

      // 중복 제외하고 추가
      const newTranslations = [
        ...curre[기밀마스킹]ranslations,
        ...columns.filter((c) => !curre[기밀마스킹]ranslations.includes(c)),
      ];

      setMappingField(selectedVersion, 'translations', newTranslations);
      setSelectedColumns([]); // 드래그 후 선택 해제
      dragState.clear();
    },
    [selectedVersion, currentMapping?.translations, setMappingField, setSelectedColumns]
  );

  // 드롭 핸들러 - 메타데이터 (컬럼 또는 버전)
  const handleMetadataDrop = useCallback(
    (e: React.DragEvent, field: string) => {
      e.preventDefault();
      console.log('[handleMetadataDrop] selectedVersion:', selectedVersion);
      if (!selectedVersion) {
        console.log('[handleMetadataDrop] ERROR: selectedVersion is null');
        return;
      }

      const dragItem = dragState.get();
      console.log('[handleMetadataDrop] dragItem:', dragItem);
      if (!dragItem) return;

      if (dragItem.type === 'column') {
        // 파일 컬럼 드롭 - 현재 버전의 컬럼만 허용
        if (dragItem.sourceVersion !== selectedVersion) {
          console.log('[handleMetadataDrop] ERROR: version mismatch', dragItem.sourceVersion, selectedVersion);
          return;
        }
        console.log('[handleMetadataDrop] Setting metadata.', field, '=', dragItem.column);
        setMappingField(selectedVersion, `metadata.${field}`, dragItem.column);
      } else if (dragItem.type === 'version') {
        // 버전 드롭 - 자신의 버전만 메타데이터에 허용
        if (dragItem.version !== selectedVersion) return;
        setMappingField(selectedVersion, `metadata.${field}`, dragItem.version);
      }

      dragState.clear();
    },
    [selectedVersion, setMappingField]
  );

  // 컬럼이 이미 매핑되었는지 확인
  const isColumnMapped = useCallback(
    (column: string): boolean => {
      if (!currentMapping) return false;
      return (
        currentMapping.source === column ||
        currentMapping.translations.includes(column) ||
        Object.values(currentMapping.metadata).includes(column)
      );
    },
    [currentMapping]
  );

  // 컬럼 클릭 핸들러 (다중 선택) - isColumnMapped 다음에 정의 (호이스팅 문제 해결)
  const handleColumnClick = useCallback(
    (e: React.MouseEvent, column: string) => {
      if (isColumnMapped(column)) return;

      if (e.ctrlKey || e.metaKey) {
        // Ctrl/Cmd + 클릭: 토글 선택
        setSelectedColumns((prev) =>
          prev.includes(column) ? prev.filter((c) => c !== column) : [...prev, column]
        );
      } else {
        // 일반 클릭: 단일 선택
        setSelectedColumns([column]);
      }
    },
    [isColumnMapped] // FIXED: Added missing dependency
  );

  // 번역 컬럼 제거
  const removeTranslation = useCallback(
    (column: string) => {
      if (!selectedVersion) return;
      const newTranslations = (currentMapping?.translations || []).filter((t) => t !== column);
      setMappingField(selectedVersion, 'translations', newTranslations);
    },
    [selectedVersion, currentMapping?.translations, setMappingField]
  );

  // 모든 번역 컬럼 제거
  const clearAllTranslations = useCallback(() => {
    if (!selectedVersion) return;
    setMappingField(selectedVersion, 'translations', []);
  }, [selectedVersion, setMappingField]);

  // 메타데이터 필드 제거
  const removeMetadata = useCallback(
    (field: string) => {
      if (!selectedVersion) return;
      clearMappingField(selectedVersion, `metadata.${field}`);
    },
    [selectedVersion, clearMappingField]
  );

  // 원문 제거
  const removeSource = useCallback(() => {
    if (!selectedVersion) return;
    clearMappingField(selectedVersion, 'source');
  }, [selectedVersion, clearMappingField]);

  // 매핑 초기화
  const clearAllMapping = useCallback(() => {
    if (!selectedVersion) return;
    clearMappingField(selectedVersion, 'source');
    clearMappingField(selectedVersion, 'translations');
    clearMappingField(selectedVersion, 'metadata');
  }, [selectedVersion, clearMappingField]);

  return (
    <div className="grid grid-cols-2 gap-5">
      {/* 왼쪽: 버전 선택 + 파일 컬럼 */}
      <Card padding="sm" className="bg-surface h-[460px]">
        <div className="grid grid-cols-2 gap-3 h-full">
          {/* 버전 선택 */}
          <div className="flex flex-col h-full min-h-0">
            <h3 className="text-sm font-semibold text-text-main mb-2 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-xs">1</span>
              버전 선택
            </h3>
            <div className="bg-surface rounded-xl border border-border-light flex-1 min-h-0 overflow-hidden">
              <div className="h-full overflow-y-auto p-2">
                <div className="space-y-1">
                  {sheetsData.map((sheet) => {
                    const isSelected = selectedVersion === sheet.name;
                    const hasMapping = !!(
                      versionMappings[sheet.name]?.source ||
                      versionMappings[sheet.name]?.translations.length
                    );

                    return (
                      <button
                        key={sheet.name}
                        onClick={() => handleVersionSelect(sheet.name)}
                        draggable
                        onDragStart={(e) => {
                          dragState.set({ type: 'version', version: sheet.name });
                          e.dataTransfer.setData('text/plain', sheet.name);
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        onDragEnd={() => dragState.clear()}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                          isSelected
                            ? 'bg-primary text-white shadow-sm'
                            : hasMapping
                            ? 'bg-primary/10 text-primary border border-primary/20'
                            : 'bg-surface border border-border-light hover:border-primary hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium truncate">{sheet.name}</span>
                          {hasMapping && (
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className={`text-xs mt-0.5 ${isSelected ? 'text-white/70' : 'text-text-secondary'}`}>
                          {sheet.columns.length}컬럼, {sheet.rowCount}행
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <p className="text-xs text-text-secondary mt-1.5">클릭: 버전 선택 / 드래그: 버전 매핑</p>
          </div>

          {/* 파일 컬럼 */}
          <div className="flex flex-col h-full min-h-0">
            <h3 className="text-sm font-semibold text-text-main mb-2 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-xs">2</span>
              파일 컬럼
            </h3>
            <div className="bg-surface rounded-xl border border-border-light flex-1 min-h-0 overflow-hidden">
              {fileColumns.length > 0 ? (
                <div className="h-full overflow-y-auto p-2">
                  <div className="space-y-1">
                    {fileColumns.map((column) => {
                      const mapped = isColumnMapped(column);
                      const isSelected = selectedColumns.includes(column);
                      return (
                        <div
                          key={column}
                          draggable={!mapped}
                          onClick={(e) => handleColumnClick(e, column)}
                          onDragStart={(e) => {
                            if (!selectedVersion) return; // FIXED: Added null check before calling handleDragStart
                            handleDragStart(e, column, selectedVersion);
                          }}
                          onDragEnd={handleDragEnd}
                          className={`px-2.5 py-1.5 rounded-lg text-sm transition-all flex items-center gap-1.5 select-none ${
                            mapped
                              ? 'bg-gray-100 text-text-secondary cursor-not-allowed'
                              : isSelected
                              ? 'bg-primary text-white border border-primary shadow-sm cursor-grab'
                              : 'bg-surface border border-border-light cursor-pointer hover:border-primary hover:shadow-sm'
                          }`}
                        >
                          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                          </svg>
                          <span className="truncate text-xs">{column}</span>
                          {isSelected && <span className="ml-auto text-xs">✓</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-text-secondary text-xs p-4 text-center">
                  왼쪽에서 버전을 선택하면<br />해당 파일의 컬럼이 표시됩니다
                </div>
              )}
            </div>
            <p className="text-xs text-text-secondary mt-1.5">
              {selectedColumns.length > 0 
                ? '선택한 컬럼을 드래그하세요 (Ctrl+클릭으로 다중 선택)'
                : 'Ctrl+클릭으로 다중 선택 후 드래그'}
            </p>
          </div>
        </div>
      </Card>

      {/* 오른쪽: 시스템 필드 */}
      <Card padding="sm" className="h-[460px] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text-main flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center text-xs">3</span>
            시스템 필드
            {selectedVersion && (
              <span className="text-xs font-normal text-text-secondary ml-2">({selectedVersion})</span>
            )}
          </h3>
          {currentMapping?.source && (
            <Button variant="ghost" size="sm" onClick={clearAllMapping} className="text-xs">
              초기화
            </Button>
          )}
        </div>

        {!selectedVersion ? (
          <div className="flex-1 flex items-center justify-center text-text-secondary text-sm">
            왼쪽에서 버전을 선택해주세요
          </div>
        ) : (
          <div className="space-y-2 flex-1">
            {/* 1행: 원문 + 번역 언어 - 높이 증가 */}
            <div className="grid grid-cols-2 gap-2">
              <DropZone
                label="원문"
                required
                value={currentMapping?.source}
                placeholder="컬럼을 드래그하세요"
                onDrop={handleSourceDrop}
                onClear={removeSource}
                color="blue"
                large
              />
              <MultiDropZone
                label="번역 언어"
                values={currentMapping?.translations || []}
                placeholder="여러 컬럼을 드래그하세요"
                onDrop={handleTranslationDrop}
                onClear={removeTranslation}
                onClearAll={clearAllTranslations}
                color="green"
                large
              />
            </div>

            {/* 2행: KEY/ID + 제품분류 */}
            <div className="grid grid-cols-2 gap-2">
              <DropZone
                label="KEY / ID"
                value={currentMapping?.metadata?.key_id}
                placeholder="드래그"
                onDrop={(e) => handleMetadataDrop(e, 'key_id')}
                onClear={() => removeMetadata('key_id')}
                color="purple"
                small
              />
              <DropZone
                label="제품분류*"
                required
                value={currentMapping?.metadata?.product_category}
                placeholder="드래그"
                onDrop={(e) => handleMetadataDrop(e, 'product_category')}
                onClear={() => removeMetadata('product_category')}
                color="purple"
                small
              />
            </div>

            {/* 3행: 버전 + 문맥 */}
            <div className="grid grid-cols-2 gap-2">
              <DropZone
                label="버전"
                value={currentMapping?.metadata?.version}
                placeholder="드래그"
                onDrop={(e) => handleMetadataDrop(e, 'version')}
                onClear={() => removeMetadata('version')}
                color="purple"
                small
              />
              <DropZone
                label="문맥"
                value={currentMapping?.metadata?.context}
                placeholder="드래그"
                onDrop={(e) => handleMetadataDrop(e, 'context')}
                onClear={() => removeMetadata('context')}
                color="purple"
                small
              />
            </div>

            {/* 4행: 플랫폼 + 설명 */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-surface rounded-lg border border-border-light p-2 flex flex-col">
                <label className="block text-[10px] font-semibold text-text-main mb-1">
                  플랫폼
                </label>
                <div className="flex-1">
                  <MultiSelectDropdown
                    options={platformOptions}
                    selected={currentPlatforms}
                    onChange={(selected) => {
                      if (selectedVersion) {
                        setMappingField(selectedVersion, 'metadata.platforms', selected.join(','));
                      }
                    }}
                    placeholder="선택..."
                    className="text-xs"
                  />
                </div>
              </div>
              <DropZone
                label="설명"
                value={currentMapping?.metadata?.description}
                placeholder="드래그"
                onDrop={(e) => handleMetadataDrop(e, 'description')}
                onClear={() => removeMetadata('description')}
                color="purple"
                small
              />
            </div>

            {/* 5행: 제품코드 + 기타 */}
            <div className="grid grid-cols-2 gap-2">
              <DropZone
                label="제품코드"
                value={currentMapping?.metadata?.product_code}
                placeholder="드래그"
                onDrop={(e) => handleMetadataDrop(e, 'product_code')}
                onClear={() => removeMetadata('product_code')}
                color="purple"
                small
              />
              <DropZone
                label="기타"
                value={currentMapping?.metadata?.custom_1}
                placeholder="드래그"
                onDrop={(e) => handleMetadataDrop(e, 'custom_1')}
                onClear={() => removeMetadata('custom_1')}
                color="gray"
                small
              />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// DropZone 컴포넌트
interface DropZoneProps {
  label: string;
  value: string | null | undefined;
  placeholder: string;
  onDrop: (e: React.DragEvent) => void;
  onClear: () => void;
  color: 'blue' | 'green' | 'purple' | 'gray';
  required?: boolean;
  small?: boolean;
  large?: boolean;
}

function DropZone({ label, value, placeholder, onDrop, onClear, color, required, small, large }: DropZoneProps) {
  const colorClasses = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-700', light: 'border-blue-200' },
    green: { bg: 'bg-green-50', border: 'border-green-400', text: 'text-green-700', light: 'border-green-200' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-700', light: 'border-purple-200' },
    gray: { bg: 'bg-gray-50', border: 'border-gray-400', text: 'text-gray-700', light: 'border-gray-200' },
  };

  const c = colorClasses[color];

  // padding 클래스 결정
  const paddingClass = large ? 'p-4' : small ? 'p-1.5' : 'p-3';
  // 높이 클래스 결정
  const heightClass = large ? 'min-h-[80px]' : '';

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={onDrop}
      className={`${paddingClass} ${heightClass} rounded-lg border-2 transition-all ${
        value ? `${c.bg} ${c.border}` : 'bg-surface border-dashed border-border-light hover:border-primary'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`${small ? 'text-[10px]' : 'text-sm'} font-semibold text-text-main`}>
          {label} {required && <span className="text-red-500">*</span>}
        </span>
        {value && (
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onClear(); }} className="!p-0.5 h-auto">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        )}
      </div>
      {value ? (
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-primary text-xs">←</span>
          <span className={`font-medium ${c.text} bg-white px-1.5 py-0.5 rounded border ${c.light} text-[10px] truncate`}>
            {value}
          </span>
        </div>
      ) : (
        <p className={`${small ? 'text-[10px]' : 'text-xs'} text-text-secondary mt-0.5`}>{placeholder}</p>
      )}
    </div>
  );
}

// MultiDropZone 컴포넌트
interface MultiDropZoneProps {
  label: string;
  values: string[];
  placeholder: string;
  onDrop: (e: React.DragEvent) => void;
  onClear: (val: string) => void;
  onClearAll?: () => void;
  color: 'blue' | 'green' | 'purple';
  large?: boolean;
}

function MultiDropZone({ label, values, placeholder, onDrop, onClear, onClearAll, color, large }: MultiDropZoneProps) {
  const colorClasses = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-700', light: 'border-blue-200' },
    green: { bg: 'bg-green-50', border: 'border-green-400', text: 'text-green-700', light: 'border-green-200' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-700', light: 'border-purple-200' },
  };

  const c = colorClasses[color];
  
  // 높이 클래스 결정
  const heightClass = large ? 'min-h-[80px]' : 'min-h-[60px]';
  const paddingClass = large ? 'p-4' : 'p-2';

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={onDrop}
      className={`${paddingClass} rounded-lg border-2 transition-all ${heightClass} ${
        values.length > 0 ? `${c.bg} ${c.border}` : 'bg-surface border-dashed border-border-light hover:border-primary'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-text-main">{label}</span>
        {values.length > 0 && onClearAll && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClearAll();
            }}
            className="text-[10px] text-text-secondary hover:text-red-500 transition-colors"
            title="모두 삭제"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-1 mt-1 max-h-[60px] overflow-y-auto">
          {values.map((val) => (
            <span
              key={val}
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${c.text} bg-white border ${c.light}`}
            >
              <span className="truncate max-w-[80px]">{val}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClear(val);
                }}
                className="hover:text-red-500 transition-colors"
              >
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-text-secondary">{placeholder}</p>
      )}
    </div>
  );
}
