'use client';

import React, { useState } from 'react';

interface FieldMappingProps {
  fileColumns: string[];
  onMappingChange: (mappings: {
    source: string | null;
    translations: string[];
    metadata: Record<string, string>;
  }) => void;
  initialMappings?: {
    source: string | null;
    translations: string[];
    metadata: Record<string, string>;
  };
}

export default function FieldMapping({
  fileColumns,
  onMappingChange,
  initialMappings = { source: null, translations: [], metadata: {} },
}: FieldMappingProps) {
  const [mappings, setMappings] = useState(initialMappings);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverZone, setDragOverZone] = useState<string | null>(null);

  // 매핑된 컬럼 수 계산
  const mappedCount = [
    mappings.source,
    ...mappings.translations,
    ...Object.values(mappings.metadata),
  ].filter(Boolean).length;

  // 드래그 시작
  const handleDragStart = (e: React.DragEvent, column: string) => {
    setDraggedColumn(column);
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', column);
  };

  // 드래그 종료
  const handleDragEnd = () => {
    setDraggedColumn(null);
    setDragOverZone(null);
  };

  // 드래그 오버
  const handleDragOver = (e: React.DragEvent, zone: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverZone(zone);
  };

  // 드래그 리브
  const handleDragLeave = () => {
    setDragOverZone(null);
  };

  // 원문 필드에 드롭
  const handleDropSource = (e: React.DragEvent) => {
    e.preventDefault();
    const column = e.dataTransfer.getData('text/plain') || draggedColumn;
    
    if (column) {
      const newMappings = { ...mappings, source: column };
      setMappings(newMappings);
      onMappingChange(newMappings);
    }
    
    setDraggedColumn(null);
    setDragOverZone(null);
  };

  // 번역 언어 필드에 드롭 (다중 매핑)
  const handleDropTranslation = (e: React.DragEvent) => {
    e.preventDefault();
    const column = e.dataTransfer.getData('text/plain') || draggedColumn;
    
    if (column && !mappings.translations.includes(column)) {
      const newMappings = {
        ...mappings,
        translations: [...mappings.translations, column],
      };
      setMappings(newMappings);
      onMappingChange(newMappings);
    }
    
    setDraggedColumn(null);
    setDragOverZone(null);
  };

  // 메타데이터 필드에 드롭
  const handleDropMetadata = (e: React.DragEvent, fieldName: string) => {
    e.preventDefault();
    const column = e.dataTransfer.getData('text/plain') || draggedColumn;
    
    if (column) {
      const newMappings = {
        ...mappings,
        metadata: { ...mappings.metadata, [fieldName]: column },
      };
      setMappings(newMappings);
      onMappingChange(newMappings);
    }
    
    setDraggedColumn(null);
    setDragOverZone(null);
  };

  // 매핑 제거
  const handleClearSource = () => {
    const newMappings = { ...mappings, source: null };
    setMappings(newMappings);
    onMappingChange(newMappings);
  };

  const handleClearTranslation = (column: string) => {
    const newMappings = {
      ...mappings,
      translations: mappings.translations.filter((t) => t !== column),
    };
    setMappings(newMappings);
    onMappingChange(newMappings);
  };

  const handleClearMetadata = (fieldName: string) => {
    const newMetadata = { ...mappings.metadata };
    delete newMetadata[fieldName];
    const newMappings = { ...mappings, metadata: newMetadata };
    setMappings(newMappings);
    onMappingChange(newMappings);
  };

  // 이미 매핑된 컬럼인지 확인
  const isColumnMapped = (column: string) => {
    if (mappings.source === column) return true;
    if (mappings.translations.includes(column)) return true;
    if (Object.values(mappings.metadata).includes(column)) return true;
    return false;
  };

  return (
    <div className="grid grid-cols-5 gap-4">
      {/* 왼쪽: 파일 컬럼 (1/5) */}
      <div className="col-span-1 border border-gray-200 rounded-lg p-3">
        <h3 className="font-semibold mb-2 text-gray-900 text-sm">
          📄 파일 필드
        </h3>
        <p className="text-xs text-gray-500 mb-2">
          ({mappedCount}/{fileColumns.length} 매핑됨)
        </p>
        <div className="space-y-1 max-h-[450px] overflow-y-auto">
          {fileColumns.map((column) => {
            const mapped = isColumnMapped(column);
            const isTranslation = mappings.translations.includes(column);
            const isSource = mappings.source === column;
            
            return (
              <div
                key={column}
                draggable={!mapped}
                onDragStart={(e) => handleDragStart(e, column)}
                onDragEnd={handleDragEnd}
                className={`rounded px-2 py-1.5 text-xs transition-all ${
                  mapped
                    ? isSource
                      ? 'bg-blue-100 border border-blue-200 text-blue-800'
                      : isTranslation
                      ? 'bg-green-100 border border-green-200 text-green-800'
                      : 'bg-gray-100 border border-gray-200 text-gray-500 opacity-60'
                    : draggedColumn === column
                    ? 'bg-[#818CF8] border-2 border-[#6366F1] text-white cursor-grabbing shadow'
                    : 'bg-white border border-gray-200 cursor-grab hover:border-[#818CF8] hover:shadow-sm'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className="text-gray-400">⋮</span>
                  <span className="font-medium truncate">{column}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 오른쪽: 시스템 필드 (4/5) */}
      <div className="col-span-4 border border-gray-200 rounded-lg p-3">
        <h3 className="font-semibold mb-2 text-gray-900 text-sm">
          🎯 시스템 필드 (매핑된 데이터만 저장됩니다)
        </h3>
        
        <div className="grid grid-cols-2 gap-3">
          {/* 원문 (필수) - 큰 영역 */}
          <div className="col-span-2">
            <p className="text-xs font-medium text-gray-400 uppercase mb-1">원문 (필수)</p>
            <div
              onDragOver={(e) => handleDragOver(e, 'source')}
              onDragLeave={handleDragLeave}
              onDrop={handleDropSource}
              className={`rounded-lg p-4 transition-all ${
                mappings.source
                  ? 'bg-blue-50 border-2 border-[#818CF8]'
                  : dragOverZone === 'source'
                  ? 'bg-blue-100 border-2 border-[#818CF8] border-dashed'
                  : 'bg-gray-50 border-2 border-dashed border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900">
                  원문 (source_text)
                  <span className="text-red-500 ml-1">*</span>
                </span>
                {mappings.source && (
                  <button
                    onClick={handleClearSource}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              
              {mappings.source ? (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-gray-500">←</span>
                  <span className="text-sm font-medium text-blue-700 bg-white px-3 py-1 rounded border border-blue-200">
                    {mappings.source}
                  </span>
                </div>
              ) : (
                <div className="mt-2 text-sm text-gray-400 py-3">
                  {dragOverZone === 'source' ? '놓으세요!' : '왼쪽에서 원문 필드 드래그'}
                </div>
              )}
            </div>
          </div>

          {/* 번역할 언어 (다중 매핑) - 큰 영역 */}
          <div className="col-span-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-gray-400 uppercase">번역할 언어</p>
              {mappings.translations.length > 0 && (
                <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">
                  {mappings.translations.length}개 선택됨
                </span>
              )}
            </div>
            <div
              onDragOver={(e) => handleDragOver(e, 'translations')}
              onDragLeave={handleDragLeave}
              onDrop={handleDropTranslation}
              className={`rounded-lg p-4 transition-all min-h-[100px] ${
                mappings.translations.length > 0
                  ? 'bg-green-50 border-2 border-[#10B981]'
                  : dragOverZone === 'translations'
                  ? 'bg-green-100 border-2 border-[#10B981] border-dashed'
                  : 'bg-gray-50 border-2 border-dashed border-gray-300'
              }`}
            >
              {mappings.translations.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {mappings.translations.map((column) => (
                    <span
                      key={column}
                      className="inline-flex items-center gap-1 text-sm font-medium text-green-700 bg-white px-3 py-1.5 rounded border border-green-200"
                    >
                      ← {column}
                      <button
                        onClick={() => handleClearTranslation(column)}
                        className="ml-1 text-green-400 hover:text-red-500 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-400 py-4 text-center">
                  {dragOverZone === 'translations' 
                    ? '놓으세요!' 
                    : '왼쪽에서 번역할 언어 필드들을 드래그 (여러 개 가능)'}
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-400">
              💡 분류 단계에서 언어별 상세 설정이 가능합니다
            </p>
          </div>

          {/* 메타데이터 필드 - 2x2 그리드 */}
          <div className="col-span-2">
            <p className="text-xs font-medium text-gray-400 uppercase mb-1">메타데이터</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { name: 'context', label: '문맥/설명' },
                { name: 'product_code', label: '제품 코드' },
                { name: 'version', label: '버전' },
                { name: 'platform', label: '플랫폼' },
              ].map((field) => (
                <div
                  key={field.name}
                  onDragOver={(e) => handleDragOver(e, field.name)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDropMetadata(e, field.name)}
                  className={`rounded p-2 transition-all ${
                    mappings.metadata[field.name]
                      ? 'bg-purple-50 border-2 border-[#A855F7]'
                      : dragOverZone === field.name
                      ? 'bg-purple-100 border-2 border-purple-400 border-dashed'
                      : 'bg-gray-50 border border-dashed border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-600 text-xs">{field.label}</span>
                    {mappings.metadata[field.name] && (
                      <button
                        onClick={() => handleClearMetadata(field.name)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  
                  {mappings.metadata[field.name] ? (
                    <div className="mt-1 flex items-center gap-1">
                      <span className="text-xs text-gray-500">←</span>
                      <span className="text-xs font-medium text-purple-700 truncate">
                        {mappings.metadata[field.name]}
                      </span>
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-gray-400">
                      {dragOverZone === field.name ? '놓으세요!' : '드래그'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
