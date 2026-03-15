# 크로스 체크 보고서

## 검토 일자
2026-03-15

## 검토 대상
- 마이그레이션 기능 (upload → mapping → preview → commit)
- 번역/용어집 권한 체크 로직
- API 인증 및 에러 처리

---

## 주요 발견사항

### 🔴 Critical (즉시 수정 필요)

#### 1. 타입 중복 - PreviewEntry 인터페이스
**위치**: 6개 파일에서 중복 정의
- `src/app/(dashboard)/settings/migration/contexts/MigrationContext.tsx:33`
- `src/app/(dashboard)/settings/migration/components/DuplicateConflictModal.tsx:5`
- `src/app/(dashboard)/settings/migration/components/MigrationPreviewTable.tsx:6`
- `src/app/api/migration/preview/route.ts:16`
- `src/app/(dashboard)/settings/migration/_backup/...` (백업 파일 제외)

**위험**: 한 곳에서 필드 추가/수정 시 타입 불일치 발생

**조치**: `src/types/migration.ts` 생성 후 중앙화
```typescript
export interface PreviewEntry {
  id: string;
  source_text: string;
  translations: Record<string, string>;
  context?: string;
  product?: string;
  product_category?: string;
  version?: string;
  category: 'glossary' | 'translation';
  suggested_category?: 'glossary' | 'translation';
  action?: 'import' | 'skip' | 'merge' | 'overwrite';
  duplicate_status?: {
    status: 'exact' | 'fuzzy';
    existingId?: string;
  };
  row_number?: number;
}
```

#### 2. 디버그 로그 프로덕션 노출
**위치**: 
- `src/app/api/translations/bulk-delete-all/route.ts:31-35`
- `src/app/api/migration/preview/route.ts:440-448`
- `src/app/api/migration/commit/route.ts:646-647`

**위험**: 민감 정보(User ID, 역할 등) 로그 노출

**조치**: 개발 환경에서만 출력
```typescript
if (process.env.NODE_ENV === 'development') {
  console.log('[Debug]', ...);
}
```

---

### 🟡 Major (수정 권장)

#### 3. 전체 페이지 리로드 (UX 저하)
**위치**: `src/app/(dashboard)/settings/migration/components/MigrationWizard.tsx:59,61,63`

**문제**: `window.location.href` 사용으로 전체 페이지 리로드 발생

**조치**: Next.js router 사용
```typescript
import { useRouter } from 'next/navigation';
// ...
const router = useRouter();
// ...
router.push(`/translations/${targetProductCode}`);
```

#### 4. API 응답 null 안전성
**위치**: `src/app/(dashboard)/settings/migration/components/MigrationWizard.tsx:55`

**문제**: `result.imported`가 undefined일 수 있음

**조치**: 
```typescript
const imported = result?.imported ?? 0;
showToast(`마이그레이션이 성공적으로 완료되었습니다. (처리: ${imported}개)`, 'success');
```

#### 5. 주석 오타
**위치**: `src/app/api/translations/bulk-delete-all/route.ts:9`

**문제**: `1st_manager` → `1st_master`

---

### 🟢 Minor (권장사항)

#### 6. 인증 바이패스 보안 강화
**위치**: `src/lib/api-auth.ts:11`

**조치**: 환경 변수 이중 검증
```typescript
if ((authError || !user) && process.env.ALLOW_AUTH_BYPASS === 'true' && process.env.NODE_ENV === 'development') {
  if (process.env.NODE_ENV !== 'development') {
    console.error('🚨 SECURITY: Auth bypass attempted in non-development environment');
    return { user: null, error: 'Authentication required', adminClient: null };
  }
  // ... bypass logic
}
```

---

## 기능별 검증 체크리스트

### 마이그레이션 기능
- [x] 파일 업로드 및 파싱
- [x] 필드 매핑 (버전, 제품분류 등)
- [x] 미리보기 및 중복 체크
- [x] 커밋 및 롤백
- [x] 완료 후 리다이렉트

### 권한 체크
- [x] 1st_master 전체 삭제 권한
- [x] master/admin 권한
- [x] 용어집 벌크 삭제 권한
- [ ] 로그인하지 않은 사용자 접근 제한 (glossary/suggest)

### 데이터 일관성
- [x] 버전 필드 명시적 매핑
- [x] 제품분류 자동 생성
- [x] 외래키 제약 조건 준수 (삭제 순서)

---

## 테스트 시나리오

### Happy Path
1. 마이그레이션 파일 업로드 → 매핑 → 미리보기 → 커밋
2. 해당 제품 번역 페이지로 이동 확인
3. 데이터 조회 확인

### Edge Cases
1. 인증 만료 시 용어집 페이지 접근 → 로그인 페이지 리다이렉트
2. 권한 없는 사용자 전체 삭제 시도 → 403 Forbidden
3. 마이그레이션 중 오류 발생 → 롤백 확인

---

## 결론

**전반적 평가**: 🟢 양호

**핵심 버그 수정 완료**:
- ✅ 용어집 suggest API 401 오류
- ✅ 마이그레이션 완료 후 페이지 이동
- ✅ 권한 체크 (role → roles 배열)
- ✅ 버전 필드 자동 채우기 방지

**즉시 수정 권장**:
1. PreviewEntry 타입 중앙화
2. 디버그 로그 환경 구분
3. Next.js router 사용

**QA 승인 조건**:
- [ ] 타입 중앙화 적용
- [ ] 프로덕션 빌드 시 디버그 로그 미출력 확인
- [ ] 마이그레이션 E2E 테스트 통과
