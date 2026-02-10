# 🧪 테스트 가이드

## 1️⃣ 시작하기 전에

### 환경 변수 설정 확인
```bash
# translation-manager/.env.local 파일에 다음 내용이 있는지 확인:
ADMIN_SECRET=<your_secret_here>  # openssl rand -hex 32로 생성
ALLOW_AUTH_BYPASS=true           # 개발 모드 전용
```

### 개발 서버 시작
```bash
cd ~/translation-manager
npm run dev
# 또는
yarn dev
```

서버가 시작되면 다음과 같은 메시지를 볼 수 있습니다:
```
✓ Ready in 2.3s
○ Local:   http://localhost:3000
```

---

## 2️⃣ 보안 수정 테스트 (Phase 1)

### 테스트 1: 인증 미들웨어 작동 확인 ✅

**목표**: 로그인하지 않으면 대시보드에 접근할 수 없어야 함

**테스트 순서**:
1. 브라우저 시크릿 모드(incognito)로 열기
2. 접속: http://localhost:3000/dashboard
3. **예상 결과**: 자동으로 `/login`으로 리다이렉트됨

**성공**: ✅ 로그인 페이지로 리다이렉트
**실패**: ❌ 대시보드가 바로 보임

---

### 테스트 2: 보호된 경로 테스트 ✅

**다음 URL들을 로그아웃 상태에서 접속해보세요:**

| URL | 예상 결과 |
|-----|----------|
| http://localhost:3000/dashboard | → /login 리다이렉트 |
| http://localhost:3000/translations | → /login 리다이렉트 |
| http://localhost:3000/glossary | → /login 리다이렉트 |
| http://localhost:3000/settings | → /login 리다이렉트 |
| http://localhost:3000/upload | → /login 리다이렉트 |

**공개 URL (리다이렉트되지 않아야 함):**

| URL | 예상 결과 |
|-----|----------|
| http://localhost:3000 | 메인 페이지 표시 |
| http://localhost:3000/login | 로그인 페이지 표시 |

---

### 테스트 3: API 인증 확인 ✅

**브라우저 개발자 도구 콘솔에서 실행:**

```javascript
// 로그아웃 상태에서 API 호출 시도
fetch('/api/translations')
  .then(res => res.json())
  .then(data => console.log('결과:', data));
```

**예상 결과**:
```json
{
  "error": "인증이 필요합니다."
}
```

**HTTP 상태 코드**: 401 Unauthorized

---

### 테스트 4: 관리자 엔드포인트 보호 확인 ✅

**터미널에서 실행:**

#### Without Secret (실패해야 함):
```bash
curl -X POST http://localhost:3000/api/admin/create-master
```

**예상 결과**:
```json
{
  "error": "Unauthorized: Invalid or missing admin secret"
}
```

#### With Secret (성공해야 함):
```bash
# ADMIN_SECRET 값을 .env.local에서 복사
curl -X POST http://localhost:3000/api/admin/create-master \
  -H "x-admin-secret: YOUR_ADMIN_SECRET_HERE"
```

**예상 결과** (이미 계정이 있다면):
```json
{
  "error": "Master account already exists",
  "email": "nhkim@rsupport.com"
}
```

---

## 3️⃣ 새 인프라 테스트 (Phase 2)

### 테스트 5: API 클라이언트 사용 (프론트엔드)

**테스트 컴포넌트 만들기:**

`src/app/test-api-client/page.tsx` 파일 생성:

```typescript
'use client';

import { useState } from 'react';
import { translationsApi, ApiError } from '@/lib/api';

export default function TestApiClient() {
  const [result, setResult] = useState<string>('');

  const testList = async () => {
    try {
      const data = await translationsApi.list({ limit: 5 });
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      if (error instanceof ApiError) {
        setResult(`Error ${error.statusCode}: ${error.message}`);
      }
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">API Client Test</h1>
      <button
        onClick={testList}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        Test Translation List
      </button>
      <pre className="mt-4 p-4 bg-gray-100 rounded">{result}</pre>
    </div>
  );
}
```

**테스트 링크**: http://localhost:3000/test-api-client

**예상 동작**:
1. 버튼 클릭
2. API 호출 결과가 표시됨
3. 로그인 안 했으면 401 에러 표시

---

### 테스트 6: 미들웨어 테스트 (백엔드)

**테스트 API 엔드포인트 만들기:**

`src/app/api/test-middleware/route.ts` 파일 생성:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withValidation, successResponse } from '@/lib/api/middleware';
import { z } from 'zod';

// GET: 인증 테스트
export const GET = withAuth(async (req, ctx) => {
  return successResponse({
    message: '인증 성공!',
    user: {
      id: ctx.user.id,
      email: ctx.user.email,
    },
    profile: ctx.profile ? {
      name: ctx.profile.name,
      roles: ctx.profile.roles,
    } : null,
  });
});

// POST: 검증 테스트
const TestSchema = z.object({
  name: z.string().min(1, '이름은 필수입니다.'),
  age: z.number().min(0).max(150),
});

export const POST = withValidation(TestSchema, async (req, ctx, body) => {
  return successResponse({
    message: '검증 성공!',
    data: body,
    user: ctx.user.email,
  });
});
```

**테스트 명령어:**

```bash
# GET 테스트 (인증)
curl http://localhost:3000/api/test-middleware

# POST 테스트 (검증 성공)
curl -X POST http://localhost:3000/api/test-middleware \
  -H "Content-Type: application/json" \
  -d '{"name": "테스트", "age": 25}'

# POST 테스트 (검증 실패)
curl -X POST http://localhost:3000/api/test-middleware \
  -H "Content-Type: application/json" \
  -d '{"name": "", "age": 200}'
```

**예상 결과**:
- GET: 로그인 안 했으면 401, 로그인했으면 사용자 정보 반환
- POST (성공): 입력 데이터와 함께 성공 메시지
- POST (실패): 검증 에러 메시지

---

### 테스트 7: 에러 처리 테스트

**브라우저 콘솔에서:**

```javascript
// API Error 테스트
fetch('/api/translations/invalid-id-12345')
  .then(res => res.json())
  .then(data => console.log('404 Error:', data));

// Validation Error 테스트
fetch('/api/translations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ source_text: '' }) // 빈 값
})
  .then(res => res.json())
  .then(data => console.log('Validation Error:', data));
```

---

## 4️⃣ 통합 테스트 시나리오

### 시나리오 1: 완전한 번역 생성 플로우

1. **로그인**
   - http://localhost:3000/login
   - 계정으로 로그인

2. **번역 페이지 접속**
   - http://localhost:3000/translations

3. **새 번역 생성**
   - "새 번역" 버튼 클릭
   - 원문 입력
   - 저장

4. **개발자 도구 네트워크 탭 확인**
   - POST /api/translations 요청 확인
   - 응답 상태: 201 Created
   - 응답 본문에 생성된 번역 데이터 확인

---

### 시나리오 2: 권한 테스트

1. **일반 사용자로 로그인**

2. **관리자 전용 기능 시도**
   - http://localhost:3000/settings (또는 관리자 전용 페이지)

3. **예상 결과**
   - Master 권한 없으면 403 에러 또는 접근 제한 메시지

---

## 5️⃣ 개발 모드 특수 기능 테스트

### Auth Bypass 테스트 (개발 전용)

**.env.local에서:**
```bash
ALLOW_AUTH_BYPASS=true
```

**서버 재시작 후 콘솔 확인:**
- `⚠️  AUTH BYPASS ENABLED - Development mode only` 경고 표시됨

**이 상태에서:**
- API 호출이 인증 없이도 작동 (개발용)
- 프로덕션에서는 절대 작동하지 않음

---

## 6️⃣ 체크리스트

### 보안 테스트
- [ ] 로그아웃 상태에서 /dashboard 접속 → /login으로 리다이렉트
- [ ] 로그아웃 상태에서 API 호출 → 401 에러
- [ ] ADMIN_SECRET 없이 관리자 API 호출 → 401 에러
- [ ] ADMIN_SECRET 있으면 관리자 API 정상 작동

### 인프라 테스트
- [ ] API 클라이언트 타입 자동완성 작동
- [ ] API 클라이언트로 API 호출 성공
- [ ] 미들웨어 withAuth 작동
- [ ] 미들웨어 withValidation 작동
- [ ] 에러 클래스 정상 작동

### 개발 환경 테스트
- [ ] ALLOW_AUTH_BYPASS=true로 개발 가능
- [ ] 콘솔에 경고 메시지 표시
- [ ] 기존 기능 모두 정상 작동

---

## 7️⃣ 빠른 테스트 링크 모음

### 로그인 필요 (인증 테스트)
- 대시보드: http://localhost:3000/dashboard
- 번역 목록: http://localhost:3000/translations
- 용어집: http://localhost:3000/glossary
- 설정: http://localhost:3000/settings
- 업로드: http://localhost:3000/upload

### 공개 페이지
- 메인: http://localhost:3000
- 로그인: http://localhost:3000/login

### API 엔드포인트 (curl로 테스트)
```bash
# 번역 목록 (인증 필요)
curl http://localhost:3000/api/translations

# 관리자 계정 확인 (ADMIN_SECRET 필요)
curl http://localhost:3000/api/admin/create-master \
  -H "x-admin-secret: YOUR_SECRET"

# 테스트 미들웨어 (위에서 생성한 경우)
curl http://localhost:3000/api/test-middleware
```

---

## 8️⃣ 문제 해결

### "Cannot access dashboard" - 401 Unauthorized
✅ **정상 동작**: 로그인이 필요합니다
- `/login`으로 가서 로그인하세요

### "API returns 401 even after login"
🔧 **해결 방법**:
1. 쿠키가 정상적으로 설정되었는지 확인
2. 브라우저 개발자 도구 → Application → Cookies 확인
3. Supabase auth 쿠키가 있는지 확인

### "Admin endpoints not working"
🔧 **해결 방법**:
1. `.env.local`에 `ADMIN_SECRET` 설정 확인
2. 서버 재시작
3. curl 명령어에 `-H "x-admin-secret: YOUR_SECRET"` 추가

### "Auth bypass warnings in console"
✅ **정상 동작**: `ALLOW_AUTH_BYPASS=true`로 설정했을 때 나타남
- 개발 모드에서만 작동
- 프로덕션에서는 절대 작동하지 않음

---

## 9️⃣ 추가 테스트 (선택)

### TypeScript 타입 체크
```bash
cd ~/translation-manager
npx tsc --noEmit
```

### ESLint 체크
```bash
npm run lint
```

### Build 테스트
```bash
npm run build
```

---

## 🎉 테스트 완료!

모든 테스트가 통과하면:
- ✅ 보안 수정이 정상 작동
- ✅ 새 인프라 사용 준비 완료
- ✅ 개발 계속 진행 가능

문제가 있다면:
- `SECURITY_NOTICE.md` 참고
- `QUICK_START.md` 참고
- `REFACTORING_GUIDE.md` 참고

**즐거운 개발 되세요! 🚀**
