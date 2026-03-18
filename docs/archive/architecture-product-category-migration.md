# Architecture Analysis: 제품 분류(Product Category) 저장 기능 구현

## 1. 개요 (Overview)

### 현재 상황
- 마이그레이션 FieldMapping에서 "제품분류(product_category)" 필드로 매핑 가능
- `/api/migration/preview` API에서는 `product_category`를 PreviewEntry의 `product` 필드로 매핑
- **문제**: `/api/migration/commit` API에서 `product_category`가 저장되지 않음

### 목표
- 마이그레이션 시 제품 분류(product_category) 데이터를 DB에 정식으로 저장
- 저장된 product_category를 활용한 필터 기능 제공

---

## 2. DB 스키마 분석 (Database Schema Analysis)

### 2.1 현재 테이블 구조

#### glossary 테이블
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| term | TEXT | 용어 |
| translation | TEXT | 번역 |
| language_code | TEXT | 언어 코드 |
| context | TEXT | 문맥 |
| user_id | UUID | 사용자 ID |
| product_code | TEXT | 제품 코드 (deprecated) |
| created_at | TIMESTAMP | 생성일 |
| updated_at | TIMESTAMP | 수정일 |

**결론**: `product_category` 컬럼 **없음**

#### glossary_products 테이블 (Many-to-Many)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| glossary_id | UUID | FK -> glossary.id |
| product_code | TEXT | 제품 코드 |
| version | TEXT | 버전 |
| version_updated_at | TIMESTAMP | 버전 업데이트 일시 |
| created_at | TIMESTAMP | 생성일 |

**결론**: `product_category` 컬럼 **없음**

#### translations 테이블
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| source_text | TEXT | 원문 |
| context | TEXT | 문맥 |
| status | TEXT | 상태 |
| priority | TEXT | 우선순위 |
| version | TEXT | 버전 |
| product_code | TEXT | 제품 코드 (deprecated) |
| user_id | UUID | 사용자 ID |
| created_at | TIMESTAMP | 생성일 |
| updated_at | TIMESTAMP | 수정일 |

**결론**: `product_category` 컬럼 **없음**

#### translation_products 테이블 (Many-to-Many)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| translation_id | UUID | FK -> translations.id |
| product_code | TEXT | 제품 코드 |
| version | TEXT | 버전 |
| version_updated_at | TIMESTAMP | 버전 업데이트 일시 |
| created_at | TIMESTAMP | 생성일 |

**결론**: `product_category` 컬럼 **없음**

### 2.2 필요한 DB 변경사항

```sql
-- glossary_products 테이블에 product_category 추가
ALTER TABLE public.glossary_products
  ADD COLUMN IF NOT EXISTS product_category TEXT;

-- translation_products 테이블에 product_category 추가
ALTER TABLE public.translation_products
  ADD COLUMN IF NOT EXISTS product_category TEXT;

-- 인덱스 생성 (필터 성능을 위해)
CREATE INDEX IF NOT EXISTS idx_glossary_products_product_category
  ON public.glossary_products(product_category);

CREATE INDEX IF NOT EXISTS idx_translation_products_product_category
  ON public.translation_products(product_category);
```

---

## 3. 타입 정의 분석 (Type Definitions Analysis)

### 3.1 PreviewEntry 인터페이스

**현재 위치**: 
- `/src/app/api/migration/preview/route.ts` (line 8)
- `/src/app/(dashboard)/settings/migration/contexts/MigrationContext.tsx` (line 33)

**현재 정의**:
```typescript
interface PreviewEntry {
  id: string;
  source_text: string;
  context?: string;
  translations: Record<string, string>;
  suggested_category: EntryCategory;
  word_count: number;
  duplicate_status: {...};
  category?: EntryCategory;
  existing_in_glossary: boolean;
  existing_in_translation: boolean;
  // 메타데이터 필드
  key?: string;
  product?: string;        // ← product_category가 여기로 매핑됨
  version?: string;
  platform?: string;
  note?: string;
}
```

**분석**: 
- `product` 필드는 있지만 명확하지 않음
- `product_category` 필드를 명시적으로 추가하거나, `product` 필드 문서화 필요

### 3.2 CommitEntry 인터페이스

**현재 위치**: `/src/app/api/migration/commit/route.ts` (line 5)

**현재 정의**:
```typescript
interface CommitEntry {
  id: string;
  source_text: string;
  context?: string;
  translations: Record<string, string>;
  category: 'glossary' | 'translation';
  action: 'import' | 'skip' | 'merge' | 'overwrite';
  // product_category 필드 없음!
}
```

**분석**: 
- `product_category` 필드 **없음**
- PreviewEntry에서 product_category를 추출하여 CommitEntry에 추가 필요

---

## 4. API 흐름 분석 (API Flow Analysis)

### 4.1 Preview API (`/api/migration/preview`)

**파일**: `/src/app/api/migration/preview/route.ts`

**현재 동작** (line 162-164):
```typescript
const mappedProduct = fieldMappings?.metadata?.product_category 
  ? row[fieldMappings.metadata.product_category] 
  : (row.product || row.product_category || undefined);
```

**PreviewEntry 생성** (line 173-186):
```typescript
entries.push({
  id: uuidv4(),
  source_text: sourceText,
  context,
  product: mappedProduct,    // ← product_category 값이 여기 저장됨
  platform: mappedPlatform,
  version: mappedVersion,
  key: row.key || row.id || row.key_id || undefined,
  note: row.note || row.description || undefined,
  translations,
  suggested_category: suggestedCategory,
  word_count: wordCount,
  duplicate_status: duplicateStatus,
});
```

**문제점**: 
- PreviewEntry의 `product` 필드에 저장됨
- 하지만 클라이언트에서 CommitEntry로 변환 시 `product` 필드가 누락됨

### 4.2 Commit API (`/api/migration/commit`)

**파일**: `/src/app/api/migration/commit/route.ts`

**현재 동작**:

1. **Simple Mode** (line 85-94):
```typescript
entries = previewData.entries.map((entry: PreviewEntry) => ({
  ...entry,
  category: entry.suggested_category,
  action: entry.duplicate_status.status === 'exact' ? 'skip' : 'import',
}));
```
- PreviewEntry의 모든 필드를 CommitEntry로 복사
- 하지만 `product` 필드는 CommitEntry에 정의되지 않았으므로 실제로는 전달되지 않음

2. **Glossary 저장** (line 204-224):
```typescript
const { data: glossaryData, error: glossaryError } = await supabase
  .from('glossary')
  .insert({
    term: entry.source_text,
    translation: translation.trim(),
    language_code: langCode,
    context: entry.context || null,
    user_id: userId,
  })
  .select()
  .single();

// Link to product
await supabase.from('glossary_products').insert({
  glossary_id: glossaryData.id,
  product_code: product_code,
  version: version || null,
  // product_category 저장 안됨!
});
```

3. **Translation 저장** (line 340-379):
```typescript
const { data: translation, error: translationError } = await supabase
  .from('translations')
  .insert({
    source_text: entry.source_text,
    context: entry.context || null,
    status: 'completed',
    version: version || null,
    product_code: product_code,
    user_id: userId,
    is_migrated: true,
  })
  .select()
  .single();

// Link to product
await supabase.from('translation_products').insert({
  translation_id: translation.id,
  product_code: product_code,
  version: version || null,
  // product_category 저장 안됨!
});
```

---

## 5. 영향 범위 분석 (Impact Analysis)

### 5.1 영향받는 기능

| 기능 | 영향도 | 설명 |
|------|--------|------|
| 마이그레이션 커밋 API | 높음 | product_category 저장 로직 추가 필요 |
| 번역관리 페이지 필터 | 중간 | product_category 필터 UI 및 API 추가 필요 |
| 용어집 페이지 필터 | 중간 | product_category 필터 UI 및 API 추가 필요 |
| 번역 요청하기 페이지 | 낮음 | 필터 옵션 추가만 필요 |
| 롤백 시스템 | 중간 | product_category 데이터도 롤백 필요 |

### 5.2 API 영향도

| API 엔드포인트 | 변경 필요 | 설명 |
|----------------|-----------|------|
| `/api/migration/commit` | ✅ 수정 | product_category 저장 로직 추가 |
| `/api/glossary` | ⚠️ 검토 | product_category 필터 파라미터 추가 검토 |
| `/api/glossary/[id]` | ❌ 없음 | 단일 조회는 영향 없음 |
| `/api/translations` | ⚠️ 검토 | product_category 필터 파라미터 추가 검토 |
| `/api/translations/[id]` | ❌ 없음 | 단일 조회는 영향 없음 |

---

## 6. 구현 방안 (Implementation Plan)

### 단계 1: DB 스키마 변경

**마이그레이션 파일**: `supabase/migrations/052_add_product_category.sql`

```sql
-- Add product_category column to glossary_products
ALTER TABLE public.glossary_products
  ADD COLUMN IF NOT EXISTS product_category TEXT;

-- Add product_category column to translation_products
ALTER TABLE public.translation_products
  ADD COLUMN IF NOT EXISTS product_category TEXT;

-- Create indexes for filter performance
CREATE INDEX IF NOT EXISTS idx_glossary_products_product_category
  ON public.glossary_products(product_category);

CREATE INDEX IF NOT EXISTS idx_translation_products_product_category
  ON public.translation_products(product_category);
```

### 단계 2: 타입 정의 수정

**파일**: `/src/app/api/migration/commit/route.ts`

```typescript
interface CommitEntry {
  id: string;
  source_text: string;
  context?: string;
  translations: Record<string, string>;
  category: 'glossary' | 'translation';
  action: 'import' | 'skip' | 'merge' | 'overwrite';
  product?: string;  // ← 추가 (PreviewEntry에서 전달된 product_category)
}
```

**파일**: `/src/app/(dashboard)/settings/migration/contexts/MigrationContext.tsx`

```typescript
export interface PreviewEntry {
  // ... existing fields ...
  product?: string;  // product_category 값 저장
  // ...
}
```

### 단계 3: Commit API 수정

**파일**: `/src/app/api/migration/commit/route.ts`

**변경 1**: Simple Mode에서 product 필드 전달 (line 85-94)
```typescript
entries = previewData.entries.map((entry: PreviewEntry) => ({
  id: entry.id,
  source_text: entry.source_text,
  context: entry.context,
  translations: entry.translations,
  category: entry.suggested_category,
  action: entry.duplicate_status.status === 'exact' ? 'skip' : 'import',
  product: entry.product,  // ← 추가
}));
```

**변경 2**: Glossary 저장 시 product_category 저장 (line 220-224)
```typescript
await supabase.from('glossary_products').insert({
  glossary_id: glossaryData.id,
  product_code: product_code,
  version: version || null,
  product_category: entry.product || null,  // ← 추가
});
```

**변경 3**: Translation 저장 시 product_category 저장 (line 374-379)
```typescript
await supabase.from('translation_products').insert({
  translation_id: translation.id,
  product_code: product_code,
  version: version || null,
  product_category: entry.product || null,  // ← 추가
});
```

### 단계 4: 클라이언트 필터 연동 (Optional - Phase 2)

**번역관리 필터**:
- 파일: `/src/app/(dashboard)/translations/hooks/useTranslationFilters.ts`
- product_category 필터 상태 추가
- UI: `/src/app/(dashboard)/translations/components/TranslationFiltersBar.tsx`

**용어집 필터**:
- 파일: `/src/app/(dashboard)/glossary/hooks/useGlossaryData.ts`
- product_category 필터 파라미터 추가
- UI: `/src/app/(dashboard)/glossary/page.tsx`

---

## 7. 사이드 이펙트 방지 (Side Effect Prevention)

### 7.1 기존 데이터 마이그레이션

**상황**: 기존 데이터에는 product_category가 없음
**대응**: 
- 기존 데이터는 null로 유지
- 필터 시 "미분류" 또는 "전체" 옵션 제공
- 필요시 별도 배치 작업으로 product_category 채우기

### 7.2 기존 필터 기능

**상황**: 기존 필터들은 product_category와 무관
**대응**: 
- 기존 필터 로직 변경 없음
- product_category 필터는 추가 기능으로 제공

### 7.3 다른 API 영향

**롤백 시스템** (`/api/rollback/*`):
- operation_batches 및 관련 테이블에는 product_category 없음
- 롤백 시 product_category도 함께 복원되도록 audit log 확인 필요

**용어집 트랜잭션** (`034_add_glossary_transactions.sql`):
- `create_glossary_term` 함수에 product_category 파라미터 추가 검토

---

## 8. 테스트 전략 (Testing Strategy)

### 8.1 단위 테스트

1. **Preview API**: product_category가 PreviewEntry.product에 정확히 매핑되는지
2. **Commit API**: 
   - glossary_products에 product_category 저장 확인
   - translation_products에 product_category 저장 확인
3. **타입 검증**: CommitEntry.product 필드 전달 확인

### 8.2 통합 테스트

1. **엔드투엔드 마이그레이션**: 
   - 파일 업로드 → Preview → Commit 전체 흐름
   - DB에 product_category 정상 저장 확인

2. **필터 테스트** (Phase 2):
   - product_category 필터로 정상 조회되는지
   - 필터 초기화 시 전체 데이터 조회되는지

### 8.3 회귀 테스트

1. **기존 마이그레이션**: product_category 매핑 없이도 정상 동작
2. **기존 필터**: 기존 필터들 정상 동작 확인
3. **롤백**: 마이그레이션 롤백 정상 동작 확인

---

## 9. 결론 및 권고사항 (Conclusion & Recommendations)

### 9.1 핵심 요약

| 항목 | 현재 상태 | 필요한 작업 |
|------|----------|------------|
| DB 스키마 | product_category 컬럼 없음 | 마이그레이션 추가 |
| PreviewEntry | product 필드에 매핑 | 명확화 또는 별도 필드 추가 |
| CommitEntry | product_category 필드 없음 | 필드 추가 |
| Commit API | 저장 로직 없음 | 저장 로직 추가 |
| 클라이언트 필터 | 없음 | Phase 2에서 구현 |

### 9.2 구현 우선순위

1. **P0 (필수)**: DB 스키마 변경 + Commit API 수정
   - 데이터 저장이 핵심 목표
   - 기존 기능과의 호환성 유지

2. **P1 (권고)**: 클라이언트 필터 연동
   - 저장된 데이터 활용
   - 사용자 편의성 향상

3. **P2 (선택)**: 기존 데이터 마이그레이션
   - 필요시 별도 스크립트 개발

### 9.3 예상 소요 시간

| 작업 | 예상 시간 |
|------|----------|
| DB 마이그레이션 작성 | 30분 |
| 타입 정의 수정 | 30분 |
| Commit API 수정 | 1시간 |
| 테스트 및 검증 | 1시간 |
| **총계** | **3시간** |

---

## 부록: 관련 파일 목록

### 수정 필요 파일
1. `supabase/migrations/052_add_product_category.sql` (신규)
2. `/src/app/api/migration/commit/route.ts`
3. `/src/app/(dashboard)/settings/migration/contexts/MigrationContext.tsx`
4. `/src/app/api/migration/preview/route.ts` (문서화용 주석 추가)

### 참고 파일
1. `/src/app/api/glossary/route.ts` - 필터 API 참고
2. `/src/app/api/translations/route.ts` - 필터 API 참고
3. `/src/app/(dashboard)/glossary/hooks/useGlossaryData.ts` - 필터 훅 참고
4. `/src/app/(dashboard)/translations/hooks/useTranslationFilters.ts` - 필터 훅 참고
5. `supabase/migrations/004_multiple_products.sql` - 기존 마이그레이션 참고
