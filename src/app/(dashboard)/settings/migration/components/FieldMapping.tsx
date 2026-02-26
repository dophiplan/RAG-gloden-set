'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

interface FieldMappingProps {
  sheetsData: {
    name: string;
    columns: string[];
    rowCount: number;
  }[];
  selectedVersion: string;
  onVersionChange: (version: string) => void;
  onMappingChange: (mappings: {
    source: string | null;
    translations: string[];
    metadata: Record<string, string>;
    customFields: string[];
  }) => void;
  initialMappings?: {
    source: string | null;
    translations: string[];
    metadata: Record<string, string>;
    customFields: string[];
  };
}

// 버전별 매핑 저장 구조
interface VersionMapping {
  source: string | null;
  translations: string[];
  metadata: Record<string, string>;
  customFields: string[];
}

// 전역 드래그 상태
let globalDragType: 'column' | 'version' | null = null;
let globalDragValue: string | null = null;
let globalDragSourceVersion: string | null = null; // 드래그 시작한 버전

export default function FieldMapping({
  sheetsData,
  selectedVersion,
  onVersionChange,
  onMappingChange,
  initialMappings,
}: FieldMappingProps) {
  // 버전별 매핑 저장소 - 안전한 초기화
  const [allMappings, setAllMappings] = useState<Record<string, VersionMapping>>({});

  // selectedVersion이 변경되거나 initialMappings가 있을 때 초기화
  useEffect(() => {
    if (selectedVersion && initialMappings && !allMappings[selectedVersion]) {
      setAllMappings(prev => ({
        ...prev,
        [selectedVersion]: initialMappings,
      }));
    }
  }, [selectedVersion, initialMappings]);

  const currentSheet = sheetsData.find(s => s.name === selectedVersion);
  const fileColumns = currentSheet?.columns || [];

  // 현재 선택된 버전의 매핑 가져오기 (없으면 빈 매핑 반환)
  const getCurrentMappings = (): VersionMapping => {
    if (!selectedVersion) {
      return { source: null, translations: [], metadata: {}, customFields: [] };
    }
    return allMappings[selectedVersion] || { source: null, translations: [], metadata: {}, customFields: [] };
  };

  const currentMappings = getCurrentMappings();

  // 현재 버전에 매핑이 존재하는지 확인
  const hasCurrentMapping = !!(
    currentMappings.source ||
    currentMappings.translations.length > 0 ||
    Object.keys(currentMappings.metadata).length > 0 ||
    currentMappings.customFields.length > 0
  );

  // 현재 버전의 매핑 업데이트
  const updateCurrentMappings = (newMappings: VersionMapping) => {
    if (!selectedVersion) return;
    
    const updatedAll = {
      ...allMappings,
      [selectedVersion]: newMappings,
    };
    setAllMappings(updatedAll);
    onMappingChange(newMappings);
  };

  // 버전 변경 핸들러 (매핑 존재 시 경고)
  const handleVersionSelect = (version: string) => {
    if (hasCurrentMapping && version !== selectedVersion) {
      const confirmed = confirm(
        `현재 버전(${selectedVersion})에 매핑된 데이터가 있습니다.\n` +
        `버전을 변경하면 현재 매핑 데이터는 유지되지만, 새로운 버전으로 작업하게 됩니다.\n` +
        `계속하시겠습니까?`
      );
      if (!confirmed) return;
    }
    onVersionChange(version);
  };

  const isColumnMapped = useCallback((column: string) => {
    return currentMappings.source === column ||
           currentMappings.translations.includes(column) ||
           Object.values(currentMappings.metadata).includes(column) ||
           currentMappings.customFields.includes(column);
  }, [currentMappings]);

  const handleDrop = (e: React.DragEvent, targetType: 'source' | 'translations' | 'metadata' | 'custom', fieldName?: string) => {
    e.preventDefault();
    
    // selectedVersion이 없으면 드롭 무시
    if (!selectedVersion) return;
    
    const type = globalDragType;
    const value = globalDragValue;
    const sourceVersion = globalDragSourceVersion;
    
    if (!value || !type) return;
    
    // 파일 컬럼인 경우, 현재 선택된 버전과 드래그 시작한 버전이 일치해야 함
    if (type === 'column' && sourceVersion !== selectedVersion) {
      alert(`현재 선택된 버전(${selectedVersion})의 파일 컬럼만 매핑할 수 있습니다.`);
      return;
    }

    const prevMappings = getCurrentMappings();
    let newMappings = { ...prevMappings };

    if (type === 'version' && targetType === 'metadata' && fieldName) {
      newMappings.metadata = { ...prevMappings.metadata, [fieldName]: value };
    } else if (type === 'column') {
      if (targetType === 'source') {
        newMappings.source = value;
      } else if (targetType === 'translations') {
        if (!prevMappings.translations.includes(value)) {
          newMappings.translations = [...prevMappings.translations, value];
        }
      } else if (targetType === 'metadata' && fieldName) {
        newMappings.metadata = { ...prevMappings.metadata, [fieldName]: value };
      } else if (targetType === 'custom') {
        if (!prevMappings.customFields.includes(value)) {
          newMappings.customFields = [...prevMappings.customFields, value];
        }
      }
    }

    updateCurrentMappings(newMappings);
  };

  const handleClear = (type: 'source' | 'translations' | 'metadata' | 'custom', fieldName?: string) => {
    if (!selectedVersion) return;
    
    const prevMappings = getCurrentMappings();
    let newMappings = { ...prevMappings };
    
    if (type === 'source') {
      newMappings.source = null;
    } else if (type === 'translations' && fieldName) {
      newMappings.translations = prevMappings.translations.filter(t => t !== fieldName);
    } else if (type === 'metadata' && fieldName) {
      // fieldName은 'version', 'product_category' 등의 키
      const newMetadata = { ...prevMappings.metadata };
      delete newMetadata[fieldName];
      newMappings.metadata = newMetadata;
    } else if (type === 'custom' && fieldName) {
      newMappings.customFields = prevMappings.customFields.filter(f => f !== fieldName);
    }

    updateCurrentMappings(newMappings);
  };

  // 현재 버전이 변경될 때 부모에 알림
  useEffect(() => {
    if (selectedVersion) {
      onMappingChange(getCurrentMappings());
    }
  }, [selectedVersion]);

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
                    const sheetHasMapping = !!allMappings[sheet.name] && (
                      allMappings[sheet.name].source ||
                      allMappings[sheet.name].translations.length > 0 ||
                      Object.keys(allMappings[sheet.name].metadata).length > 0
                    );
                    // 현재 버전에 매핑이 있고, 이 버전이 선택된 버전이 아니면 disabled
                    const isDisabled = hasCurrentMapping && !isSelected && !sheetHasMapping;
                    
                    return (
                      <VersionItem
                        key={sheet.name}
                        sheet={sheet}
                        isSelected={isSelected}
                        hasMapping={sheetHasMapping}
                        isDisabled={isDisabled}
                        onSelect={() => handleVersionSelect(sheet.name)}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
            <p className="text-xs text-text-secondary mt-1.5">클릭: 선택 / 드래그: 필드에 매핑</p>
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
                      return (
                        <div
                          key={column}
                          draggable={!mapped}
                          onDragStart={(e) => {
                            globalDragType = 'column';
                            globalDragValue = column;
                            globalDragSourceVersion = selectedVersion; // 현재 선택된 버전 저장
                            e.dataTransfer.effectAllowed = 'copy';
                          }}
                          onDragEnd={() => {
                            globalDragType = null;
                            globalDragValue = null;
                            globalDragSourceVersion = null;
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-sm transition-all flex items-center gap-1.5 ${
                            mapped
                              ? 'bg-gray-100 text-text-secondary cursor-not-allowed'
                              : 'bg-surface border border-border-light cursor-grab hover:border-primary hover:shadow-sm'
                          }`}
                        >
                          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                          </svg>
                          <span className="truncate text-xs">{column}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-text-secondary text-xs p-4 text-center">
                  버전을 선택하면<br/>컬럼이 표시됩니다
                </div>
              )}
            </div>
            <p className="text-xs text-text-secondary mt-1.5">드래그하여 오른쪽에 매핑</p>
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
              <span className="text-xs font-normal text-text-secondary ml-2">
                ({selectedVersion})
              </span>
            )}
          </h3>
          <span className="text-xs font-normal text-text-secondary">여기에 드롭</span>
        </div>

        {!selectedVersion ? (
          <div className="flex-1 flex items-center justify-center text-text-secondary text-sm">
            왼쪽에서 버전을 선택해주세요
          </div>
        ) : (
          <div className="space-y-2.5 flex-1 overflow-y-auto">
            {/* KEY/ID - 고유 식별자 */}
            <DropZone
              label="KEY / ID"
              value={currentMappings.metadata.key_id}
              placeholder="컬럼 드래그"
              onDrop={(e) => handleDrop(e, 'metadata', 'key_id')}
              onClear={() => handleClear('metadata', 'key_id')}
              color="blue"
            />

            {/* 제품분류 - 대분류 */}
            <DropZone
              label="제품분류"
              value={currentMappings.metadata.product_category}
              placeholder="버전/컬럼 드래그"
              onDrop={(e) => handleDrop(e, 'metadata', 'product_category')}
              onClear={() => handleClear('metadata', 'product_category')}
              color="purple"
            />

            {/* 원문 - 실제 데이터 */}
            <DropZone
              label="원문"
              required
              value={currentMappings.source}
              placeholder="컬럼을 드래그하세요"
              onDrop={(e) => handleDrop(e, 'source')}
              onClear={() => handleClear('source')}
              color="blue"
            />

            {/* 번역 언어 */}
            <MultiDropZone
              label="번역 언어"
              values={currentMappings.translations}
              placeholder="여러 개의 언어 컬럼을 드래그하세요"
              onDrop={(e) => handleDrop(e, 'translations')}
              onClear={(val) => handleClear('translations', val)}
              color="green"
            />

            {/* 버전, 문맥 */}
            <div className="grid grid-cols-2 gap-2">
              <DropZone
                label="버전"
                value={currentMappings.metadata.version}
                placeholder="버전/컬럼 드래그"
                onDrop={(e) => handleDrop(e, 'metadata', 'version')}
                onClear={() => handleClear('metadata', 'version')}
                color="purple"
                small
              />
              <DropZone
                label="문맥"
                value={currentMappings.metadata.context}
                placeholder="버전/컬럼 드래그"
                onDrop={(e) => handleDrop(e, 'metadata', 'context')}
                onClear={() => handleClear('metadata', 'context')}
                color="purple"
                small
              />
            </div>

            {/* 설명, 제품코드 */}
            <div className="grid grid-cols-2 gap-2">
              <DropZone
                label="설명"
                value={currentMappings.metadata.description}
                placeholder="버전/컬럼 드래그"
                onDrop={(e) => handleDrop(e, 'metadata', 'description')}
                onClear={() => handleClear('metadata', 'description')}
                color="purple"
                small
              />
              <DropZone
                label="제품코드"
                value={currentMappings.metadata.product_code}
                placeholder="버전/컬럼 드래그"
                onDrop={(e) => handleDrop(e, 'metadata', 'product_code')}
                onClear={() => handleClear('metadata', 'product_code')}
                color="purple"
                small
              />
            </div>

            {/* 플랫폼, 기타 */}
            <div className="grid grid-cols-2 gap-2">
              <DropZone
                label="플랫폼"
                value={currentMappings.metadata.platform}
                placeholder="버전/컬럼 드래그"
                onDrop={(e) => handleDrop(e, 'metadata', 'platform')}
                onClear={() => handleClear('metadata', 'platform')}
                color="purple"
                small
              />
              <div 
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                onDrop={(e) => handleDrop(e, 'custom')}
                className={`p-2.5 rounded-xl border-2 transition-all flex flex-col justify-center ${
                  currentMappings.customFields.length > 0
                    ? 'bg-amber-50 border-amber-400'
                    : 'bg-surface border-dashed border-border-light'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-text-main">기타</span>
                  {currentMappings.customFields.length > 0 && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                      {currentMappings.customFields.length}
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-secondary truncate">
                  {currentMappings.customFields.length > 0 
                    ? currentMappings.customFields.map((f, i) => `기타${i+1}`).join(', ')
                    : '드래그'}
                </p>
              </div>
            </div>

            {/* 기타 필드 */}
            <div
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
              onDrop={(e) => handleDrop(e, 'custom')}
              className={`p-3 rounded-xl border-2 transition-all ${
                currentMappings.customFields.length > 0
                  ? 'bg-amber-50 border-amber-400'
                  : 'bg-surface border-dashed border-border-light'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm text-text-main">기타</span>
                {currentMappings.customFields.length > 0 && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                    {currentMappings.customFields.length}개
                  </span>
                )}
              </div>
              
              {currentMappings.customFields.length > 0 ? (
                <div className="space-y-1.5">
                  {currentMappings.customFields.map((field, index) => (
                    <div key={field} className="flex items-center gap-2 text-sm">
                      <span className="text-amber-600 font-medium min-w-[50px]">기타 {index + 1}</span>
                      <span className="text-amber-700 bg-white px-2.5 py-0.5 rounded-lg border border-amber-200 text-xs flex-1">
                        ← {field}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleClear('custom', field)} 
                        className="h-6 w-6 p-0 text-amber-400 hover:text-red-500"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-secondary">추가 필드가 필요하면 여기에 드래그하세요</p>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// VersionItem - 클릭과 드래그를 동시에 지원
interface VersionItemProps {
  sheet: { name: string; columns: string[]; rowCount: number };
  isSelected: boolean;
  hasMapping: boolean;
  isDisabled?: boolean;
  onSelect: () => void;
}

function VersionItem({ sheet, isSelected, hasMapping, isDisabled, onSelect }: VersionItemProps) {
  const clickTimer = useRef<NodeJS.Timeout | null>(null);
  const isDragging = useRef(false);

  const handleMouseDown = () => {
    isDragging.current = false;
    clickTimer.current = setTimeout(() => {
      isDragging.current = true;
      globalDragType = 'version';
      globalDragValue = sheet.name;
    }, 200);
  };

  const handleMouseUp = () => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    
    if (!isDragging.current && !isDisabled) {
      onSelect();
    }
    
    setTimeout(() => {
      isDragging.current = false;
    }, 100);
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    isDragging.current = true;
    globalDragType = 'version';
    globalDragValue = sheet.name;
    globalDragSourceVersion = sheet.name; // 버전 자체를 드래그하므로 자신의 이름 저장
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragEnd = () => {
    setTimeout(() => {
      globalDragType = null;
      globalDragValue = null;
      isDragging.current = false;
    }, 0);
  };

  return (
    <div
      draggable={!isDisabled}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all select-none ${
        isDisabled
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : isSelected
          ? 'bg-primary text-white shadow-md cursor-grab'
          : hasMapping
          ? 'bg-green-50 border border-green-300 hover:border-green-400 cursor-grab'
          : 'bg-surface border border-border-light hover:border-primary hover:bg-primary-light cursor-grab'
      }`}
      title={isDisabled ? '현재 버전의 매핑을 완료해야 다른 버전을 선택할 수 있습니다' : ''}
    >
      <div className="flex items-center justify-between">
        <div className="font-medium truncate">{sheet.name}</div>
        {hasMapping && !isSelected && (
          <span className="text-xs text-green-600">✓</span>
        )}
      </div>
      <div className={`text-xs ${isSelected ? 'text-white/70' : 'text-text-secondary'}`}>
        {sheet.columns.length}컬럼
      </div>
    </div>
  );
}

// 단일 드롭존 컴포넌트
interface DropZoneProps {
  label: string;
  value?: string | null;
  placeholder: string;
  onDrop: (e: React.DragEvent) => void;
  onClear: () => void;
  color?: 'blue' | 'green' | 'purple';
  required?: boolean;
  small?: boolean;
}

function DropZone({ label, value, placeholder, onDrop, onClear, color = 'blue', required, small }: DropZoneProps) {
  const colorClasses = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-700', light: 'border-blue-200' },
    green: { bg: 'bg-green-50', border: 'border-green-400', text: 'text-green-700', light: 'border-green-200' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-700', light: 'border-purple-200' },
  };

  const c = colorClasses[color];

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDrop={onDrop}
      className={`${small ? 'p-2.5' : 'p-3'} rounded-xl border-2 transition-all ${
        value
          ? `${c.bg} ${c.border}`
          : 'bg-surface border-dashed border-border-light'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className={`${small ? 'text-xs' : 'text-sm'} font-semibold text-text-main`}>
          {label} {required && <span className="text-red-500">*</span>}
        </span>
        {value && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }} 
            className="ml-2 p-1 rounded-full hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors"
            title="삭제"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      {value ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-primary">←</span>
          <span className={`font-medium ${c.text} bg-white px-2 py-0.5 rounded-lg border ${c.light} text-xs`}>
            {value}
          </span>
        </div>
      ) : (
        <p className={`text-xs text-text-secondary`}>{placeholder}</p>
      )}
    </div>
  );
}

// 다중 드롭존 컴포넌트
interface MultiDropZoneProps {
  label: string;
  values: string[];
  placeholder: string;
  onDrop: (e: React.DragEvent) => void;
  onClear: (val: string) => void;
  color?: 'blue' | 'green' | 'purple';
}

function MultiDropZone({ label, values, placeholder, onDrop, onClear, color = 'green' }: MultiDropZoneProps) {
  const colorClasses = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-700', light: 'border-blue-200' },
    green: { bg: 'bg-green-50', border: 'border-green-400', text: 'text-green-700', light: 'border-green-200' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-700', light: 'border-purple-200' },
  };

  const c = colorClasses[color];

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDrop={onDrop}
      className={`p-3 rounded-xl border-2 transition-all ${
        values.length > 0
          ? `${c.bg} ${c.border}`
          : 'bg-surface border-dashed border-border-light'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-sm text-text-main">{label}</span>
        {values.length > 0 && (
          <span className={`text-xs ${c.bg} ${c.text} px-2 py-0.5 rounded-full`}>
            {values.length}개
          </span>
        )}
      </div>
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {values.map(val => (
            <span key={val} className={`inline-flex items-center gap-1 text-xs bg-white px-2 py-0.5 rounded-lg border ${c.light}`}>
              ← {val}
              <button onClick={() => onClear(val)} className={`${c.text} hover:text-red-500`}>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-text-secondary">{placeholder}</p>
      )}
    </div>
  );
}
