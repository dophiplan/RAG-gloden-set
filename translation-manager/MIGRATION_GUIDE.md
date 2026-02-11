# 데이터베이스 관계 설계 개선 마이그레이션 가이드

## 📋 완료된 작업

### 1. 데이터베이스 마이그레이션 ✅
- ✅ `030_create_reference_tables.sql` - Reference tables 생성
  - `translation_statuses` - 번역 상태 테이블
  - `priority_levels` - 우선순위 테이블
  - `scopes` - 분류 테이블
- ✅ `031_migrate_to_reference_tables.sql` - FK 컬럼 추가 및 데이터 마이그레이션
  - `translations.status_id`, `priority_id`, `scope_id` 추가
  - 기존 데이터 자동 마이그레이션
- ✅ `032_create_translation_platforms.sql` - Junction table 생성
  - `translation_platforms` 테이블
  - `work_scope` 배열에서 데이터 마이그레이션
- ✅ `033_remove_deprecated_columns.sql` - Deprecated 컬럼 제거 (주석 처리)

### 2. API 엔드포인트 ✅
- ✅ `/api/statuses` - 번역 상태 조회
- ✅ `/api/priorities` - 우선순위 조회
- ✅ `/api/scopes` - 분류 조회

### 3. React Hooks ✅
- ✅ `/src/hooks/useReferenceData.ts` 생성
  - `useProducts()` - 제품 데이터
  - `useLanguages()` - 언어 데이터
  - `usePlatforms()` - 플랫폼 데이터
  - `useStatuses()` - 상태 데이터
  - `usePriorities()` - 우선순위 데이터
  - `useScopes()` - 분류 데이터
  - `useAllReferenceData()` - 모든 데이터 한번에

### 4. 타입 정의 업데이트 ✅
- ✅ `src/types/products.ts` - PRODUCTS 상수 deprecated 표시
- ✅ `src/types/languages.ts` - SUPPORTED_LANGUAGES deprecated 표시
- ✅ `src/types/translations.ts` - Status/Priority/Scope deprecated 표시

### 5. 일부 API 업데이트 ✅
- ✅ `/api/dashboard/requests/route.ts` - PRODUCTS 하드코딩 제거

---

## 🚧 남은 작업

### 1. 마이그레이션 실행 (필수)

```bash
# Supabase 로컬 환경에서 실행
supabase migration up

# 또는 프로덕션 적용
supabase db push
```

### 2. UI 컴포넌트 업데이트 (약 10-15개 파일)

아래 파일들에서 하드코딩된 상수를 hooks로 교체해야 합니다:

#### A. Glossary 페이지
- `/src/app/(dashboard)/glossary/page.tsx` (2곳)
  ```typescript
  // ❌ 현재
  <Badge>{PRODUCTS[term.product_code]}</Badge>

  // ✅ 변경
  const { productsMap } = useProducts();
  <Badge>{productsMap[term.product_code]?.name}</Badge>
  ```

#### B. Users 페이지
- `/src/app/(dashboard)/users/page.tsx`
  ```typescript
  // ❌ 현재
  label: PRODUCTS[code as keyof typeof PRODUCTS]

  // ✅ 변경
  const { productsMap } = useProducts();
  label: productsMap[code]?.name || code
  ```

#### C. Translation 관련 컴포넌트
다음 파일들을 확인하고 업데이트:
- `/src/components/translations/TranslationTableV2.tsx`
- `/src/components/translations/TranslationFiltersBar.tsx`
- `/src/app/(dashboard)/translations/page.tsx`
- `/src/app/(dashboard)/upload/page.tsx`

**업데이트 패턴:**
```typescript
// 1. Import hook
import { useProducts, useLanguages, usePlatforms } from '@/hooks/useReferenceData';

// 2. Component 안에서 사용
function MyComponent() {
  const { products, productsMap } = useProducts();
  const { languages, languagesMap } = useLanguages();

  // 3. 하드코딩 대신 hooks 사용
  return <div>{productsMap[code]?.name}</div>;
}
```

### 3. API 라우트 업데이트 (약 5-10개 파일)

아래 API 파일들에서 `PRODUCTS`, `SUPPORTED_LANGUAGES` import 제거하고 DB 조회로 변경:

```bash
# PRODUCTS 사용하는 파일 찾기
grep -r "PRODUCTS\[" src/app/api --include="*.ts"

# SUPPORTED_LANGUAGES 사용하는 파일 찾기
grep -r "SUPPORTED_LANGUAGES\[" src/app/api --include="*.ts"
```

**업데이트 패턴:**
```typescript
// ❌ 현재
import { PRODUCTS } from '@/lib/constants';
const name = PRODUCTS[code];

// ✅ 변경
const { data: products } = await supabase
  .from('products')
  .select('code, name');
const productsMap = products.reduce((acc, p) => {
  acc[p.code] = p.name;
  return acc;
}, {});
const name = productsMap[code];
```

### 4. Status/Priority 업데이트

다음 파일들에서 STATUS_COLORS, PRIORITY_LABELS 사용을 hooks로 변경:

```typescript
// ❌ 현재
import { STATUS_COLORS, PRIORITY_LABELS } from '@/types';
const color = STATUS_COLORS[status].bg;

// ✅ 변경
const { statusesMap } = useStatuses();
const color = statusesMap[status]?.bg_color || 'bg-gray-100';
```

### 5. Deprecated 컬럼 완전 제거 (마지막 단계)

모든 코드 업데이트 완료 후:

1. `033_remove_deprecated_columns.sql`의 주석 해제
2. 마이그레이션 실행
3. 다음 컬럼들이 삭제됩니다:
   - `translations.product_code` (deprecated)
   - `translations.status` (TEXT 컬럼)
   - `translations.priority` (TEXT 컬럼)
   - `translations.scope` (TEXT 컬럼)
   - `translations.work_scope` (배열 컬럼)
   - `glossary.product_code` (deprecated)

---

## 🎯 단계별 실행 계획

### Phase 1: 마이그레이션 실행 (5분)
```bash
cd /Users/nanheekim/translation-manager
supabase migration up
```

### Phase 2: UI 컴포넌트 업데이트 (2-3시간)
1. Glossary 페이지 (30분)
2. Users 페이지 (15분)
3. Translations 페이지 (1시간)
4. Upload 페이지 (30분)
5. 기타 컴포넌트 (30분)

### Phase 3: API 라우트 업데이트 (1-2시간)
1. PRODUCTS 사용처 모두 업데이트 (1시간)
2. SUPPORTED_LANGUAGES 사용처 업데이트 (30분)
3. STATUS_COLORS, PRIORITY_LABELS 사용처 업데이트 (30분)

### Phase 4: 테스트 (1시간)
1. 로컬 서버 실행 후 전체 기능 테스트
2. 제품/언어/플랫폼 추가 테스트
3. 번역 생성/수정 테스트
4. 용어집 기능 테스트

### Phase 5: Deprecated 컬럼 제거 (30분)
1. 033 마이그레이션 주석 해제
2. 마이그레이션 실행
3. 최종 테스트

**총 예상 시간: 4-6시간**

---

## 🔍 업데이트 필요한 파일 목록

### 높은 우선순위 (필수)
```
src/app/(dashboard)/glossary/page.tsx
src/app/(dashboard)/users/page.tsx
src/app/(dashboard)/translations/page.tsx
src/app/(dashboard)/upload/page.tsx
src/components/translations/TranslationTableV2.tsx
```

### 중간 우선순위
```
src/components/translations/TranslationFiltersBar.tsx
src/components/dashboard/RequestList.tsx
src/app/api/translations/route.ts
src/app/api/glossary/route.ts
```

### 낮은 우선순위 (있을 경우)
```
src/lib/constants.ts (PRODUCTS 상수 제거 고려)
기타 PRODUCTS/SUPPORTED_LANGUAGES 사용하는 파일들
```

---

## ✅ 완료 체크리스트

- [ ] 1. 마이그레이션 실행 완료
- [ ] 2. `/api/statuses` 엔드포인트 작동 확인
- [ ] 3. `/api/priorities` 엔드포인트 작동 확인
- [ ] 4. `/api/scopes` 엔드포인트 작동 확인
- [ ] 5. Glossary 페이지 업데이트
- [ ] 6. Users 페이지 업데이트
- [ ] 7. Translations 페이지 업데이트
- [ ] 8. Upload 페이지 업데이트
- [ ] 9. 모든 API 라우트 PRODUCTS 제거
- [ ] 10. 모든 컴포넌트 STATUS_COLORS 교체
- [ ] 11. 전체 기능 테스트
- [ ] 12. Deprecated 컬럼 제거 (033 마이그레이션)

---

## 🚀 빠른 시작

```bash
# 1. 마이그레이션 실행
cd /Users/nanheekim/translation-manager
supabase migration up

# 2. 개발 서버 실행
npm run dev

# 3. 브라우저에서 확인
# - http://localhost:3000/api/statuses
# - http://localhost:3000/api/priorities
# - http://localhost:3000/api/scopes
```

---

## 📝 주의사항

1. **Backward Compatibility**: 현재는 old/new 컬럼이 공존하므로 안전합니다
2. **점진적 마이그레이션**: 한번에 하나씩 파일을 업데이트하고 테스트하세요
3. **DB 백업**: 프로덕션 마이그레이션 전 반드시 백업하세요
4. **롤백 계획**: 문제 발생 시 033 마이그레이션은 실행하지 않고 되돌릴 수 있습니다

---

## 🆘 문제 발생 시

### Q: 마이그레이션 실패
```bash
# 롤백
supabase migration revert

# 또는 특정 마이그레이션만
supabase migration down 030
```

### Q: API 오류
- Old 컬럼이 아직 존재하므로 기존 코드도 작동합니다
- 천천히 파일별로 업데이트하세요

### Q: UI에 undefined 표시
- Hooks가 로딩 중일 수 있습니다
- `isLoading` 상태 확인하고 로딩 UI 추가하세요

```typescript
const { products, isLoading } = useProducts();

if (isLoading) {
  return <div>로딩 중...</div>;
}
```

---

## 🎉 완료 후 효과

1. ✅ **동적 마스터 데이터**: 코드 수정 없이 제품/언어/플랫폼 추가 가능
2. ✅ **데이터 일관성**: 단일 진실 공급원 (DB)
3. ✅ **유지보수 간편**: 하드코딩 제거로 코드 단순화
4. ✅ **확장 가능**: Status/Priority도 동적 관리 가능
5. ✅ **타입 안전성**: FK 제약조건으로 데이터 무결성 보장

---

이 가이드를 따라 단계별로 진행하면 안전하게 마이그레이션할 수 있습니다!
