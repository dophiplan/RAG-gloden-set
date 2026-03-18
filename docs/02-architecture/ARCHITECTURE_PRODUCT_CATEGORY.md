# Architecture: 제품 분류(Product Category) 관리 체계

## 1. 현재 상태 분석

### 1.1 셀렉트 박스 위치 및 현황

| 위치 | 파일 경로 | 현재 데이터 소스 | 상태 |
|------|----------|-----------------|------|
| 번역 필터 바 | `src/app/(dashboard)/translations/components/TranslationFiltersBar.tsx` (line 151-156) | 하드코딩 | ❌ 문제 |
| 번역 폼 필드 | `src/components/translations/TranslationFormFields.tsx` (line 68-71) | `useScopes()` hook | ⚠️ 부분 문제 |
| 상수 정의 | `src/lib/constants.ts` (line 28-35) | 하드코딩 | ❌ 문제 |

### 1.2 현재 하드코딩된 값

```typescript
// src/lib/constants.ts
export const SCOPE_OPTIONS = [
  { value: '', label: '제품 분류 선택 *' },
  { value: 'SaaS', label: 'SaaS' },
  { value: 'Solution', label: 'Solution' },
  { value: '정부과제', label: '정부과제' },
  { value: '기타', label: '기타' },
];
```

```typescript
// TranslationFiltersBar.tsx (line 151-156)
options={[
  { value: '', label: '모든 분류' },
  { value: 'SaaS', label: 'SaaS' },
  { value: 'Solution', label: 'Solution' },
]}
```

### 1.3 관련 테이블 스키마

#### scopes 테이블 (현재 마스터 테이블)
```sql
CREATE TABLE scopes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,  -- 'saas', 'solution', 'government', 'other'
  name VARCHAR(100) NOT NULL,         -- 'SaaS', 'Solution', '정부과제', '기타'
  description TEXT,
  sort_order INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### translation_products 테이블
```sql
CREATE TABLE translation_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  translation_id UUID REFERENCES translations(id),
  product_code TEXT REFERENCES products(code),
  version TEXT,                       -- Excel "버전" 컬럼 저장됨
  version_updated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
  -- product_category 컬럼 없음 (추가 필요)
);
```

#### glossary_products 테이블
```sql
CREATE TABLE glossary_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  glossary_id UUID REFERENCES glossary(id),
  product_code TEXT REFERENCES products(code),
  version TEXT,
  version_updated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
  -- product_category 컬럼 없음 (추가 필요)
);
```

### 1.4 마이그레이션 흐름 현황

```
Excel 업로드 → Preview API → Commit API → DB 저장
     ↓              ↓              ↓           ↓
  버전 시트    product_category   누락!     version만
  파싱         추출 가능         (주석처리)  저장됨
```

- Preview API (`/api/migration/preview`): `product_category` 값을 읽어 PreviewEntry에 저장
- Commit API (`/api/migration/commit`): 주석 처리되어 저장하지 않음
  ```typescript
  // Note: product_category column needs to be added to DB schema
  // product_category: entry.product_category || null,
  ```

---

## 2. 해결 방안 비교

### 방안 A: 별도 테이블 관리 (`product_categories`)

**구조**:
```sql
CREATE TABLE product_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  is_auto_generated BOOLEAN DEFAULT false,  -- 마이그레이션에서 자동 추가된 값 표시
  created_at TIMESTAMP DEFAULT NOW()
);
```

**마이그레이션 로직**:
```typescript
// 마이그레이션 시 자동 추가
const { error: upsertError } = await supabase
  .from('product_categories')
  .upsert({
    code: normalizedCategory,
    name: categoryValue,
    is_auto_generated: true
  }, { onConflict: 'code' });
```

**장점**:
- 정규화된 데이터 모델
- 메타데이터(생성일, 자동생성 여부) 관리 가능
-scopes 테이블과 분리하여 독립 관리
- 향후 확장성 (설명, 아이콘 등 추가 가능)

**단점**:
- 새로운 테이블 생성 필요
- scopes 테이블과 중복되는 개념
- 추가 JOIN 쿼리 필요

**복잡도**: 중간

---

### 방안 B: translation_products에서 DISTINCT 조회

**구조**: 기존 테이블 활용, `product_category` 컬럼 추가

```sql
-- 컬럼 추가
ALTER TABLE translation_products ADD COLUMN product_category TEXT;
ALTER TABLE glossary_products ADD COLUMN product_category TEXT;

-- 인덱스 생성
CREATE INDEX idx_translation_products_category ON translation_products(product_category);
```

**조회 로직**:
```typescript
// API: /api/product-categories
const { data: categories } = await supabase
  .from('translation_products')
  .select('product_category')
  .not('product_category', 'is', null)
  .order('product_category');

// DISTINCT 처리
const uniqueCategories = [...new Set(categories.map(c => c.product_category))];
```

**장점**:
- 별도 테이블 불필요
- 실제 데이터 기반 동적 목록
- 구현 간단
- 기존 scopes 테이블과 충돌 없음

**단점**:
- glossary/translation 데이터가 없으면 빈 목록
- 대량 데이터 시 DISTINCT 쿼리 성능 이슈 가능
- "삭제" 개념 구현 어려움 (데이터가 남아있으면 계속 표시)

**복잡도**: 낮음

---

### 방안 C: scopes 테이블 확장 (권장)

**구조**: 기존 `scopes` 테이블 활용 + 자동 추가 로직

```sql
-- scopes 테이블에 자동생성 플래그 추가
ALTER TABLE scopes ADD COLUMN is_auto_generated BOOLEAN DEFAULT false;
ALTER TABLE scopes ADD COLUMN source VARCHAR(50) DEFAULT 'manual';  -- 'manual', 'migration', 'system'
```

**마이그레이션 로직**:
```typescript
// /api/migration/commit에서 자동 추가
async function ensureProductCategory(category: string) {
  if (!category) return;
  
  const normalizedCode = category.toLowerCase().replace(/\s+/g, '_');
  
  // INSERT OR IGNORE 패턴
  await supabase
    .from('scopes')
    .upsert({
      code: normalizedCode,
      name: category,
      sort_order: 999,  // 자동 생성된 값은 뒤로
      is_auto_generated: true,
      source: 'migration'
    }, { 
      onConflict: 'code',
      ignoreDuplicates: true 
    });
}
```

**조회 로직**: 기존 `useScopes()` hook 그대로 사용

**장점**:
- 기존 인프라 활용 (테이블, API, hook 모두 재사용)
- UI 변경 최소화 (이미 useScopes() 사용 중)
- 정렬/비활성화 등 기존 scopes 기능 활용 가능
- 데이터 일관성 유지

**단점**:
- scopes 테이블 스키마 변경 필요
- "제품 분류"와 "Scope" 개념이 혼재될 수 있음
- 기존 데이터 마이그레이션 필요

**복잡도**: 중간

---

## 3. 권장 방안: 방안 C (scopes 테이블 확장)

### 3.1 선택 이유

| 평가 항목 | 방안 A | 방안 B | 방안 C |
|----------|--------|--------|--------|
| 구현 복잡도 | 중간 | 낮음 | 중간 |
| 기존 코드 재사용 | 낮음 | 중간 | 높음 |
| 데이터 정합성 | 높음 | 중간 | 높음 |
| 확장성 | 높음 | 낮음 | 중간 |
| 롤백 용이성 | 중간 | 높음 | 중간 |
| **종합 권고** | | | **✅ 추천** |

**핵심 근거**:
1. `TranslationFormFields.tsx`가 이미 `useScopes()` hook을 사용 중
2. `/api/scopes` API가 이미 존재
3.scopes 테이블의 구조가 product_category 관리에 적합
4. 마이그레이션 자동 추가 + 수동 관리 통합 가능

### 3.2 기존과의 차이점

| 구분 | 기존 접근 | 새로운 접근 |
|------|----------|------------|
| 데이터 소스 | 하드코딩 + scopes 테이블 | scopes 테이블 (동적) |
| 새 값 추가 | 수동 DB 삽입 | 마이그레이션 자동 추가 |
| 필터 동기화 | 수동 | 자동 (useScopes 사용 시) |
| 관리 방식 | 개발자만 수정 가능 | 마스터 권한으로 UI에서 관리 |

---

## 4. 구현 계획

### 4.1 단계별 작업

#### Phase 1: DB 스키마 변경 (예상: 30분)

**마이그레이션 파일**: `supabase/migrations/052_extend_scopes_for_auto_generation.sql`

```sql
-- scopes 테이블 확장
ALTER TABLE scopes 
  ADD COLUMN IF NOT EXISTS is_auto_generated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual' 
    CHECK (source IN ('manual', 'migration', 'system'));

-- 기존 데이터 마이그레이션
UPDATE scopes SET source = 'manual', is_auto_generated = false;

-- 자동생성된 값을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_scopes_is_auto_generated ON scopes(is_auto_generated);

-- 자동생성된 값은 맨 뒤에 정렬되도록 기본값 설정
UPDATE scopes SET sort_order = 999 WHERE is_auto_generated = true;
```

**마이그레이션 파일**: `supabase/migrations/053_add_product_category_to_link_tables.sql`

```sql
-- translation_products에 product_category 컬럼 추가
ALTER TABLE translation_products 
  ADD COLUMN IF NOT EXISTS product_category TEXT;

-- glossary_products에 product_category 컬럼 추가  
ALTER TABLE glossary_products 
  ADD COLUMN IF NOT EXISTS product_category TEXT;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_translation_products_category 
  ON translation_products(product_category);

CREATE INDEX IF NOT EXISTS idx_glossary_products_category 
  ON glossary_products(product_category);
```

#### Phase 2: 마이그레이션 API 수정 (예상: 1시간)

**파일**: `src/app/api/migration/commit/route.ts`

1. **CommitEntry 인터페이스 수정** (line 5-13):
```typescript
interface CommitEntry {
  id: string;
  source_text: string;
  context?: string;
  product_category?: string;  // 추가
  translations: Record<string, string>;
  category: 'glossary' | 'translation';
  action: 'import' | 'skip' | 'merge' | 'overwrite';
}
```

2. **자동 분류 추가 함수** (신규):
```typescript
async function ensureProductCategory(
  supabase: ReturnType<typeof createAdminClient>,
  category: string | undefined
): Promise<void> {
  if (!category || category.trim() === '') return;
  
  const normalizedCode = category.trim().toLowerCase().replace(/\s+/g, '_');
  
  const { error } = await supabase
    .from('scopes')
    .upsert({
      code: normalizedCode,
      name: category.trim(),
      sort_order: 999,  // 자동 생성된 값은 맨 뒤
      is_auto_generated: true,
      source: 'migration',
      is_active: true,
    }, { 
      onConflict: 'code',
      ignoreDuplicates: true 
    });
    
  if (error) {
    console.warn('[Migration] Failed to auto-create product category:', error);
    // 실패해도 마이그레이션은 계속 진행
  }
}
```

3. **Glossary 저장 로직 수정** (line 294-310):
```typescript
// 자동 분류 추가 (비동기, 실패 무시)
await ensureProductCategory(adminClient, entry.product_category);

// 저장
const { data: glossaryProductData, error: glossaryProductError } = await adminClient
  .from('glossary_products')
  .insert({
    glossary_id: glossaryData.id,
    product_code: product_code,
    version: version || null,
    product_category: entry.product_category || null,  // 추가
  })
  .select()
  .single();
```

4. **Translation 저장 로직 수정** (line 516-527):
```typescript
// 자동 분류 추가 (비동기, 실패 무시)
await ensureProductCategory(adminClient, entry.product_category);

// 저장
const { data: tpData, error: tpError } = await adminClient
  .from('translation_products')
  .insert({
    translation_id: translation.id,
    product_code: product_code,
    version: version || null,
    version_updated_at: version ? new Date().toISOString() : null,
    product_category: entry.product_category || null,  // 추가
  })
  .select()
  .single();
```

#### Phase 3: UI 셀렉트 박스 연동 (예상: 1시간)

**파일**: `src/app/(dashboard)/translations/components/TranslationFiltersBar.tsx`

```typescript
// 기존 하드코딩된 options 제거
// const: { value: '', label: '모든 분류' }, { value: 'SaaS', label: 'SaaS' }, ...

// useScopes hook 사용
import { useScopes } from '@/hooks/useReferenceData';

export default function TranslationFiltersBar({...}) {
  const { scopes } = useScopes();
  
  // 동적 옵션 생성
  const scopeOptions = useMemo(() => [
    { value: '', label: '모든 분류' },
    ...scopes.map(s => ({ value: s.code, label: s.name }))
  ], [scopes]);
  
  // Select 컴포넌트에 적용
  <Select
    value={scopeFilter}
    onChange={(e) => handleScopeChange(e.target.value as ScopeType)}
    options={scopeOptions}  // 동적 옵션
  />
}
```

**파일**: `src/lib/constants.ts` (line 28-35)

```typescript
// @deprecated - Use useScopes() hook instead
// SCOPE_OPTIONS는 하위호환성을 위해 유지하되, 더 이상 사용하지 않음
export const SCOPE_OPTIONS = [
  { value: '', label: '제품 분류 선택 *' },
  { value: 'SaaS', label: 'SaaS' },
  { value: 'Solution', label: 'Solution' },
  { value: '정부과제', label: '정부과제' },
  { value: '기타', label: '기타' },
];
```

#### Phase 4: 스코프 관리 UI (선택사항, Phase 2) (예상: 2시간)

**파일**: `src/app/(dashboard)/settings/scopes/page.tsx` (신규)

- 마스터 권한 사용자를 위한 스코프 관리 페이지
- 자동생성된 스코프 표시 및 관리
- 수동으로 스코프 추가/수정/비활성화

### 4.2 테스트 계획

| 테스트 항목 | 방법 | 예상 결과 |
|------------|------|----------|
| 마이그레이션 새 분류 | 새로운 product_category 값으로 Excel 업로드 | scopes 테이블에 자동 추가됨 |
| 필터 동기화 | 새로 추가된 분류로 번역 필터 확인 | 셀렉트 박스에 자동 표시 |
| 데이터 저장 | 마이그레이션 후 translation_products 조회 | product_category 컬럼에 값 저장 |
| 중복 방지 | 같은 분류로 두 번 마이그레이션 | 중복 INSERT 방지 (upsert) |
| 기존 데이터 | 기존 마이그레이션 데이터 | 정상 표시 (NULL 허용) |

---

## 5. 예상 결과

### Before (현재)
```
Excel 마이그레이션: product_category = "신규분류C"
                ↓
scopes 테이블: [SaaS, Solution, 정부과제, 기타] (변화 없음)
                ↓
셀렉트 박스: [SaaS, Solution] (C 없음, 수동 추가 필요)
```

### After (구현 후)
```
Excel 마이그레이션: product_category = "신규분류C"
                ↓
scopes 테이블: [SaaS, Solution, 정부과제, 기타, 신규분류C] (자동 추가)
                ↓
셀렉트 박스: [SaaS, Solution, 정부과제, 기타, 신규분류C] (C 자동 표시)
```

---

## 6. 롤백 계획

만약 문제 발생 시:

```sql
-- 1. 컬럼 제거 (데이터 백업 필요)
ALTER TABLE scopes DROP COLUMN IF EXISTS is_auto_generated;
ALTER TABLE scopes DROP COLUMN IF EXISTS source;

-- 2. 추가된 스코프 정리 (선택)
DELETE FROM scopes WHERE code NOT IN ('saas', 'solution', 'government', 'other');

-- 3. link 테이블 컬럼 제거
ALTER TABLE translation_products DROP COLUMN IF EXISTS product_category;
ALTER TABLE glossary_products DROP COLUMN IF EXISTS product_category;
```

---

## 7. 관련 파일 목록

### 수정 필요 파일
| 파일 경로 | 변경 내용 |
|----------|----------|
| `supabase/migrations/052_extend_scopes_for_auto_generation.sql` | 신규: scopes 테이블 확장 |
| `supabase/migrations/053_add_product_category_to_link_tables.sql` | 신규: link 테이블 컬럼 추가 |
| `src/app/api/migration/commit/route.ts` | 수정: 자동 분류 추가 로직 |
| `src/app/(dashboard)/translations/components/TranslationFiltersBar.tsx` | 수정: useScopes() 사용 |
| `src/lib/constants.ts` | 수정: SCOPE_OPTIONS deprecate |

### 참고 파일
| 파일 경로 | 용도 |
|----------|------|
| `src/hooks/useReferenceData.ts` | useScopes hook 참고 |
| `src/app/api/scopes/route.ts` | scopes API 참고 |
| `src/components/translations/TranslationFormFields.tsx` | 이미 useScopes() 사용 중 (참고) |
| `docs/architecture-product-category-migration.md` | 기존 product_category 저장 분석 |

---

## 8. 예상 소요 시간

| 작업 | 시간 | 담당 |
|------|------|------|
| DB 마이그레이션 작성 | 30분 | Architect → Backend |
| Commit API 수정 | 1시간 | Backend |
| UI 필터 연동 | 1시간 | Frontend |
| 테스트 및 검증 | 1시간 | QA |
| **총계** | **3.5시간** | |
