# 리팩토링 가이드

## 개요

이 문서는 Translation Manager의 새로운 아키텍처 레이어와 점진적 리팩토링 방법을 설명합니다.

## 완료된 작업

### Phase 1: 긴급 보안 수정 ✅

1. **인증 미들웨어 재활성화**
   - 파일: `src/middleware.ts`, `src/lib/supabase/middleware.ts`
   - 보호된 라우트에 인증 요구
   - 개발 환경용 `ALLOW_AUTH_BYPASS` 옵션 추가

2. **API 인증 우회 로직 수정**
   - 파일: `src/lib/api-auth.ts`
   - 인증 실패 시 에러 반환
   - 개발 환경에서만 우회 가능

3. **환경변수 보호**
   - `.env.local`이 Git에 포함되지 않음을 확인
   - `.gitignore`에 이미 포함됨
   - `SECURITY_NOTICE.md` 생성 (API 키 재발급 안내)

4. **관리자 엔드포인트 보호**
   - 파일: `src/app/api/admin/*/route.ts`
   - `ADMIN_SECRET` 환경변수로 보호
   - 프로덕션에서는 필수, 개발에서는 선택적

### Phase 2: 기반 구조 구축 ✅

1. **API 클라이언트 계층** (`src/lib/api/`)
   - `client.ts` - Base API client
   - `translations-client.ts` - 번역 API 클라이언트
   - `glossary-client.ts` - 용어집 API 클라이언트
   - `ai-client.ts` - AI API 클라이언트
   - `index.ts` - 통합 export

2. **API 미들웨어** (`src/lib/api/middleware.ts`)
   - `withAuth` - 인증 미들웨어
   - `withMasterRole` - 관리자 권한 체크
   - `withValidation` - Zod 스키마 검증
   - `withErrorHandling` - 에러 처리
   - 헬퍼 함수: `successResponse`, `errorResponse`

3. **에러 처리 표준화** (`src/lib/errors/`)
   - `ApiError` - 기본 에러 클래스
   - `ValidationError` (400)
   - `AuthenticationError` (401)
   - `AuthorizationError` (403)
   - `NotFoundError` (404)
   - `ConflictError` (409)
   - `RateLimitError` (429)
   - `DatabaseError` (500)
   - `ExternalServiceError` (502)

4. **서비스 계층 템플릿** (`src/lib/services/`)
   - `translation-service.ts` - 번역 비즈니스 로직 예시

---

## 사용 방법

### 1. 환경변수 설정

개발 환경에서 인증을 우회하려면:

```bash
# .env.local
ALLOW_AUTH_BYPASS=true  # 개발 모드에서만 작동
```

관리자 엔드포인트를 사용하려면:

```bash
# .env.local
ADMIN_SECRET=your_random_secret_here  # openssl rand -hex 32
```

### 2. 프론트엔드에서 API 클라이언트 사용

#### Before (기존 방식):
```typescript
// components/TranslationList.tsx
const handleDelete = async (id: string) => {
  try {
    const response = await fetch(`/api/translations/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }

    showSuccess('삭제되었습니다.');
  } catch (error) {
    showError('삭제 실패');
  }
};
```

#### After (새로운 방식):
```typescript
// components/TranslationList.tsx
import { translationsApi, ApiError } from '@/lib/api';

const handleDelete = async (id: string) => {
  try {
    await translationsApi.delete(id);
    showSuccess('삭제되었습니다.');
  } catch (error) {
    if (error instanceof ApiError) {
      showError(error.message);
    } else {
      showError('삭제 실패');
    }
  }
};
```

#### 장점:
- 타입 안전성 (자동 완성, 타입 체크)
- 일관된 에러 처리
- 코드 중복 감소
- URL 오타 방지

### 3. API 라우트에서 미들웨어 사용

#### Before (기존 방식):
```typescript
// app/api/translations/route.ts (204줄)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // 입력 검증
    if (!body.source_text) {
      return NextResponse.json(
        { error: '원문은 필수입니다.' },
        { status: 400 }
      );
    }

    // 비즈니스 로직 100+ 줄...

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
```

#### After (새로운 방식):
```typescript
// app/api/translations/route.ts (50줄로 축소)
import { withValidation } from '@/lib/api/middleware';
import { TranslationService } from '@/lib/services/translation-service';
import { z } from 'zod';

const TranslationCreateSchema = z.object({
  source_text: z.string().min(1, '원문은 필수입니다.'),
  context: z.string().optional(),
  scope: z.enum(['SaaS', 'Solution']).optional(),
  product_codes: z.array(z.string()).optional(),
});

export const POST = withValidation(
  TranslationCreateSchema,
  async (req, ctx, body) => {
    const service = new TranslationService(ctx.supabase, ctx.user.id);
    const translation = await service.create(body);

    return NextResponse.json(translation, { status: 201 });
  }
);
```

#### 장점:
- 코드 60% 감소 (204줄 → 50줄)
- 인증/검증 자동 처리
- 일관된 에러 형식
- 비즈니스 로직만 집중

### 4. 서비스 계층 사용

서비스 계층은 비즈니스 로직을 API 라우트에서 분리합니다:

```typescript
// lib/services/translation-service.ts
export class TranslationService {
  constructor(private supabase: SupabaseClient, private userId: string) {}

  async create(input: TranslationCreateInput): Promise<Translation> {
    // 1. 번역 생성
    // 2. 제품 연결
    // 3. 번역 결과 생성
    // 4. 감사 로그 생성
    // 5. 완전한 데이터 반환
  }
}
```

사용 예시:
```typescript
// API 라우트에서
const service = new TranslationService(supabase, user.id);
const translation = await service.create(body);

// 다른 서비스에서도 재사용 가능
// 단위 테스트 작성 용이
```

### 5. 에러 처리

```typescript
import {
  NotFoundError,
  ValidationError,
  AuthorizationError,
  DatabaseError,
} from '@/lib/errors';

// 에러 발생
if (!translation) {
  throw new NotFoundError('번역');
}

if (!isMaster(user)) {
  throw new AuthorizationError();
}

// 에러 캐치
try {
  await service.create(input);
} catch (error) {
  if (error instanceof ValidationError) {
    return errorResponse(error.message, 400, error.details);
  }
  throw error;
}
```

---

## 점진적 마이그레이션 전략

### 원칙
1. **새 기능은 즉시 새 패턴 사용**
2. **기존 코드는 필요할 때만 리팩토링**
3. **컴포넌트/페이지 단위로 점진적 전환**

### 우선순위

#### 즉시 적용 (새 기능 개발 시)
- [ ] 새 API 엔드포인트 → 미들웨어 + 서비스 계층 사용
- [ ] 새 프론트엔드 코드 → API 클라이언트 사용

#### 점진적 적용 (기존 코드 수정 시)
- [ ] API 라우트 수정 필요 시 → 미들웨어로 리팩토링
- [ ] 컴포넌트 수정 필요 시 → API 클라이언트로 전환
- [ ] 버그 수정 시 → 해당 파일만 리팩토링

#### 나중에 (성능/유지보수 문제 발생 시)
- [ ] 큰 훅 분해 (useTranslationMutations - 267줄)
- [ ] 큰 컴포넌트 분해 (TranslationTableV2 - 424줄)
- [ ] 코드 중복 제거

### 마이그레이션 체크리스트

#### API 라우트 리팩토링 시:
1. [ ] 인증 로직 제거 → `withAuth` 사용
2. [ ] 입력 검증 → Zod 스키마 + `withValidation`
3. [ ] 비즈니스 로직 → 서비스 계층으로 이동
4. [ ] 에러 처리 → 표준 에러 클래스 사용
5. [ ] try-catch 간소화

#### 프론트엔드 컴포넌트 리팩토링 시:
1. [ ] fetch 호출 → API 클라이언트로 변경
2. [ ] 에러 처리 → ApiError 체크
3. [ ] 타입 임포트 → API 클라이언트 타입 사용

---

## 예제: API 라우트 리팩토링

### Step 1: Zod 스키마 정의

```typescript
import { z } from 'zod';

const TranslationCreateSchema = z.object({
  source_text: z.string().min(1, '원문은 필수입니다.'),
  context: z.string().optional(),
  scope: z.enum(['SaaS', 'Solution']).optional(),
  product_codes: z.array(z.string()).optional(),
  translations: z.array(z.object({
    language_code: z.string(),
    translated_text: z.string(),
  })).optional(),
});
```

### Step 2: 서비스 계층 사용 (선택 사항)

서비스 계층이 없다면 API 라우트에 직접 작성해도 됨. 나중에 리팩토링 가능.

### Step 3: 미들웨어 적용

```typescript
import { withValidation } from '@/lib/api/middleware';
import { TranslationService } from '@/lib/services/translation-service';

export const POST = withValidation(
  TranslationCreateSchema,
  async (req, ctx, body) => {
    // ctx.user, ctx.profile, ctx.supabase 사용 가능
    const service = new TranslationService(ctx.supabase, ctx.user.id);
    const translation = await service.create(body);

    return NextResponse.json(translation, { status: 201 });
  }
);
```

### Step 4: 프론트엔드 업데이트

```typescript
import { translationsApi } from '@/lib/api';

const handleCreate = async (data: TranslationCreateInput) => {
  try {
    const translation = await translationsApi.create(data);
    showSuccess('번역이 생성되었습니다.');
    return translation;
  } catch (error) {
    if (error instanceof ApiError) {
      showError(error.message);
    }
  }
};
```

---

## 리팩토링 효과

### 예상 결과
- **코드 중복 30-40% 감소** (약 1,200-1,600줄)
- **평균 파일 크기 감소**: 250줄 → 150줄
- **API 라우트 60% 축소**: 200줄 → 80줄
- **타입 안전성 증가**: 자동 완성, 컴파일 타임 체크
- **일관된 에러 처리**: 모든 API에서 동일한 형식

### 측정 지표
- [ ] API 라우트 평균 줄 수
- [ ] API 클라이언트 사용률 (%)
- [ ] 미들웨어 적용률 (%)
- [ ] 코드 중복률 (SonarQube 등)

---

## 주의사항

### 하지 말아야 할 것
❌ 한 번에 모든 파일을 리팩토링하지 마세요
❌ 동작하는 코드를 이유 없이 변경하지 마세요
❌ 테스트 없이 대규모 리팩토링하지 마세요

### 해야 할 것
✅ 새 기능은 새 패턴으로 작성
✅ 수정이 필요한 파일만 리팩토링
✅ 작은 단위로 점진적 변경
✅ 각 변경 후 테스트 확인

---

## 참고 파일

### 문서
- `SECURITY_NOTICE.md` - 보안 수정 사항 및 API 키 재발급 안내
- `REFACTORING_GUIDE.md` (이 파일) - 리팩토링 가이드

### 코드 템플릿
- `src/lib/api/client.ts` - API 클라이언트 기본 클래스
- `src/lib/api/middleware.ts` - API 미들웨어
- `src/lib/services/translation-service.ts` - 서비스 계층 예시
- `src/lib/errors/index.ts` - 에러 클래스

### 환경 설정
- `.env.local.example` - 환경변수 예시 (보안 설정 포함)

---

## 질문 & 지원

리팩토링 중 질문이 있으면:
1. 이 가이드의 예제 참고
2. `src/lib/services/translation-service.ts` 템플릿 참고
3. 기존 패턴 유지하면서 점진적 전환

**원칙**: 완벽하게 하려고 하지 말고, 점진적으로 개선하세요!
