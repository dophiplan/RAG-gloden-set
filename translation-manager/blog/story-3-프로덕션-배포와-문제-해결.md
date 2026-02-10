# Claude Code와 함께 만드는 번역 관리 시스템 (3) - 프로덕션 배포와 끝없는 문제 해결의 여정

## 서론: 배포의 벽 앞에서

"로컬에서는 완벽하게 동작하는데..." 모든 개발자가 한 번쯤 겪어봤을 이 상황. 우리의 번역 관리 시스템도 예외는 아니었습니다. 5일간의 개발 여정 중 마지막 날, Railway를 통한 프로덕션 배포를 시도하면서 예상치 못한 도전들이 기다리고 있었습니다.

이번 글에서는 Railway 배포 과정에서 마주친 TypeScript 타입 에러, 환경 변수 설정, 빌드 캐시 문제 등 실전 배포에서 겪는 다양한 문제들과 그 해결 과정을 상세히 다룹니다. 특히 AI 페어 프로그래밍 파트너인 Claude Code와 함께 어떻게 체계적으로 문제를 진단하고 해결했는지 살펴보겠습니다.

**키워드**: Railway 배포, Next.js 프로덕션, TypeScript 타입 에러, 환경 변수 설정, Docker 빌드 캐시, Supabase 프로덕션 연동, CI/CD 문제 해결

---

## 1. Railway 배포 준비: 첫 번째 시도

### 1.1 Railway 플랫폼 선택 이유

로컬 개발 환경에서 모든 기능이 완성되고 테스트를 마친 후, 프로덕션 배포를 위한 플랫폼을 선택해야 했습니다. Railway를 선택한 이유는 다음과 같았습니다:

1. **Git 기반 자동 배포**: GitHub 저장소와 연동하여 푸시만 하면 자동으로 배포되는 편리함
2. **Next.js 최적화**: NIXPACKS 빌더가 Next.js 프로젝트를 자동으로 감지하고 최적화
3. **환경 변수 관리**: UI를 통한 직관적인 환경 변수 설정
4. **무료 플랜**: 개발 단계에서 충분히 테스트할 수 있는 무료 플랜 제공

### 1.2 초기 배포 설정

Railway 프로젝트를 생성하고 GitHub 저장소를 연결한 후, 기본 설정으로 배포를 시도했습니다. 초기 `railway.json` 설정은 매우 간단했습니다:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "numReplicas": 1,
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

이 설정으로 첫 배포를 시도했지만, 곧바로 첫 번째 벽에 부딪히게 됩니다.

---

## 2. 첫 번째 장애물: TypeScript 타입 에러의 늪

### 2.1 로컬에서는 되는데 Railway에서는 안 되는 이유

배포 로그를 확인하니 TypeScript 컴파일 단계에서 에러가 발생했습니다:

```
Type error: Type 'string' is not assignable to type '"" | "SaaS" | "Solution"'.

  356 |             version: string,
  357 |             productCode: ProductCode | '',
> 358 |             scope: ScopeType,
      |             ^
  359 |             priority: PriorityLevel,
  360 |             languages: LanguageCode[]
```

이상했습니다. 로컬에서는 `npm run build`가 완벽하게 성공했는데, Railway에서만 실패하는 것이었습니다. Claude Code와 함께 원인을 분석하기 시작했습니다.

### 2.2 타입 정의의 중복 문제 발견

문제의 핵심은 `ScopeType` 타입이 여러 파일에서 중복 정의되어 있다는 것이었습니다:

**src/app/(dashboard)/translations/components/CreateTranslationModal.tsx**:
```typescript
// 지역적으로 정의된 타입
type ScopeType = 'SaaS' | 'Solution' | '';
```

**src/app/(dashboard)/translations/page.tsx**:
```typescript
// 인라인으로 정의된 타입
onCreate={async (
  sourceText: string,
  context: string,
  version: string,
  productCode: ProductCode | '',
  scope: 'SaaS' | 'Solution' | '',  // 중복!
  priority: PriorityLevel,
  languages: LanguageCode[]
) => { ... }}
```

**src/app/(dashboard)/upload/page.tsx**:
```typescript
// 또 다른 중복
const [scope, setScope] = useState<'SaaS' | 'Solution' | ''>('');
```

이렇게 타입이 여러 곳에 중복 정의되어 있으면, 파일 간 참조 시 TypeScript 컴파일러가 미묘한 타입 불일치를 감지할 수 있습니다.

### 2.3 해결책: 중앙화된 타입 정의

Claude Code의 제안에 따라 `ScopeType`을 중앙화하기로 결정했습니다. 새로운 파일을 생성했습니다:

**src/types/common.ts**:
```typescript
/**
 * Common types shared across the application
 */

/**
 * Product scope type - used for translations, uploads, and requests
 */
export type ScopeType = '' | 'SaaS' | 'Solution';
```

그리고 모든 파일에서 이 중앙화된 타입을 import하도록 수정했습니다:

```typescript
import { ProductCode, PriorityLevel, LanguageCode, ScopeType } from '@/types';
```

**커밋 메시지**: `feat: Centralize ScopeType definition to fix Railway build errors`

배포를 다시 시도했지만... 여전히 같은 에러가 발생했습니다.

### 2.4 Railway 빌드 캐시 문제

"점점 에러범위가 늘어나고 있으니 소스 전체 점검이 시급 한것 같다!" 사용자의 절박한 메시지가 들어왔습니다. 여러 번 수정하고 커밋했는데도 Railway는 계속 이전 코드를 빌드하고 있는 것처럼 보였습니다.

문제의 원인은 **Railway의 빌드 캐시**였습니다. Railway는 빌드 속도를 높이기 위해 `.next` 디렉토리와 `node_modules`를 캐싱하는데, 타입 정의가 변경되었을 때 이 캐시가 문제를 일으킬 수 있습니다.

해결책으로 `railway.json`을 다음과 같이 수정했습니다:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "rm -rf .next || true && npm install && npm run build"
  },
  "deploy": {
    "numReplicas": 1,
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

**핵심 변경사항**:
- `rm -rf .next || true`: 빌드 전에 이전 빌드 캐시를 강제로 삭제
- `|| true`: 삭제 실패 시에도 계속 진행 (Docker 권한 문제 방지)

### 2.5 명시적 타입 어노테이션 추가

캐시 문제를 해결했지만, TypeScript 컴파일러에게 더 명확한 힌트를 주기 위해 모든 함수 파라미터에 명시적 타입 어노테이션을 추가했습니다:

**src/app/(dashboard)/translations/page.tsx**:
```typescript
<CreateTranslationModal
  isOpen={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  onCreate={async (
    sourceText: string,
    context: string,
    version: string,
    productCode: ProductCode | '',
    scope: ScopeType,  // 명시적으로 ScopeType 사용
    priority: PriorityLevel,
    languages: LanguageCode[]
  ) => {
    // 명시적으로 타입이 지정된 배열 생성
    const translationsArray = languages.map(lang => ({
      language_code: lang,
      translated_text: '',
    }));

    const response = await fetch('/api/translations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_text: sourceText,
        context: context || undefined,
        version: version || undefined,
        product_codes: productCode ? [productCode] : undefined,
        scope: scope || undefined,
        priority,
        translations: translationsArray,
      }),
    });

    if (response.ok) {
      fetchTranslations();
      if (productCode) {
        filters.setSelectedProduct(productCode as ProductCode);
      }
      return true;
    }
    return false;
  }}
  onPDFUpload={handlePDFUpload}
/>
```

---

## 3. 두 번째 장애물: 세부적인 TypeScript 에러들

### 3.1 Import 경로 문제

타입 에러를 하나씩 해결하다 보니 다른 파일에서도 문제가 발견되었습니다:

```
An import path can only end with a '.tsx' extension when 'allowImportingTsExtensions' is enabled.

  11 | import { showSuccess, showError } from '@/lib/notifications.tsx';
```

**src/components/dashboard/RequestList.tsx**에서 `.tsx` 확장자를 포함한 import 문이 문제였습니다. TypeScript 설정에 따라 확장자를 명시하면 안 되는 경우가 있습니다.

**수정**:
```typescript
// Before
import { showSuccess, showError } from '@/lib/notifications.tsx';

// After
import { showSuccess, showError } from '@/lib/notifications';
```

### 3.2 연산자 우선순위 문제

```
'||' and '??' operations cannot be mixed without parentheses.

  48 | return profile?.roles?.includes('master') || profile?.roles?.includes('1st_master') ?? false;
```

**src/lib/api/middleware.ts**에서 논리 연산자 `||`와 널 병합 연산자 `??`를 함께 사용할 때 괄호가 필요했습니다.

**수정**:
```typescript
// Before
return profile?.roles?.includes('master') || profile?.roles?.includes('1st_master') ?? false;

// After
return (profile?.roles?.includes('master') || profile?.roles?.includes('1st_master')) ?? false;
```

이는 JavaScript/TypeScript의 연산자 우선순위 규칙 때문입니다. `??` 연산자는 `||`나 `&&`와 함께 사용할 때 명시적으로 괄호를 요구합니다.

### 3.3 타입 Import 누락 문제

```
Cannot find name 'Holiday'. Did you mean 'Holidays'?

  42 | const [holidays, setHolidays] = useState<Holiday[]>([]);
```

**src/app/(dashboard)/upload/page.tsx**에서 `Holiday` 타입을 사용하고 있었지만 import하지 않았습니다.

**수정**:
```typescript
import { ProductCode, PriorityLevel, LanguageCode, ScopeType } from '@/types';
import { Holiday } from '@/types/api';

const [holidays, setHolidays] = useState<Holiday[]>([]);
```

---

## 4. 세 번째 장애물: Git 동기화와 Railway 연동 문제

### 4.1 Railway가 최신 코드를 빌드하지 않는 문제

모든 타입 에러를 수정하고 커밋을 푸시했는데도, Railway는 여전히 이전 코드를 빌드하는 것처럼 보였습니다. 로그를 확인해보니 Git 커밋 해시가 업데이트되지 않고 있었습니다.

Claude Code의 제안에 따라 빈 커밋을 만들어 Railway를 강제로 동기화했습니다:

```bash
git commit --allow-empty -m "chore: Force Railway sync"
git push origin main
```

하지만 이것만으로는 충분하지 않았습니다. Railway UI에서 직접 "Redeploy" 버튼을 눌러야 했습니다.

### 4.2 Railway UI를 통한 수동 재배포

Railway 대시보드에서:
1. **Deployments** 탭으로 이동
2. 최신 배포 항목에서 **...** 메뉴 클릭
3. **Redeploy** 선택

이제야 Railway가 최신 코드를 가져와서 빌드를 시작했습니다. Git 기반 자동 배포라고 하지만, 때로는 수동으로 트리거해야 하는 경우가 있다는 것을 배웠습니다.

---

## 5. 네 번째 장애물: 환경 변수의 부재

### 5.1 "SUPABASE_SERVICE_ROLE_KEY is not set" 에러

TypeScript 빌드가 마침내 성공했습니다! 하지만 배포된 사이트를 열어보니 다음과 같은 에러가 나타났습니다:

```
Application error: a client-side exception has occurred (see the browser console for more details).

Error: Your project's URL and Key are required to create a Supabase client!
SUPABASE_SERVICE_ROLE_KEY is not set
```

프로덕션 환경에서는 Supabase 연결에 필요한 환경 변수들이 설정되어 있지 않았습니다.

### 5.2 필요한 환경 변수 목록

Next.js와 Supabase를 사용하는 프로젝트에서 필요한 환경 변수들:

```bash
# Supabase 공개 변수 (클라이언트에서 사용)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase 서버 전용 변수 (절대 클라이언트에 노출되면 안 됨)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Railway 네트워킹
PORT=8080
```

**중요한 점**:
- `NEXT_PUBLIC_` 접두사가 붙은 변수는 클라이언트 번들에 포함됩니다
- `NEXT_PUBLIC_` 변수를 추가하거나 변경하면 **반드시 재빌드**가 필요합니다
- `SUPABASE_SERVICE_ROLE_KEY`는 절대 `NEXT_PUBLIC_`을 붙이면 안 됩니다 (보안 위험)

### 5.3 Railway에서 환경 변수 설정하기

Railway UI에서 환경 변수를 설정하는 방법:

1. Railway 프로젝트 대시보드로 이동
2. **Variables** 탭 클릭
3. **New Variable** 버튼으로 하나씩 추가

처음에는 "SUPABASE_SERVICE_ROLE_KEY 키는 너무 길어서 넣을 수가 없데"라는 걱정이 있었지만, 실제로는 긴 값도 문제없이 입력할 수 있었습니다.

### 5.4 PORT 설정 문제

처음 배포 시 다음과 같은 에러가 발생했습니다:

```
Error: Port mismatch - Railway networking configured for port 3883, but Next.js is listening on 8080
```

Next.js는 기본적으로 `process.env.PORT`를 사용하거나 3000을 사용합니다. Railway는 동적으로 포트를 할당하지만, 우리는 명시적으로 8080을 사용하도록 설정했습니다:

```bash
PORT=8080
```

이렇게 하면 Next.js가 시작할 때 Railway가 기대하는 포트에서 리스닝하게 됩니다.

### 5.5 환경 변수 추가 후 재배포

`NEXT_PUBLIC_` 변수를 추가한 후에는 반드시 재배포가 필요합니다. 이미 빌드된 클라이언트 번들에는 이 변수들이 포함되어 있지 않기 때문입니다.

Railway UI에서 **Redeploy** 버튼을 다시 눌러 완전히 새로 빌드했습니다.

---

## 6. 다섯 번째 장애물: 사용자 데이터가 사라진 것처럼 보이는 문제

### 6.1 "내가 등록했던 사용자 관리들이 어디 갔지?"

환경 변수를 모두 설정하고 사이트가 정상적으로 로드되었습니다. 하지만 사용자 관리 페이지를 열어보니 이전에 등록했던 사용자들이 보이지 않았습니다.

"근데 내가 등록했던 사용자 관리들이 어디 갔지? SUPABASE_SERVICE_ROLE_KEY 이거 등록 안해서 안나오는건가?" 정확한 진단이었습니다!

### 6.2 Service Role Key의 중요성

Supabase에서 Row Level Security (RLS)가 활성화된 테이블에 접근할 때:

- **클라이언트 사이드 (anon key)**: 현재 로그인한 사용자의 권한으로만 데이터 접근 가능
- **서버 사이드 (service role key)**: 모든 RLS 정책을 우회하고 전체 데이터에 접근 가능

우리의 사용자 관리 기능은 서버 API 라우트에서 `SUPABASE_SERVICE_ROLE_KEY`를 사용하여 모든 사용자 데이터를 조회합니다:

```typescript
// src/app/api/admin/users/route.ts
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  // SERVICE_ROLE_KEY를 사용하여 RLS를 우회
  const supabase = createClient();

  const { data: users, error } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false });

  // ...
}
```

`SUPABASE_SERVICE_ROLE_KEY`가 없으면 이 API는 제대로 작동하지 않습니다. 데이터가 사라진 것이 아니라, 볼 수 있는 권한이 없었던 것입니다!

### 6.3 데이터 복구 확인

`SUPABASE_SERVICE_ROLE_KEY`를 환경 변수에 추가하고 재배포한 후, 사용자 관리 페이지를 다시 확인했습니다. 모든 사용자 데이터가 정상적으로 표시되었습니다. 데이터는 처음부터 Supabase 데이터베이스에 안전하게 저장되어 있었습니다.

---

## 7. 최종 성공: "댔다!"

### 7.1 배포 완료

모든 문제를 하나씩 해결한 끝에, 드디어 배포가 성공했습니다. 사용자의 환호:

> "댔다!"

Railway 대시보드에서 배포된 도메인을 확인할 수 있었습니다:

```
https://translation-manager-production.up.railway.app
```

### 7.2 최종 설정 요약

**railway.json**:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "rm -rf .next || true && npm install && npm run build"
  },
  "deploy": {
    "numReplicas": 1,
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

**환경 변수**:
- ✅ NEXT_PUBLIC_SUPABASE_URL
- ✅ NEXT_PUBLIC_SUPABASE_ANON_KEY
- ✅ SUPABASE_SERVICE_ROLE_KEY
- ✅ PORT=8080

**타입 정의**:
- ✅ 중앙화된 `ScopeType` (src/types/common.ts)
- ✅ 명시적 타입 어노테이션
- ✅ Import 경로 수정
- ✅ 연산자 우선순위 수정

---

## 8. 배포 과정에서 배운 교훈들

### 8.1 타입 안정성은 빌드 시간에 중요하다

로컬에서는 TypeScript가 관대하게 동작할 수 있지만, 프로덕션 빌드에서는 훨씬 엄격합니다. 특히:

1. **타입 정의 중앙화**: 같은 타입을 여러 곳에서 정의하지 말고 한 곳에서 정의하고 import
2. **명시적 타입 어노테이션**: 인라인 함수의 파라미터에도 명시적으로 타입 지정
3. **Import 검증**: 모든 타입을 제대로 import했는지 확인

### 8.2 빌드 캐시는 양날의 검

빌드 캐시는 속도를 높이지만, 타입 정의가 변경되었을 때 문제를 일으킬 수 있습니다:

1. **강제 캐시 삭제**: `rm -rf .next || true`로 이전 빌드 제거
2. **수동 재배포**: Git 푸시만으로 안 될 때는 UI에서 수동으로 재배포
3. **빈 커밋**: `git commit --allow-empty`로 재배포 트리거

### 8.3 환경 변수 관리는 체크리스트가 필요하다

프로덕션 배포 전에 확인해야 할 환경 변수 체크리스트:

- [ ] 모든 `NEXT_PUBLIC_` 변수가 설정되었는가?
- [ ] 서버 전용 변수(`SERVICE_ROLE_KEY` 등)가 설정되었는가?
- [ ] 포트 설정이 올바른가?
- [ ] `NEXT_PUBLIC_` 변수 추가 후 재빌드했는가?
- [ ] 민감한 정보가 클라이언트에 노출되지 않는가?

### 8.4 에러 메시지를 신뢰하되, 컨텍스트를 이해하라

"SUPABASE_SERVICE_ROLE_KEY is not set" 에러는 명확했지만, 처음에는 데이터가 사라진 것으로 오해할 수 있었습니다. 에러 메시지를 읽되, 시스템의 전체 아키텍처(RLS, 권한 모델 등)를 이해하는 것이 중요합니다.

### 8.5 AI 페어 프로그래밍의 가치

Claude Code와 함께 작업하면서 특히 도움이 되었던 점들:

1. **체계적인 문제 진단**: 각 에러를 독립적으로 분석하고 해결책 제시
2. **컨텍스트 유지**: 여러 파일에 걸친 타입 정의 추적
3. **모범 사례 제안**: 타입 중앙화, 명시적 어노테이션 등
4. **인내심**: 같은 종류의 에러가 반복되어도 차분하게 해결 방법 안내

---

## 9. Railway 배포 완전 가이드

### 9.1 초기 설정

1. **Railway 프로젝트 생성**
   - Railway 대시보드에서 "New Project" 클릭
   - "Deploy from GitHub repo" 선택
   - 저장소 연결 및 브랜치 선택

2. **railway.json 생성**
   ```json
   {
     "$schema": "https://railway.app/railway.schema.json",
     "build": {
       "builder": "NIXPACKS",
       "buildCommand": "rm -rf .next || true && npm install && npm run build"
     },
     "deploy": {
       "numReplicas": 1,
       "startCommand": "npm start",
       "restartPolicyType": "ON_FAILURE",
       "restartPolicyMaxRetries": 10
     }
   }
   ```

3. **환경 변수 설정**
   - Variables 탭에서 필요한 모든 변수 추가
   - `NEXT_PUBLIC_` 변수 추가 후 반드시 재배포

### 9.2 배포 전 체크리스트

- [ ] 로컬에서 `npm run build` 성공 확인
- [ ] TypeScript 에러 없음 확인
- [ ] 모든 타입이 올바르게 import되었는지 확인
- [ ] 환경 변수 파일(.env.local)을 .gitignore에 추가
- [ ] 프로덕션 환경 변수를 Railway에 설정
- [ ] 데이터베이스 마이그레이션이 완료되었는지 확인

### 9.3 배포 후 검증

- [ ] 배포 로그에서 빌드 성공 확인
- [ ] 도메인 접속하여 사이트 로딩 확인
- [ ] 브라우저 콘솔에 에러가 없는지 확인
- [ ] 주요 기능(로그인, CRUD 등) 동작 확인
- [ ] 데이터베이스 연결 확인
- [ ] API 라우트 동작 확인

### 9.4 문제 발생 시 디버깅 단계

1. **빌드 로그 확인**
   - Railway 대시보드 → Deployments → 최신 배포 → View Logs
   - TypeScript 컴파일 에러 찾기

2. **런타임 로그 확인**
   - View Logs에서 실시간 로그 모니터링
   - 환경 변수 관련 에러 찾기

3. **환경 변수 재확인**
   - Variables 탭에서 모든 변수가 설정되었는지 확인
   - 특히 `NEXT_PUBLIC_` 접두사가 올바른지 확인

4. **강제 재배포**
   - Deployments → ... 메뉴 → Redeploy
   - 또는 빈 커밋 후 푸시

---

## 10. Next.js + Supabase 프로덕션 배포 모범 사례

### 10.1 환경 변수 관리

**개발 환경 (.env.local)**:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
```

**프로덕션 환경 (Railway Variables)**:
- 같은 변수들을 Railway UI에 입력
- `.env.local`은 절대 Git에 커밋하지 않음

### 10.2 Supabase RLS 설정

프로덕션에서는 Row Level Security가 필수입니다:

```sql
-- 사용자는 자신의 데이터만 볼 수 있음
CREATE POLICY "Users can view own data"
ON user_profiles FOR SELECT
USING (auth.uid() = id);

-- 관리자는 모든 데이터를 볼 수 있음 (service_role 사용 시)
CREATE POLICY "Service role can view all"
ON user_profiles FOR SELECT
USING (true);
```

서버 API에서는 service role key를 사용하여 RLS를 우회합니다.

### 10.3 빌드 최적화

**Next.js 설정 (next.config.js)**:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // 프로덕션 빌드 최적화
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // 이미지 최적화
  images: {
    domains: ['xxx.supabase.co'],
  },
}

module.exports = nextConfig
```

### 10.4 에러 처리 및 모니터링

프로덕션에서는 적절한 에러 처리가 중요합니다:

```typescript
// 클라이언트 에러 경계
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div>
      <h2>문제가 발생했습니다!</h2>
      <button onClick={() => reset()}>다시 시도</button>
    </div>
  )
}
```

---

## 결론: 배포는 또 다른 개발의 시작

5일간의 개발 여정은 Railway 배포로 마무리되었지만, 이것이 끝은 아닙니다. 프로덕션 환경에서 실제 사용자들이 시스템을 사용하면서 새로운 요구사항과 개선점들이 계속 발견될 것입니다.

이번 배포 과정에서 겪은 수많은 문제들—타입 에러, 빌드 캐시, 환경 변수, 권한 설정—은 모두 실전에서 마주치는 전형적인 도전 과제들이었습니다. 하지만 Claude Code라는 AI 페어 프로그래밍 파트너와 함께, 체계적으로 문제를 진단하고 하나씩 해결해 나갈 수 있었습니다.

특히 인상 깊었던 점은:

1. **인내심의 가치**: 같은 에러가 반복되어도 포기하지 않고 근본 원인을 찾았습니다
2. **체계적 접근**: 각 에러를 독립적으로 분석하고 해결했습니다
3. **문서화의 중요성**: 모든 과정을 기록하여 나중에 참고할 수 있게 했습니다
4. **AI와의 협업**: Claude Code가 제공하는 컨텍스트와 제안들이 큰 도움이 되었습니다

이제 우리의 번역 관리 시스템은 `https://translation-manager-production.up.railway.app`에서 실제 사용자들을 기다리고 있습니다. 로컬 환경을 넘어 프로덕션에 배포된 시스템을 보는 것은 개발자로서 특별한 성취감을 줍니다.

"로컬에서는 되는데..."라는 말이 더 이상 변명이 아닌, 해결해야 할 구체적인 과제가 되었습니다. 그리고 우리는 그 과제를 성공적으로 해결했습니다.

---

## 참고 자료

- [Railway Documentation](https://docs.railway.app/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Supabase Production Checklist](https://supabase.com/docs/guides/platform/going-into-prod)
- [TypeScript Handbook - Type Compatibility](https://www.typescriptlang.org/docs/handbook/type-compatibility.html)

---

**시리즈 전체 보기**:
- [Part 1: 프로젝트 시작과 기본 아키텍처 구축](./story-1-프로젝트-시작과-기본-아키텍처.md)
- [Part 2: 고급 기능 구현과 기술적 도전](./story-2-고급-기능과-기술적-도전.md)
- **Part 3: 프로덕션 배포와 끝없는 문제 해결의 여정** (현재 글)

---

**작성일**: 2026년 2월
**개발 기간**: 5일
**핵심 기술**: Next.js 16, Railway, TypeScript, Supabase, Docker
**배포 URL**: https://translation-manager-production.up.railway.app
