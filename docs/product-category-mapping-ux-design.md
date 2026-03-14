# 제품분류(Product Category) 매핑 UX 설계

## 1. 개요

### 현재 문제
- Excel 파일의 "버전" 컬럼이 **비어있음** (null)
- 사용자는 각 시트 이름을 **제품분류**로 사용하고 싶음
- 현재 FieldMapping UI는 **컬럼 드래그만** 지원 → 직접 값 입력 불가

### 핵심 요구사항
> "사용자가 직접 매핑한 값이 테이블에 노출되어야 한다"

---

## 2. 해결 방안 비교

### 방안 A: 시트 이름 자동 매핑 (권장)

#### UX 흐름
```
[Upload Step]
  ↓
파일 업로드 → 시트 목록 표시
  ↓
[Mapping Step]
  ↓
시트 선택 → 시트 이름이 제품분류에 자동으로 표시
  ↓
(사용자가 오버라이드 가능)
```

#### 화면 설계
```
┌─────────────────────────────────────────────────┐
│  시스템 필드 (RMAndroid)                         │
├─────────────────────────────────────────────────┤
│  원문:     values          ← 드래그됨           │
│  번역:     values-ko, values-ja                 │
│                                                 │
│  제품분류: RMAndroid ★    ← 시트명 자동 표시    │
│            └─ [직접 입력으로 변경] 토글          │
│                                                 │
│  버전:     (비어있음)      ← 드래그 가능        │
└─────────────────────────────────────────────────┘
```

#### 기술 구현
```typescript
// FieldMapping.tsx 수정
const currentSheet = sheetsData.find((s) => s.name === selectedVersion);

// 시트 선택 시 자동으로 제품분류 설정
useEffect(() => {
  if (selectedVersion && !currentMapping?.metadata?.product_category) {
    setMappingField(selectedVersion, 'metadata.product_category', selectedVersion);
  }
}, [selectedVersion]);
```

**장점:**
- 직관적이고 자동화됨
- 기존 UI 변경 최소
- 개발 비용 낮음

**단점:**
- 시트 이름 외 다른 값 사용 시 수동 변경 필요

---

### 방안 B: FieldMapping에 "직접 입력" 옵션

#### UX 흐름
```
[DropZone] ← "제품분류"
  ├── "컬럼에서 선택" (드래그 앤 드롭)
  └── "직접 입력" (토글 클릭)
        ↓
    [텍스트 입력 필드 표시]
        ↓
    사용자가 "RMAndroid" 입력
```

#### 화면 설계
```
┌─────────────────────────────────────────────────┐
│  제품분류*  [컬럼선택 ▼] [직접입력 ▼]            │
├─────────────────────────────────────────────────┤
│  [드래그 영역]  또는  [텍스트 입력 ┌─────────┐]  │
│   ↓ 여기로 드래그            │RMAndroid│      │
│                              └─────────┘      │
└─────────────────────────────────────────────────┘
```

#### 기술 구현
```typescript
// DropZone 컴포넌트 확장
interface DropZoneProps {
  // ... 기존 props
  allowDirectInput?: boolean;  // 직접 입력 허용
  directInputMode?: 'column' | 'text';
  onChangeMode?: (mode: 'column' | 'text') => void;
  onTextInput?: (value: string) => void;
}

// VersionMapping 타입 확장
interface VersionMapping {
  source: string | null;
  translations: string[];
  metadata: Record<string, string>;
  metadataInputMode?: Record<string, 'column' | 'text'>;  // 입력 모드 저장
  customFields: string[];
}
```

**장점:**
- 유연성 높음
- 컬럼 값 사용 or 직접 입력 모두 가능

**단점:**
- UI 복잡도 증가
- 사용자에게 선택 부담

---

### 방안 C: 시트 선택 단계 추가

#### UX 흐름
```
[Upload Step]
  ↓
파일 업로드
  ↓
[Sheet Selection Step] ← NEW
  ↓
┌────────────────────────────────────────────────┐
│  마이그레이션할 시트 선택                        │
│  ┌─────────────┬─────────────────────────┐     │
│  │ ☑ RMAndroid │ 제품분류: [RMAndroid  ] │     │
│  │ ☑ RMStandard│ 제품분류: [RMStandard ] │     │
│  │ ☐ sass_sfu  │                         │     │
│  └─────────────┴─────────────────────────┘     │
└────────────────────────────────────────────────┘
  ↓
[Mapping Step] - 선택된 시트들 한꺼번에 표시
```

#### 기술 구현
```typescript
// MigrationContext에 추가
interface MigrationState {
  // ... 기존
  selectedSheets: string[];  // 다중 시트 선택
  sheetCategoryOverrides: Record<string, string>;  // 시트별 제품분류 오버라이드
}
```

**장점:**
- 한 번에 여러 시트 마이그레이션 가능
- 대용량 업로드에 효율적

**단점:**
- 기존 3단계 → 4단계로 변경 (큰 구조 변경)
- 개발 비용 높음

---

### 방안 D: 버전 컬럼 기본값 채우기

#### UX 흐름
```
[Preview API]
  ↓
버전 컬럼이 비어있음 감지
  ↓
해당 행의 시트 이름을 product_category로 사용
  ↓
Preview 테이블에 "(시트명에서 자동 추출)" 표시
```

#### 기술 구현
```typescript
// preview/route.ts 수정 (line 245-247)
const mappedProduct = fieldMappings?.metadata?.product_category 
  ? row[fieldMappings.metadata.product_category] 
  : (row.product || row.product_category || selectedVersion || undefined);  // ← fallback 추가
```

**장점:**
- 프론트엔드 변경 없음
- 빠른 구현

**단점:**
- "사용자가 직접 매핑한 값"이라는 요구사항 미충족
- 투명성 부족 (자동으로 처리되어 사용자 인지 못함)

---

## 3. 권장 방안: 방안 A + 방안 B 하이브리드

### 선택 이유
| 기준 | 평가 |
|------|------|
| 사용자 경험 | ★★★★★ 자동 + 수동 오버라이드 가능 |
| 개발 비용 | ★★★★☆ 기존 컴포넌트 재활용 |
| 유지보수 | ★★★★★ 단순한 로직 |
| 확장성 | ★★★★☆ 향후 직접 입력 모드 추가 가능 |

### 최종 화면 설계

```
┌─────────────────────────────────────────────────────────┐
│  시스템 필드 (RMAndroid)                                 │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌───────────────────────────────────┐ │
│  │ 원문 *       │ │ 번역 언어                         │ │
│  │ ← values     │ │ ← values-ko, values-ja, ...       │ │
│  └──────────────┘ └───────────────────────────────────┘ │
│  ┌──────────────┐ ┌───────────────────────────────────┐ │
│  │ KEY / ID     │ │ 제품분류 *                        │ │
│  │              │ │ ← RMAndroid (시트 이름)           │ │
│  │              │ │    [✏️ 직접 입력으로 변경]         │ │
│  └──────────────┘ └───────────────────────────────────┘ │
│  ┌──────────────┐ ┌───────────────────────────────────┐ │
│  │ 버전         │ │ 문맥                              │ │
│  │              │ │                                   │ │
│  └──────────────┘ └───────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 상세 동작

#### 1. 시트 선택 시 자동 매핑
```typescript
// FieldMapping.tsx
useEffect(() => {
  if (selectedVersion) {
    const currentMapping = getMappingForVersion(selectedVersion);
    
    // 제품분류가 비어있으면 시트 이름으로 자동 설정
    if (!currentMapping?.metadata?.product_category) {
      setMappingField(selectedVersion, 'metadata.product_category', selectedVersion);
      // 입력 모드도 함께 저장
      setMappingField(selectedVersion, 'metadataInputMode.product_category', 'sheet_name');
    }
  }
}, [selectedVersion]);
```

#### 2. 사용자 오버라이드
```typescript
// 사용자가 직접 입력으로 변경 클릭
const handleSwitchToDirectInput = () => {
  setMappingField(selectedVersion, 'metadataInputMode.product_category', 'direct');
  // 입력 필드로 UI 변경
};

// 사용자가 컬럼 매핑으로 변경 클릭
const handleSwitchToColumn = () => {
  setMappingField(selectedVersion, 'metadata.product_category', null);
  setMappingField(selectedVersion, 'metadataInputMode.product_category', 'column');
};
```

#### 3. 시각적 표시
```typescript
// DropZone에 inputMode 표시 추가
function DropZone({ label, value, inputMode, ...props }: DropZoneProps) {
  return (
    <div className="...">
      <div className="flex items-center justify-between">
        <span>{label}</span>
        {inputMode && (
          <span className="text-[10px] text-gray-400">
            {inputMode === 'sheet_name' && '📄 시트 이름'}
            {inputMode === 'direct' && '✏️ 직접 입력'}
            {inputMode === 'column' && '⬅️ 컬럼 매핑'}
          </span>
        )}
      </div>
      {/* ... */}
    </div>
  );
}
```

---

## 4. 기술 구현 계획

### Phase 1: 자동 매핑 (MVP)
**예상 소요: 0.5일**

#### 수정 파일
1. `FieldMapping.tsx` - 시트 선택 시 자동 설정
2. `MigrationContext.tsx` - 상태 관리 (옵션)

#### 구현 내용
```typescript
// FieldMapping.tsx - useEffect 추가
React.useEffect(() => {
  if (selectedVersion && sheetsData.length > 0) {
    const currentMapping = getMappingForVersion(selectedVersion);
    const currentSheet = sheetsData.find((s) => s.name === selectedVersion);
    
    // 제품분류가 비어있고, "버전" 컬럼이 없거나 비어있으면
    if (!currentMapping?.metadata?.product_category && currentSheet) {
      // 시트 이름을 제품분류로 자동 설정
      setMappingField(selectedVersion, 'metadata.product_category', selectedVersion);
    }
  }
}, [selectedVersion, sheetsData, getMappingForVersion, setMappingField]);
```

---

### Phase 2: 오버라이드 UI (Enhanced)
**예상 소요: 1일**

#### 수정 파일
1. `FieldMapping.tsx` - DropZone 확장
2. `MigrationContext.tsx` - metadataInputMode 상태 추가

#### 구현 내용
```typescript
// VersionMapping 타입 확장
interface VersionMapping {
  source: string | null;
  translations: string[];
  metadata: Record<string, string>;
  // 추가
  metadataSource?: Record<string, 'column' | 'sheet_name' | 'direct'>;
  customFields: string[];
}

// DropZone에 mode 토글 추가
<DropZone
  label="제품분류"
  value={currentMapping?.metadata?.product_category}
  source={currentMapping?.metadataSource?.product_category}
  allowSourceToggle
  onSourceChange={(source) => handleSourceChange('product_category', source)}
  // ...
/>
```

---

### Phase 3: 직접 입력 지원 (Advanced)
**예상 소요: 1일**

#### 수정 파일
1. `FieldMapping.tsx` - 텍스트 입력 모드 추가
2. `DropZone` 컴포넌트 - input mode 지원

#### 구현 내용
```typescript
// DropZone 내부
const [inputMode, setInputMode] = React.useState<'column' | 'text'>('column');
const [textValue, setTextValue] = React.useState(value || '');

// 텍스트 모드일 때
{inputMode === 'text' && (
  <input
    type="text"
    value={textValue}
    onChange={(e) => {
      setTextValue(e.target.value);
      onTextInput?.(e.target.value);
    }}
    placeholder="직접 입력..."
    className="..."
  />
)}
```

---

## 5. API 수정 필요사항

### preview/route.ts
```typescript
// Line 245-247 수정: 시트 이름 fallback 추가
const mappedProduct = fieldMappings?.metadata?.product_category 
  ? row[fieldMappings.metadata.product_category] 
  : (row.product || row.product_category || selectedVersion || undefined);
```

### commit/route.ts
```typescript
// Line 564: 이미 product_category 저장됨
product_category: entry.product_category || null,
```

**DB 변경 필요 없음** - `translation_products.product_category` 컬럼 이미 존재

---

## 6. 테스트 시나리오

### 시나리오 1: 자동 매핑
```gherkin
Given 사용자가 Excel 파일 업로드 (시트: RMAndroid)
When "RMAndroid" 시트 선택
Then 제품분류에 "RMAndroid" 자동 표시
And Preview API 호출 시 product_category="RMAndroid" 전송
```

### 시나리오 2: 오버라이드
```gherkin
Given 자동 매핑된 제품분류 "RMAndroid"
When 사용자가 "직접 입력으로 변경" 클릭
And "RMAndroid-Pro" 입력
Then 제품분류에 "RMAndroid-Pro" 표시
And Preview API 호출 시 product_category="RMAndroid-Pro" 전송
```

### 시나리오 3: 컬럼 매핑
```gherkin
Given "버전" 컬럼이 존재하는 Excel 파일
When 사용자가 "컬럼 매핑으로 변경" 클릭
And "버전" 컬럼 드래그
Then 제품분류에 해당 행의 "버전" 값 표시
```

---

## 7. 결론

### 권장 구현: Phase 1 (자동 매핑) 먼저 적용
- **즉시 해결**: 버전 컬럼이 비어있는 문제
- **사용자 요구 충족**: 시트 이름을 제품분류로 자동 사용
- **향후 확장**: Phase 2/3으로 오버라이드 기능 추가 가능

### 기대 효과
1. **사용자**: 추가 조작 없이 원하는 결과 얻음
2. **개발**: 최소한의 코드 변경으로 빠른 배포
3. **유지보수**: 단순한 로직으로 관리 용이
