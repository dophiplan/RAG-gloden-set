# 제품분류 매핑 구현 가이드

## Phase 1: 자동 매핑 구현

### 1. FieldMapping.tsx 수정

```typescript
// FieldMapping.tsx
'use client';

import React, { useCallback, useEffect } from 'react';  // useEffect 추가
// ... 기존 imports

export default function FieldMapping({ sheetsData, platforms: propPlatforms }: FieldMappingProps) {
  const {
    state,
    setSelectedVersion,
    setMappingField,
    clearMappingField,
    getMappingForVersion,
  } = useMigration();

  const { selectedVersion, versionMappings } = state;
  const currentMapping = selectedVersion ? getMappingForVersion(selectedVersion) : null;
  
  // 현재 선택된 시트
  const currentSheet = sheetsData.find((s) => s.name === selectedVersion);
  const fileColumns = currentSheet?.columns || [];

  // ═══════════════════════════════════════════════════════════════
  // PHASE 1: 시트 선택 시 제품분류 자동 설정
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (selectedVersion && sheetsData.length > 0) {
      const currentMapping = getMappingForVersion(selectedVersion);
      
      // 제품분류가 비어있으면 시트 이름으로 자동 설정
      if (!currentMapping?.metadata?.product_category) {
        console.log('[FieldMapping] Auto-setting product_category:', selectedVersion);
        setMappingField(selectedVersion, 'metadata.product_category', selectedVersion);
      }
    }
  }, [selectedVersion, sheetsData, getMappingForVersion, setMappingField]);
  // ═══════════════════════════════════════════════════════════════

  // ... 기존 핸들러들
  
  return (
    <div className="grid grid-cols-2 gap-5">
      {/* 왼쪽: 버전 선택 + 파일 컬럼 */}
      {/* ... 기존 코드 ... */}
      
      {/* 오른쪽: 시스템 필드 */}
      <Card padding="sm" className="h-[460px] flex flex-col">
        {/* ... 기존 헤더 ... */}
        
        {!selectedVersion ? (
          <div className="flex-1 flex items-center justify-center text-text-secondary text-sm">
            왼쪽에서 버전을 선택해주세요
          </div>
        ) : (
          <div className="space-y-2 flex-1">
            {/* 원문 + 번역 언어 */}
            {/* ... 기존 코드 ... */}
            
            {/* KEY/ID + 제품분류 */}
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
              
              {/* ═══════════════════════════════════════════════════════════════ */}
              {/* PHASE 1: 제품분류 DropZone - 자동 설정됨을 시각적으로 표시 */}
              {/* ═══════════════════════════════════════════════════════════════ */}
              <DropZone
                label="제품분류*"
                required
                value={currentMapping?.metadata?.product_category}
                placeholder="드래그"
                onDrop={(e) => handleMetadataDrop(e, 'product_category')}
                onClear={() => removeMetadata('product_category')}
                color="purple"
                small
                // 자동 설정된 값을 시각적으로 구분
                autoValue={selectedVersion}
                showAutoIndicator={currentMapping?.metadata?.product_category === selectedVersion}
              />
              {/* ═══════════════════════════════════════════════════════════════ */}
            </div>
            
            {/* 버전 + 문맥 */}
            {/* ... 기존 코드 ... */}
          </div>
        )}
      </Card>
    </div>
  );
}
```

### 2. DropZone 컴포넌트 확장

```typescript
// DropZone 컴포넌트 수정
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
  // ═══════════════════════════════════════════════════════════════
  // PHASE 1: 자동 설정 표시용 props 추가
  // ═══════════════════════════════════════════════════════════════
  autoValue?: string;
  showAutoIndicator?: boolean;
  // ═══════════════════════════════════════════════════════════════
}

function DropZone({ 
  label, 
  value, 
  placeholder, 
  onDrop, 
  onClear, 
  color, 
  required, 
  small, 
  large,
  // ═══════════════════════════════════════════════════════════════
  autoValue,
  showAutoIndicator,
  // ═══════════════════════════════════════════════════════════════
}: DropZoneProps) {
  const colorClasses = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-700', light: 'border-blue-200' },
    green: { bg: 'bg-green-50', border: 'border-green-400', text: 'text-green-700', light: 'border-green-200' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-700', light: 'border-purple-200' },
    gray: { bg: 'bg-gray-50', border: 'border-gray-400', text: 'text-gray-700', light: 'border-gray-200' },
  };

  const c = colorClasses[color];
  const paddingClass = large ? 'p-4' : small ? 'p-1.5' : 'p-3';
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
        <div className="flex flex-col gap-0.5 mt-0.5">
          <div className="flex items-center gap-1">
            <span className="text-primary text-xs">←</span>
            <span className={`font-medium ${c.text} bg-white px-1.5 py-0.5 rounded border ${c.light} text-[10px] truncate`}>
              {value}
            </span>
          </div>
          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* PHASE 1: 자동 설정 표시 */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {showAutoIndicator && (
            <span className="text-[9px] text-gray-400 italic">
              📄 시트 이름에서 자동 설정
            </span>
          )}
          {/* ═══════════════════════════════════════════════════════════════ */}
        </div>
      ) : (
        <p className={`${small ? 'text-[10px]' : 'text-xs'} text-text-secondary mt-0.5`}>{placeholder}</p>
      )}
    </div>
  );
}
```

---

## Phase 2: 오버라이드 UI 구현

### 1. SmartDropZone 컴포넌트 생성

```typescript
// components/SmartDropZone.tsx
'use client';

import React, { useState } from 'react';
import Button from '@/components/ui/Button';

interface SmartDropZoneProps {
  label: string;
  value: string | null | undefined;
  source?: 'column' | 'sheet_name' | 'direct';
  placeholder?: string;
  onDrop: (e: React.DragEvent) => void;
  onClear: () => void;
  onSourceChange?: (source: 'column' | 'sheet_name' | 'direct') => void;
  onDirectInput?: (value: string) => void;
  required?: boolean;
  color?: 'blue' | 'green' | 'purple' | 'gray';
  small?: boolean;
  sheetName?: string;
}

export default function SmartDropZone({
  label,
  value,
  source = 'sheet_name',
  placeholder = '드래그',
  onDrop,
  onClear,
  onSourceChange,
  onDirectInput,
  required,
  color = 'purple',
  small,
  sheetName,
}: SmartDropZoneProps) {
  const [inputMode, setInputMode] = useState<'view' | 'edit'>(source === 'direct' ? 'edit' : 'view');
  const [directValue, setDirectValue] = useState(value || '');

  const colorClasses = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-700', light: 'border-blue-200' },
    green: { bg: 'bg-green-50', border: 'border-green-400', text: 'text-green-700', light: 'border-green-200' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-700', light: 'border-purple-200' },
    gray: { bg: 'bg-gray-50', border: 'border-gray-400', text: 'text-gray-700', light: 'border-gray-200' },
  };

  const c = colorClasses[color];
  const paddingClass = small ? 'p-1.5' : 'p-3';

  const handleSwitchMode = (newSource: 'column' | 'sheet_name' | 'direct') => {
    onSourceChange?.(newSource);
    
    if (newSource === 'direct') {
      setInputMode('edit');
    } else if (newSource === 'sheet_name') {
      setInputMode('view');
      onDirectInput?.(sheetName || '');
    } else {
      setInputMode('view');
    }
  };

  const handleDirectInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDirectValue(e.target.value);
    onDirectInput?.(e.target.value);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={onDrop}
      className={`${paddingClass} rounded-lg border-2 transition-all ${
        value ? `${c.bg} ${c.border}` : 'bg-surface border-dashed border-border-light hover:border-primary'
      }`}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-1">
        <span className={`${small ? 'text-[10px]' : 'text-sm'} font-semibold text-text-main`}>
          {label} {required && <span className="text-red-500">*</span>}
        </span>
        {value && inputMode === 'view' && (
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onClear(); }} className="!p-0.5 h-auto">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        )}
      </div>

      {/* 내용 */}
      {inputMode === 'edit' ? (
        // 직접 입력 모드
        <div className="space-y-1">
          <input
            type="text"
            value={directValue}
            onChange={handleDirectInputChange}
            placeholder="직접 입력..."
            className={`w-full px-2 py-1 text-xs border rounded ${c.light} focus:outline-none focus:ring-1 focus:ring-primary`}
            autoFocus
          />
          <div className="flex gap-1">
            <button
              onClick={() => handleSwitchMode('sheet_name')}
              className="text-[9px] text-gray-500 hover:text-primary underline"
            >
              📄 시트명 사용
            </button>
            <span className="text-[9px] text-gray-300">|</span>
            <button
              onClick={() => handleSwitchMode('column')}
              className="text-[9px] text-gray-500 hover:text-primary underline"
            >
              ⬅️ 컬럼 매핑
            </button>
          </div>
        </div>
      ) : (
        // 보기 모드
        <>
          {value ? (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1">
                <span className="text-primary text-xs">←</span>
                <span className={`font-medium ${c.text} bg-white px-1.5 py-0.5 rounded border ${c.light} text-[10px] truncate`}>
                  {value}
                </span>
              </div>
              {/* 소스 표시 */}
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-gray-400 italic">
                  {source === 'sheet_name' && '📄 시트 이름에서 자동 설정'}
                  {source === 'column' && '⬅️ 컬럼에서 매핑'}
                  {source === 'direct' && '✏️ 직접 입력'}
                </span>
                <button
                  onClick={() => handleSwitchMode('direct')}
                  className="text-[9px] text-primary hover:underline"
                >
                  ✏️ 직접 입력
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <p className={`${small ? 'text-[10px]' : 'text-xs'} text-text-secondary`}>{placeholder}</p>
              {sheetName && (
                <button
                  onClick={() => handleSwitchMode('sheet_name')}
                  className="text-[9px] text-primary hover:underline text-left"
                >
                  📄 '{sheetName}' 시트 이름 사용
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

### 2. FieldMapping에서 SmartDropZone 사용

```typescript
// FieldMapping.tsx - 제품분류 부분만 수정
import SmartDropZone from './SmartDropZone';

// ...

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
  
  {/* SmartDropZone 사용 */}
  <SmartDropZone
    label="제품분류*"
    required
    value={currentMapping?.metadata?.product_category}
    source={currentMapping?.metadataSource?.product_category || 'sheet_name'}
    placeholder="드래그"
    sheetName={selectedVersion}
    onDrop={(e) => handleMetadataDrop(e, 'product_category')}
    onClear={() => removeMetadata('product_category')}
    onSourceChange={(source) => {
      setMappingField(selectedVersion!, 'metadataSource.product_category', source);
      if (source === 'sheet_name') {
        setMappingField(selectedVersion!, 'metadata.product_category', selectedVersion);
      } else if (source === 'column') {
        setMappingField(selectedVersion!, 'metadata.product_category', null);
      }
    }}
    onDirectInput={(value) => {
      setMappingField(selectedVersion!, 'metadata.product_category', value);
    }}
    color="purple"
    small
  />
</div>
```

### 3. MigrationContext 타입 확장

```typescript
// MigrationContext.tsx
export interface VersionMapping {
  source: string | null;
  translations: string[];
  metadata: Record<string, string>;
  // 추가: 메타데이터 소스 추적
  metadataSource?: Record<string, 'column' | 'sheet_name' | 'direct'>;
  customFields: string[];
}
```

---

## Phase 3: API 수정

### preview/route.ts (변경 없음 - 이미 지원)

```typescript
// Line 245-247: fieldMappings.metadata.product_category 사용
const mappedProduct = fieldMappings?.metadata?.product_category 
  ? row[fieldMappings.metadata.product_category] 
  : (row.product || row.product_category || undefined);

// PreviewEntry에 product_category 포함
entries.push({
  id: uuidv4(),
  source_text: sourceText,
  product_category: mappedProduct,  // 사용자 매핑 값 사용
  // ...
});
```

### commit/route.ts (변경 없음 - 이미 지원)

```typescript
// Line 564: translation_products에 product_category 저장
const { data: tpData, error: tpError } = await adminClient
  .from('translation_products')
  .insert({
    translation_id: translation.id,
    product_code: product_code,
    version: version || null,
    product_category: entry.product_category || null,  // 사용자 매핑 값 저장
  })
  // ...
```

---

## 테스트 체크리스트

### Phase 1 테스트
- [ ] Excel 파일 업로드 후 시트 선택 시 제품분류에 시트 이름 자동 표시
- [ ] 자동 설정된 값이 Preview API 요청에 포함되는지 확인
- [ ] 자동 설정된 값이 Preview 테이블에 노출되는지 확인
- [ ] 자동 설정된 값이 Commit 시 DB에 저장되는지 확인

### Phase 2 테스트
- [ ] [직접 입력] 버튼 클릭 시 텍스트 입력 필드 표시
- [ ] 직접 입력한 값이 Preview/Commit에 반영
- [ ] [시트명 사용] 버튼 클릭 시 시트 이름으로 복원
- [ ] [컬럼 매핑] 버튼 클릭 시 드래그 앤 드롭 활성화
- [ ] 컬럼 드래그 시 해당 컬럼 값 사용

### Phase 3 테스트
- [ ] 여러 시트 마이그레이션 시 각 시트별 제품분류 설정 확인
- [ ] 세션 저장/복원 시 metadataSource도 복원되는지 확인
