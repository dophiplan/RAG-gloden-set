# Architecture: 선택 마이그레이션 기능

## 개요
사용자는 마이그레이션 미리보기 화면에서 체크박스로 특정 항목을 선택하고, "이것만 마이그레이션 하기" 기능을 통해 선택한 항목만 DB에 반영할 수 있어야 합니다.

---

## 1. 기술적 가능성: ✅ 가능

### 근거
- 현재 `commitMigration` 함수는 `state.entries` 배열을 API로 전송
- API는 `entries` 배열을 순회하며 처리 - 필터링 로직 없음
- **핵심**: 클라이언트에서 선택된 항목만 `entries`에 담아 전송하면 구현 가능
- 백엔드 API 수정 불필요 (기존 `/api/migration/commit` 그대로 사용)

### 데이터 흐름
```
[현재]
전체 entries → commitMigration() → /api/migration/commit → 전체 처리

[변경 후 - 선택 마이그레이션]
선택된 entries → commitMigration(selectedEntries) → /api/migration/commit → 선택 항목만 처리
```

---

## 2. UX 흐름

### 시나리오 1: 전체 마이그레이션 (기존 유지)
```
[미리보기] → [하단: 마이그레이션 실행 버튼] → [모달 확인] → 전체 commit
```

### 시나리오 2: 선택 마이그레이션 (신규)
```
[미리보기] → [일부 항목 체크] → [하단: "이것만 마이그레이션 하기" 버튼] → [모달 확인] → 선택 항목만 commit
```

### 하단 액션 바 변경
```
현재: [용어집에 추가] [일괄 삭제]
        ↓
변경: [용어집에 추가] [삭제] [이것만 마이그레이션 하기]

※ 버튼 레이아웃: 번역관리 화면의 벌크 액션과 유사한 패턴 적용
```

---

## 3. 구현 방안 비교

| 방안 | 구현 방식 | 장점 | 단점 | 권장 |
|-----|----------|-----|------|-----|
| **A: 필터링 방식** ✅ | 선택된 ID로 entries 필터링 후 commit | • 백엔드 수정 불필요<br>• 구현 간단<br>• 직관적 | • 선택 해제 후 재시도 필요 | **⭐ 권장** |
| B: 분리된 배열 | `selectedEntries` 별도 상태 관리 | • 원본 보존 | • 상태 복잡성 증가<br>• 메모리 중복 | - |
| C: action 마커 | 선택 항목에 `action: 'commit'` 마킹 | • 백엔드 필터링 가능 | • API 수정 필요<br>• 복잡도 증가 | - |

### 권장 방안: A (필터링 방식)
**이유**:
1. 최소한의 코드 변경으로 기능 구현 가능
2. 기존 마이그레이션 플로우와 완전히 호환
3. 사용자 입장에서 "선택 = 마이그레이션 대상" 직관적 이해
4. 롤백/결과 표시 로직도 기존과 동일하게 작동

---

## 4. 변경 파일 및 예상 코드

### 4.1 PreviewCommitStep.tsx
**변경 내용**: 하단 액션 바에 "이것만 마이그레이션 하기" 버튼 추가

```tsx
// Props 추가
interface PreviewCommitStepProps {
  // ... 기존 props
  onMigrateSelected?: (ids: string[]) => void;  // 신규
}

// 하단 액션 바 변경 (약 548-594라인)
{selectedIds.length > 0 && (
  <div className="fixed bottom-0 left-0 right-0 bg-gray-800 shadow-lg z-50">
    <div className="max-w-7xl mx-auto px-4 py-4">
      <div className="flex items-center justify-between gap-4">
        {/* 좌측: 선택 개수 */}
        <div className="flex items-center gap-4">
          <span className="flex items-center justify-center w-6 h-6 bg-white/20 rounded-full text-white text-sm font-bold">
            {selectedIds.length}
          </span>
          <span className="text-sm font-medium text-white">개 선택됨</span>
        </div>
        
        {/* 우측: 액션 버튼들 */}
        <div className="flex items-center gap-3">
          {/* 용어집에 추가 */}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onBulkUpdate('glossary')}
            className="bg-white text-gray-800 hover:bg-gray-100"
          >
            용어집에 추가
          </Button>
          
          {/* 삭제 */}
          {onBulkDelete && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onBulkDelete(selectedIds)}
              className="bg-red-600 text-white hover:bg-red-700 border-red-600"
            >
              삭제
            </Button>
          )}
          
          <div className="w-px h-6 bg-white/30" />
          
          {/* ⭐ 이것만 마이그레이션 하기 (신규) */}
          {onMigrateSelected && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => onMigrateSelected(selectedIds)}
              className="bg-emerald-500 text-white hover:bg-emerald-600 font-medium"
            >
              <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              이것만 마이그레이션 하기
            </Button>
          )}
        </div>
      </div>
    </div>
  </div>
)}
```

### 4.2 MigrationContext.tsx
**변경 내용**: 선택 항목만 마이그레이션하는 함수 추가

```tsx
// Context Type에 추가
interface MigrationContextType {
  // ... 기존
  commitMigration: () => Promise<CommitResponse>;  // 기존: 전체
  commitSelectedMigration: (ids: string[]) => Promise<CommitResponse>;  // 신규: 선택
}

// commitSelectedMigration 함수 구현 (commitMigration 기반)
const commitSelectedMigration = useCallback(async (ids: string[]): Promise<CommitResponse> => {
  dispatch({ type: 'COMMIT_START' });

  // 선택된 항목만 필터링
  const selectedEntries = state.entries.filter(e => ids.includes(e.id));
  
  if (selectedEntries.length === 0) {
    dispatch({ type: 'COMMIT_ERROR', payload: '선택된 항목이 없습니다.' });
    throw new Error('선택된 항목이 없습니다.');
  }

  const requestBody = {
    entries: selectedEntries.map((e) => {
      let action: 'import' | 'skip' | 'merge' | 'overwrite';
      const category = e.category || e.suggested_category;
      const existsInGlossary = e.existing_in_glossary;
      const existsInTranslation = e.existing_in_translation;

      if (category === 'glossary') {
        action = existsInGlossary ? 'skip' : 'import';
      } else {
        action = existsInTranslation ? 'merge' : 'import';
      }

      return {
        id: e.id,
        source_text: e.source_text,
        context: e.context,
        product_category: e.product,
        translations: e.translations,
        category: category,
        action: action,
      };
    }),
    product_code: state.productCode || undefined,
    version: state.version || null,
  };

  try {
    const data = await apiFetch<CommitResponse>('/api/migration/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    dispatch({ type: 'COMMIT_SUCCESS', payload: data });
    return data;
  } catch (err: any) {
    dispatch({ type: 'COMMIT_ERROR', payload: err.message });
    throw err;
  }
}, [state.entries, state.productCode, state.version]);
```

### 4.3 MigrationWizard.tsx
**변경 내용**: 선택 마이그레이션 핸들러 추가 및 Props 전달

```tsx
const {
  // ... 기존
  commitMigration,
  commitSelectedMigration,  // Context에서 추가
} = useMigration();

// 선택 마이그레이션 핸들러 (신규)
const handleMigrateSelected = useCallback((ids: string[]) => {
  // 선택된 항목만으로 모달 통계 계산
  const selectedEntriesList = entries.filter(e => ids.includes(e.id));
  setSelectedMigrationData({
    ids,
    entries: selectedEntriesList,
    stats: calculateStatsForEntries(selectedEntriesList)
  });
  setIsPrecommitModalOpen(true);
}, [entries]);

// 모달에서 확인 후 실행
const handleConfirmMigration = useCallback(async () => {
  setIsPrecommitModalOpen(false);
  try {
    if (selectedMigrationData?.ids) {
      // 선택 마이그레이션
      const result = await commitSelectedMigration(selectedMigrationData.ids);
    } else {
      // 전체 마이그레이션
      const result = await commitMigration();
    }
  } catch (err: any) {
    showToast(err.message, 'error');
  }
}, [commitMigration, commitSelectedMigration, selectedMigrationData, showToast]);

// PreviewCommitStep에 prop 전달
<PreviewCommitStep
  // ... 기존 props
  onMigrateSelected={handleMigrateSelected}  // 신규
/>
```

### 4.4 PrecommitConfirmModal.tsx
**변경 내용**: 선택 마이그레이션 모드 지원

```tsx
interface PrecommitConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  stats: { total: number; import: number; merge: number; skip: number };
  entries: Array<{
    id: string;
    source_text: string;
    category?: 'glossary' | 'translation';
    existing_in_glossary: boolean;
    existing_in_translation: boolean;
  }>;
  mode?: 'all' | 'selected';  // 신규: 모드 구분
  selectedCount?: number;      // 신규: 선택 개수
}

// 모달 헤더 및 메시지 변경
const title = mode === 'selected' 
  ? `선택한 ${selectedCount}개 항목 마이그레이션` 
  : '마이그레이션 확인';

const description = mode === 'selected'
  ? '선택한 항목만 마이그레이션됩니다.'
  : '모든 항목이 마이그레이션됩니다.';
```

### 4.5 MigrationResult.tsx
**변경 내용**: 선택 마이그레이션 결과 표시 (필요시)

- 선택 마이그레이션 결과는 기존 UI로 충분
- 결과 메시지에 "선택한 X개 항목 중 Y개 처리됨" 추가 가능

---

## 5. 구현 계획

### Phase 1: Core 기능 (1-2시간)
1. [ ] `MigrationContext.tsx`에 `commitSelectedMigration` 함수 추가
2. [ ] `PreviewCommitStep.tsx`에 버튼 추가 및 Props 연결
3. [ ] `MigrationWizard.tsx`에 핸들러 구현

### Phase 2: UX 개선 (1시간)
4. [ ] `PrecommitConfirmModal.tsx` 모드 지원
5. [ ] 버튼 스타일 및 레이아웃 조정
6. [ ] 선택 해제 시 버튼 상태 처리

### Phase 3: 테스트 (1시간)
7. [ ] 선택 마이그레이션 E2E 테스트
8. [ ] 전체 마이그레이션 정상 동작 확인
9. [ ] 롤백 기능 선택 마이그레이션에서도 작동 확인

---

## 6. 영향 범위 체크리스트

| 컴포넌트/파일 | 변경 유형 | 비고 |
|-------------|----------|------|
| PreviewCommitStep.tsx | 수정 | 버튼 추가, Props 확장 |
| MigrationContext.tsx | 수정 | 함수 추가 |
| MigrationWizard.tsx | 수정 | 핸들러 연결 |
| PrecommitConfirmModal.tsx | 수정 | 모드 지원 |
| /api/migration/commit | ❌ 변경 없음 | 기존 API 그대로 사용 |
| /api/migration/preview | ❌ 변경 없음 | 영향 없음 |
| MigrationResult.tsx | 선택적 수정 | 메시지 추가 가능 |

---

## 7. 주의사항 및 고려사항

### UX 고려사항
1. **선택 vs 전체 구분**: 사용자가 현재 "선택 마이그레이션"인지 "전체 마이그레이션"인지 명확히 인지할 수 있어야 함
2. **선택 해제**: 마이그레이션 후 선택 상태 초기화 필요
3. **빈 선택 처리**: 선택된 항목이 0개일 때 버튼 비활성화

### 기술 고려사항
1. **에러 처리**: 선택 마이그레이션 실패 시 롤백은 기존과 동일하게 작동
2. **성능**: 대량 선택 시에도 API 전송 크기만 줄어듦 (성능 향상)
3. **일관성**: `versionEntries`와 `entries` 모두에서 선택된 항목 필터링 필요

### 롤백 고려사항
- 선택 마이그레이션도 `batchId` 생성됨
- 롤백 API는 기존과 동일하게 사용 가능

---

## 8. API 명세 (확인)

### POST /api/migration/commit
**요청 본문** (기존과 동일)
```json
{
  "entries": [
    {
      "id": "string",
      "source_text": "string",
      "context": "string?",
      "product_category": "string?",
      "translations": { "ko": "...", "en": "..." },
      "category": "glossary" | "translation",
      "action": "import" | "skip" | "merge" | "overwrite"
    }
  ],
  "product_code": "string",
  "version": "string?"
}
```

**응답** (기존과 동일)
```json
{
  "success": true,
  "batchId": "string",
  "processingTimeMs": 1234,
  "glossary": { "created": 5, "skipped": 2, "errors": [] },
  "translations": { "created": 10, "updated": 3, "skipped": 1, "errors": [] }
}
```

---

## 결론

**방안 A (필터링 방식)** 로 구현 시:
- 백엔드 수정 없이 프론트엔드만으로 구현 가능
- 기존 코드와 100% 호환
- 예상 개발 시간: 3-4시간
- 리스크: 낮음

사용자의 요구사항을 충족하면서도 기존 기능을 해치지 않는 최적의 설계입니다.
