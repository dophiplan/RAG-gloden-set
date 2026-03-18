# FieldMapping 컴포넌트 롤백 전략 분석

> **문서 버전**: 1.0  
> **작성일**: 2026-03-12  
> **분석 대상**: `src/app/(dashboard)/settings/migration/components/FieldMapping.tsx`

---

## 1. 현재 상황 개요

### 1.1 문제 정의

| 항목 | 내용 |
|------|------|
| **증상** | 원문 필드만 표시되고 나머지 시스템 필드 매핑이 안 됨 |
| **추가 증상** | 체크박스 선택 시 하단 메뉴 안 나옴 |
| **영향 범위** | 데이터 마이그레이션 기능 전체 |
| **심각도** | Critical - 핵심 기능 사용 불가 |

### 1.2 Git 히스토리

```
88390ac fix(migration): 기존 FieldMapping UI로 복원 및 스크롤 문제 해결
66f69df feat(migration): 선택 기능 구현
6a331a2 fix(migration): Critical 버그 수정
...
4aec692 refactor: 데이터 마이그레이션 기능 개선 및 버그 수정  <-- 문제 발생 커밋
```

---

## 2. 원인 분석 (Root Cause Analysis)

### 2.1 핵심 버그: expandedVersion 상태 도입

#### 문제가 된 변경사항 (4aec692 이후)

```typescript
// 현재 버전 (문제 있는 코드)
const [expandedVersion, setExpandedVersion] = useState<string | null>(selectedVersion);

const handleDrop = (e: React.DragEvent, targetType: ..., fieldName?: string) => {
  // ...
  // ❌ 버그: 다른 버전 컬럼 드래그 시 강제로 버전 변경
  if (type === 'column' && sourceVersion && sourceVersion !== selectedVersion) {
    onVersionChange(sourceVersion);  // ← 매핑 대상 버전이 예상치 못하게 변경됨
  }
  // ...
};
```

#### 기존 정상 코드 (_backup 버전)

```typescript
// 백업 버전 (정상 작동)
const handleDrop = (e: React.DragEvent, targetType: ..., fieldName?: string) => {
  // ...
  // ✅ 정상: 다른 버전 컬럼은 무시
  if (type === 'column' && sourceVersion !== selectedVersion) {
    return;  // ← 현재 선택된 버전의 컬럼만 허용
  }
  // ...
};
```

### 2.2 버그 메커니즘

```
[사용자 동작]                          [시스템 반응]
                                     
버전 A 선택 ───────────────────────→  expandedVersion = A
                                     selectedVersion = A
                                     
버전 B 클릭 (확장만意圖) ─────────→  expandedVersion = B
                                     selectedVersion = B
                                     
버전 B 컬럼 드래그                   
  ↓                                  
  → 원문 필드 드롭 ────────────────→  onVersionChange(A) 호출
                                     selectedVersion = A (강제 변경!)
                                     매핑은 A 버전에 저장됨
                                     
  → 번역 필드 드롭 ────────────────→  (A 버전에 저장됨 - 혼란!)
```

### 2.3 파일 컬럼 표시 조건 문제

| 구분 | 현재 버전 | 백업 버전 |
|------|----------|----------|
| 표시 기준 | `expandedVersion` | `selectedVersion` |
| 문제점 | 버전 선택과 파일 컬럼 표시가 분리됨 | 단일 상태로 일관성 유지 |

---

## 3. 롤백 옵션 분석

### 3.1 옵션 A: 완전 롤백

**방법**: `git checkout 4aec692^ -- FieldMapping.tsx`

```bash
# 실행 명령어
git checkout HEAD -- src/app/(dashboard)/settings/migration/_backup/components/FieldMapping.tsx
cp src/app/(dashboard)/settings/migration/_backup/components/FieldMapping.tsx \
   src/app/(dashboard)/settings/migration/components/FieldMapping.tsx
```

| 평가 항목 | 내용 |
|----------|------|
| **장점** | - 즉시 문제 해결<br>- 기존 동작 100% 복원<br>- 테스트 불필요 |
| **단점** | - 4aec692의 개선사항도 함께 롤백<br>- 추후 동일 문제 재발 가능성 |
| **소요 시간** | 5분 |
| **리스크** | 낮음 |

---

### 3.2 옵션 B: 신규 구현 (기존 참고)

**방법**: 기존 코드 구조 분석 후 새로 작성

```typescript
// 개선된 구조 예시
interface FieldMappingState {
  // 단일 진실 공원 (Single Source of Truth)
  selectedVersion: string;
  
  // 매핑 데이터
  allMappings: Record<string, VersionMapping>;
  
  // UI 상태 (순수 UI용)
  uiState: {
    expandedVersions: string[];  // 다중 확장 지원
    selectedColumns: string[];
    dragState: DragState;
  };
}
```

| 평가 항목 | 내용 |
|----------|------|
| **장점** | - 코드 품질 개선<br>- 테스트 코드 작성 가능<br>- 확장성 향상 |
| **단점** | - 개발 시간 소요 (2~3일)<br>- 회귀 테스트 필요<br>- 리소스 투자 큼 |
| **소요 시간** | 2~3일 |
| **리스크** | 중간 (새로운 버그 가능성) |

---

### 3.3 옵션 C: 부분 롤백 + 수정 (권장)

**방법**: 현재 구조 유지하되 버그만 최소한으로 수정

```typescript
// 수정될 코드 (옵션 C)
const FieldMapping = ({ ...props }) => {
  // ✅ 수정 1: expandedVersion 제거, selectedVersion만 사용
  // const [expandedVersion, setExpandedVersion] = useState<string | null>(selectedVersion);
  
  const fileColumns = useMemo(() => {
    const sheet = sheetsData.find(s => s.name === selectedVersion);
    return sheet?.columns || [];
  }, [sheetsData, selectedVersion]);
  
  // ✅ 수정 2: handleDrop 로직 복원
  const handleDrop = (e: React.DragEvent, targetType, fieldName) => {
    // ...
    if (type === 'column' && sourceVersion !== selectedVersion) {
      return;  // 현재 버전의 컬럼만 허용
    }
    // ...
  };
  
  // ✅ 수정 3: 버전 선택 핸들러 단순화
  const handleVersionSelect = (version: string) => {
    saveCurrentMapping();
    onVersionChange(version);  // 토글 로직 제거
  };
};
```

| 평가 항목 | 내용 |
|----------|------|
| **장점** | - 빠른 문제 해결 (30분)<br>- 기존 개선사항 유지<br>- 최소한의 변경 |
| **단점** | - 기술 부채 일부 유지<br>- 코드 복잡도 여전히 존재 |
| **소요 시간** | 30분 ~ 1시간 |
| **리스크** | 낮음 |

---

## 4. 기존 구조 상세 분석

### 4.1 데이터 흐름도

```
┌─────────────────────────────────────────────────────────────────┐
│                        MigrationContext                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ sheetsData  │  │selectedVersion│  │ versionMappings        │  │
│  │ (파일 파싱)  │  │ (현재 버전)  │  │ (버전별 매핑 저장소)    │  │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘  │
└─────────┼────────────────┼─────────────────────┼────────────────┘
          │                │                     │
          ▼                ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FieldMapping Component                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                        State                                │  │
│  │  ┌─────────────────┐  ┌─────────────────────────────────┐  │  │
│  │  │   allMappings   │  │        selectedColumns          │  │  │
│  │  │ (로컬 매핑 캐시) │  │      (다중 선택 상태)           │  │  │
│  │  └─────────────────┘  └─────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                      Sub Components                         │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │  │
│  │  │ VersionItem │  │FileColumnList│  │ DropZone/MultiDropZone│ │  │
│  │  │  (버전 목록) │  │  (파일 컬럼)  │  │    (시스템 필드)      │ │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 버전별 매핑 저장 구조

```typescript
// VersionMapping 인터페이스
interface VersionMapping {
  source: string | null;           // 원문 컬럼
  translations: string[];          // 번역 언어 컬럼들
  metadata: Record<string, string>; // 메타데이터 (key_id, product_category, 등)
  customFields: string[];          // 기타 필드
}

// 전체 매핑 구조
type VersionMappings = Record<string, VersionMapping>;

// 예시
{
  "v1.0": {
    source: "Korean",
    translations: ["English", "Japanese"],
    metadata: {
      key_id: "Key",
      product_category: "Product",
      version: "v1.0",
      platform: "PC,Mobile"
    },
    customFields: ["Description", "Note"]
  },
  "v2.0": { ... }
}
```

### 4.3 컴포넌트 관계도

```
MigrationWizard
    │
    ├── StepIndicator
    │
    ├── UploadStep
    │
    ├── FieldMapping (⚠️ 문제 컴포넌트)
    │       │
    │       ├── VersionItem (버전 목록 아이템)
    │       │       └── DragStateManager (드래그 상태)
    │       │
    │       ├── FileColumnList (파일 컬럼 목록)
    │       │       └── 다중 선택 + 드래그 지원
    │       │
    │       ├── DropZone (단일 드롭존)
    │       │       ├── KEY/ID
    │       │       ├── 제품분류 (required)
    │       │       ├── 원문 (required)
    │       │       ├── 버전
    │       │       ├── 문맥
    │       │       ├── 설명
    │       │       └── 제품코드
    │       │
    │       ├── MultiDropZone (다중 드롭존)
    │       │       └── 번역 언어
    │       │
    │       └── 플랫폼 체크박스 + 기타 필드
    │
    └── PreviewCommitStep
```

---

## 5. 권장 방안

### 5.1 권장 옵션: **옵션 C (부분 롤백 + 수정)**

**선택 이유**:
1. **신속성**: 30분 내 문제 해결 가능
2. **안전성**: 최소한의 변경으로 리스크 최소화
3. **유지보수**: 4aec692의 개선사항(버그 수정 등) 유지

### 5.2 구현 순서

```
Step 1: expandedVersion 상태 제거 (5분)
  └─ selectedVersion만 사용하도록 변경

Step 2: handleDrop 로직 수정 (10분)
  └─ 다른 버전 컬럼 드롭 시 return 처리

Step 3: handleVersionSelect 단순화 (5분)
  └─ 토글 로직 제거, 단순 선택만 수행

Step 4: FileColumnList props 정리 (5분)
  └─ expandedVersion prop 제거

Step 5: 테스트 (10분)
  └─ 원문/번역/메타데이터 매핑 확인
  └─ 버전 전환 시 매핑 유지 확인
  └─ 체크박스 동작 확인
```

### 5.3 예상 소요 시간

| 단계 | 시간 | 산출물 |
|------|------|--------|
| 코드 수정 | 30분 | 수정된 FieldMapping.tsx |
| 로컬 테스트 | 15분 | 테스트 결과 문서 |
| 코드 리뷰 | 15분 | 승인된 PR |
| **총계** | **1시간** | **배포 가능한 코드** |

### 5.4 리스크 완화 전략

| 리스크 | 완화 전략 |
|--------|----------|
| 회귀 버그 | 백업 파일 유지, 즉시 롤백 가능하도록 준비 |
| 데이터 손실 | 매핑 데이터 자동 저장 (sessionStorage) 활용 |
| 사용자 혼란 | 변경사항 최소화로 UI/UX 일관성 유지 |

---

## 6. 장기 개선 제안 (선택사항)

### 6.1 리팩토링 대상

```typescript
// 개선 방향: 상태 관리 단순화
const useFieldMapping = (props: FieldMappingProps) => {
  // 단일 상태로 통합
  const [state, dispatch] = useReducer(fieldMappingReducer, {
    selectedVersion: props.selectedVersion,
    mappings: props.initialMappings || {},
    selectedColumns: [],
    dragState: null,
  });
  
  // 로직 분리
  const handlers = useFieldMappingHandlers(state, dispatch, props);
  
  return { state, ...handlers };
};
```

### 6.2 테스트 전략

```typescript
// 권장 테스트 케이스
describe('FieldMapping', () => {
  it('현재 버전의 컬럼만 매핑 가능', () => {});
  it('버전 전환 시 매핑 데이터 유지', () => {});
  it('드래그 앤 드롭으로 필드 매핑', () => {});
  it('체크박스로 플랫폼 선택', () => {});
  it('required 필드 검증', () => {});
});
```

---

## 7. 결론

### 즉시 실행 권장사항

1. **옵션 C (부분 롤백 + 수정)** 적용
2. **30분 내** 문제 해결 가능
3. **백업 파일**은 유지하여 긴급 롤백 대비

### 최종 판단

| 기준 | 옵션 A | 옵션 B | 옵션 C |
|------|--------|--------|--------|
| 속도 | ⭐⭐⭐ | ⭐ | ⭐⭐⭐ |
| 안전성 | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| 코드 품질 | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **종합 추천** | | | **✅ 권장** |

---

## 부록

### A. 관련 파일 경로

```
src/app/(dashboard)/settings/migration/
├── components/
│   ├── FieldMapping.tsx              ← 현재 버전 (문제)
│   ├── MigrationWizard.tsx
│   ├── StepIndicator.tsx
│   └── steps/
│       ├── UploadStep.tsx
│       └── PreviewCommitStep.tsx
├── _backup/components/
│   └── FieldMapping.tsx              ← 백업 버전 (정상)
└── contexts/
    └── MigrationContext.tsx          ← 상태 관리
```

### B. 긴급 롤백 명령어

```bash
# 완전 롤백이 필요한 경우
cp src/app/(dashboard)/settings/migration/_backup/components/FieldMapping.tsx \
   src/app/(dashboard)/settings/migration/components/FieldMapping.tsx

# 또는 Git 사용
git checkout 88390ac -- src/app/(dashboard)/settings/migration/components/FieldMapping.tsx
```

---

*문서 끝*
