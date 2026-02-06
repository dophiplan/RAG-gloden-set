# 프로덕션 배포 가이드

Translation Manager를 Vercel에 프로덕션 배포하는 완벽한 가이드입니다. 약 10-15분이 소요됩니다.

## 📋 목차

- [빠른 배포 (10분)](#빠른-배포-10분)
- [상세 배포 단계](#상세-배포-단계)
- [배포 후 검증](#배포-후-검증)
- [문제 해결](#문제-해결)
- [Phase 2 개선사항](#phase-2-개선사항)

---

## 빠른 배포 (10분)

### 1단계: GitHub 저장소 확인 (1분)

프로젝트가 GitHub에 푸시되어 있는지 확인합니다:

```bash
# 저장소 URL 확인
git remote -v
# 결과: origin  https://github.com/dophiplan/translation-manager (fetch)

# 최신 변경사항 푸시
git push origin main
```

### 2단계: Vercel에서 배포 (5분)

#### 옵션 A: 원클릭 배포 (권장)

다음 버튼을 클릭하면 자동으로 Vercel 배포 페이지로 이동합니다:

<a href="https://vercel.com/new/clone?repository-url=https://github.com/dophiplan/translation-manager&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY,ANTHROPIC_API_KEY&envDescription=Supabase%20and%20Anthropic%20API%20keys%20required&envLink=https://github.com/dophiplan/translation-manager/blob/main/DEPLOYMENT.md">
  <img src="https://vercel.com/button" alt="Deploy with Vercel" />
</a>

#### 옵션 B: 수동 배포

1. https://vercel.com 방문
2. GitHub 계정으로 로그인 (또는 가입)
3. "Add New..." → "Project" 클릭
4. "Import Git Repository" 선택
5. `dophiplan/translation-manager` 검색 및 선택
6. "Import" 클릭

### 3단계: 환경 변수 설정 (3분)

Vercel 배포 페이지의 "Environment Variables" 섹션에서 다음 변수들을 추가합니다:

#### 필수 환경 변수

**1. Supabase (프로덕션 프로젝트)**

먼저 [Supabase 프로덕션 설정](#supabase-프로덕션-설정)을 완료하고 다음 정보를 복사합니다:

```
Name: NEXT_PUBLIC_SUPABASE_URL
Value: https://your-project-id.supabase.co
```

```
Name: NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: eyJ0eXAiOiJKV1QiLCJhbGc... (Supabase Dashboard에서 복사)
```

**2. Anthropic API (필수)**

1. https://console.anthropic.com 방문
2. "API Keys" 섹션 접근
3. API Key 생성 또는 기존 키 복사

```
Name: ANTHROPIC_API_KEY
Value: sk-ant-v0-xxxxxxxxxxxxxxxx
```

#### 선택 환경 변수

**OpenAI API (선택사항)**

OpenAI 문맥 검토 기능을 사용하려면:

```
Name: OPENAI_API_KEY
Value: sk-proj-xxxxxxxxxxxxxxxx
```

### 4단계: 배포 시작 (1분)

1. 모든 환경 변수를 입력 완료
2. "Deploy" 버튼 클릭
3. 배포 로그 확인 (약 3-5분 소요)
4. 배포 완료 후 URL 받기 (예: `https://translation-manager-xxx.vercel.app`)

---

## 상세 배포 단계

### Supabase 프로덕션 설정

프로덕션용 새 Supabase 프로젝트를 생성하고 데이터베이스를 초기화합니다.

#### 1. Supabase 프로젝트 생성

1. https://app.supabase.com 방문
2. "New Project" 클릭
3. 프로젝트 설정:
   - **Name**: `translation-manager-prod` (또는 원하는 이름)
   - **Database Password**: 강력한 암호 설정 (저장해두기!)
   - **Region**: `Southeast Asia (Singapore)` (또는 가장 가까운 지역)
4. "Create new project" 클릭
5. 프로젝트 생성 대기 (약 5분)

#### 2. 프로덕션 프로젝트 정보 복사

프로젝트 생성 후:

1. Settings → API 이동
2. 다음 정보 복사:
   - `Project URL`: (NEXT_PUBLIC_SUPABASE_URL)
   - `anon public` key: (NEXT_PUBLIC_SUPABASE_ANON_KEY)

#### 3. 데이터베이스 마이그레이션 실행

**방법 A: Supabase CLI (권장)**

```bash
# Supabase CLI 설치 (아직 하지 않았다면)
npm install -g supabase

# 로그인
supabase login

# 마이그레이션 실행
supabase link --project-ref your-project-id
supabase db push
```

**방법 B: Supabase 대시보드 (CLI 없는 경우)**

1. Supabase 프로젝트 대시보드 접근
2. "SQL Editor" 클릭
3. "New Query" 클릭
4. `/supabase/migrations/001_initial_schema.sql` 파일 내용 복사
5. SQL Editor에 붙여넣기
6. "Run" 클릭

#### 4. 마이그레이션 파일 확인

현재 지원되는 마이그레이션:
- `supabase/migrations/001_initial_schema.sql`: 기본 스키마 (테이블, 인덱스 생성)

### 배포 환경 변수 최종 체크리스트

Vercel 배포 전 다음을 확인합니다:

- [ ] **NEXT_PUBLIC_SUPABASE_URL** 설정됨 (https://xxx.supabase.co)
- [ ] **NEXT_PUBLIC_SUPABASE_ANON_KEY** 설정됨 (eyJ...)
- [ ] **ANTHROPIC_API_KEY** 설정됨 (sk-ant-...)
- [ ] **OPENAI_API_KEY** 설정됨 (선택사항, sk-proj-...)
- [ ] 모든 API 키가 올바른 서비스에서 복사됨

---

## 배포 후 검증

배포 완료 후 다음 단계에서 애플리케이션을 검증합니다.

### 1. 배포 URL 접속 확인

배포 완료 후 Vercel이 제공한 URL로 접속합니다:

```
https://translation-manager-xxx.vercel.app
```

다음을 확인합니다:
- [ ] 페이지 로드됨
- [ ] HTTPS 연결됨 (URL 왼쪽 자물쇠 아이콘)
- [ ] 로그인 페이지 표시됨

### 2. 로그인/회원가입 테스트

1. "Sign Up" 클릭
2. 테스트 계정 생성:
   - Email: `test@example.com`
   - Password: 강한 암호
3. 회원가입 완료 확인
4. 대시보드로 리다이렉트되는지 확인

**확인 사항**:
- [ ] 회원가입 성공
- [ ] 대시보드 접근 가능
- [ ] Supabase 데이터베이스에 사용자 생성됨 (Supabase 대시보드 확인)

### 3. PDF 업로드 테스트

1. 대시보드에서 "Upload" 메뉴 클릭
2. 소규모 PDF 파일 준비 (2MB 이하):
   - 테스트 파일: `/test-pdfs/sample.pdf` 사용 가능
   - 또는 직접 작은 PDF 생성
3. 파일 업로드:
   - 파일 선택 또는 드래그 & 드롭
   - "제품 분류" 선택 (예: SaaS)
   - "파일 파싱" 클릭
4. 파싱 결과 확인:
   - [ ] 텍스트 추출 성공
   - [ ] 추출된 텍스트 표시됨
   - [ ] 에러 없음

### 4. AI 번역 테스트

1. "번역 항목으로 추가" 클릭
2. 번역 관리 페이지로 이동
3. 번역 항목 추가 및 번역 생성:
   - 예: "Login" 텍스트
   - AI 번역 요청
   - [ ] Anthropic API 호출 성공
   - [ ] 번역 결과 표시됨

### 5. 보안 헤더 검증

브라우저 개발자 도구에서 보안 헤더 확인:

1. F12 또는 오른쪽 클릭 → "검사"
2. "Network" 탭 클릭
3. 페이지 새로고침
4. 첫 번째 요청 선택
5. "Response Headers" 확인:

```
✓ Strict-Transport-Security: max-age=31536000; includeSubDomains
✓ Content-Security-Policy: default-src 'self'; ...
✓ X-Content-Type-Options: nosniff
✓ X-Frame-Options: DENY
✓ X-XSS-Protection: 1; mode=block
✓ Referrer-Policy: strict-origin-when-cross-origin
```

### 6. 성능 지표 확인

#### Lighthouse 점수 확인

1. DevTools → Lighthouse
2. "Analyze page load" 클릭
3. 결과 확인:
   - [ ] Performance > 80
   - [ ] Accessibility > 80
   - [ ] Best Practices > 80
   - [ ] SEO > 80

#### 로딩 시간 확인

DevTools → Network 탭에서:
- [ ] First Contentful Paint (FCP) < 2초
- [ ] Largest Contentful Paint (LCP) < 3초
- [ ] Time to Interactive (TTI) < 3.5초

### 7. 에러 로그 확인

Vercel 대시보드에서 배포 로그 확인:

1. https://vercel.com/dashboard
2. 프로젝트 선택
3. "Deployments" 탭 클릭
4. 최신 배포 클릭
5. "Logs" 섹션 확인:
   - [ ] 빌드 성공
   - [ ] 런타임 에러 없음
   - [ ] API 호출 성공

---

## 문제 해결

배포 중 또는 배포 후 발생할 수 있는 일반적인 문제와 해결 방법입니다.

### 1. 환경 변수 오류

**증상**: 다음 에러 메시지
```
Error: ANTHROPIC_API_KEY is not configured
Error: NEXT_PUBLIC_SUPABASE_URL is not defined
```

**해결 방법**:
1. Vercel Dashboard → 프로젝트 → Settings
2. "Environment Variables" 섹션 이동
3. 모든 변수가 "Production" 환경에 추가되었는지 확인
4. 변수명이 정확한지 확인 (대소문자 구분)
5. 변수값에 공백이 없는지 확인
6. 변경 후 "Redeploy" 클릭

### 2. Supabase 연결 실패

**증상**: 다음 에러 메시지
```
Error: Failed to fetch from Supabase
Error: Unable to connect to database
```

**확인 사항**:
1. Supabase 프로젝트 상태 확인:
   - https://app.supabase.com 접속
   - 프로젝트가 "Active" 상태인지 확인
2. URL이 올바른지 확인:
   - `NEXT_PUBLIC_SUPABASE_URL`이 `https://xxx.supabase.co` 형식인지 확인
3. Anon Key 확인:
   - Supabase Dashboard → Settings → API
   - `anon public` 키 복사 및 재설정
4. CORS 설정 확인:
   - Supabase Dashboard → Authentication → Policies
   - Vercel 도메인이 허용되어 있는지 확인

**해결 방법**:
1. 새 Supabase API 키 발급
2. Vercel 환경 변수 업데이트
3. 프로젝트 "Redeploy"

### 3. 빌드 실패

**증상**: Vercel 배포 로그
```
error: Module not found
error: Cannot find module '...'
error: Type error: ...
```

**해결 방법**:

로컬에서 빌드 테스트:
```bash
npm install
npm run build
npm start
```

만약 로컬에서도 실패하면:
1. 의존성 재설치:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   npm run build
   ```
2. TypeScript 오류 확인:
   ```bash
   npx tsc --noEmit
   ```
3. 변경사항 git 커밋 및 푸시:
   ```bash
   git add .
   git commit -m "fix: resolve build errors"
   git push origin main
   ```
4. Vercel에서 "Redeploy" 클릭

### 4. PDF 업로드 실패 (4.5MB 초과)

**증상**: 파일 업로드 시
```
Error: Request body too large
File is too large. Maximum size is 4.5MB.
```

**해결 방법**:
- 예상된 동작: UI에서 4.5MB 초과 파일은 사전에 차단됨
- 4.5MB 이하의 파일로 테스트
- **향후 개선**: Phase 2에서 50MB 지원 예정 (Supabase Storage 직접 업로드)

### 5. API 요청 타임아웃

**증상**: 번역 생성 중
```
Error: Request timeout
Error: Timeout waiting for Anthropic API
```

**확인 사항**:
1. Anthropic API 키 확인:
   - https://console.anthropic.com에서 키 활성 상태 확인
   - API 사용량 제한 확인
2. Vercel 함수 타임아웃 확인:
   - `vercel.json`에서 `maxDuration: 60`이 설정되어 있는지 확인
3. API 상태 확인:
   - Anthropic: https://status.anthropic.com
   - OpenAI: https://status.openai.com (OpenAI 사용 시)

### 6. 데이터베이스 마이그레이션 오류

**증상**: 회원가입 시
```
Error: relation "users" does not exist
Error: column "id" does not exist
```

**해결 방법**:
1. Supabase 대시보드 → SQL Editor
2. `001_initial_schema.sql` 파일 내용 실행
3. 실행 완료 확인

---

## Phase 2 개선사항

### 50MB PDF 지원 (추후)

현재 4.5MB 제한은 Vercel 서버리스 함수 제한입니다. Phase 2에서 다음과 같이 개선될 예정입니다:

**구현 방법**:
1. Supabase Storage bucket 생성
2. 클라이언트 직접 업로드 구현 (AWS S3처럼)
3. 서버에서 Storage URL 참조
4. 50MB 이상 파일 지원

**소요 시간**: 약 3-4시간

### 커스텀 도메인 연결 (선택사항)

현재: `https://translation-manager.vercel.app`
향후: `https://translations.yourdomain.com`

**설정 방법**:
1. Vercel Dashboard → Domains
2. 원하는 도메인 입력
3. DNS 레코드 설정 (도메인 제공자에서)
4. NEXT_PUBLIC_APP_URL 환경 변수 업데이트

**소요 시간**: 10-20분

### 모니터링 강화 (선택사항)

**Vercel Analytics**:
- 배포 후 자동 활성화
- Real-time 사용 통계 확인

**Sentry 에러 트래킹** (선택사항):
```bash
npm install @sentry/nextjs
```
- Sentry 계정 생성
- SENTRY_AUTH_TOKEN 환경 변수 설정

**Supabase 데이터베이스 성능 모니터링**:
- Supabase Dashboard → Logs
- 쿼리 성능 확인

---

## 배포 체크리스트

### 배포 전
- [ ] 로컬에서 `npm run build` 성공
- [ ] 로컬에서 `npm start` 실행 및 기능 테스트
- [ ] 모든 변경사항 git commit & push
- [ ] GitHub 저장소 public 또는 Vercel에 접근 권한 부여

### 배포 중
- [ ] Vercel 배포 로그 확인
- [ ] 빌드 성공 (Build passed)
- [ ] 배포 완료 (Deployment succeeded)

### 배포 후
- [ ] Vercel 배포 URL 접속 성공
- [ ] 로그인/회원가입 테스트
- [ ] PDF 업로드 및 파싱 테스트
- [ ] AI 번역 테스트
- [ ] 보안 헤더 확인
- [ ] Lighthouse 점수 확인 (Performance > 80)
- [ ] Vercel 로그에서 에러 확인
- [ ] Supabase 데이터베이스에 데이터 저장 확인

### 성공 지표
- ✅ 배포 URL 공개 공유 가능
- ✅ 누구나 회원가입 및 사용 가능
- ✅ 로그와 에러 없음
- ✅ API 응답 시간 < 2초
- ✅ Lighthouse Performance > 80

---

## 참고 자료

- [Next.js 배포 가이드](https://nextjs.org/docs/deployment)
- [Vercel Next.js 배포](https://vercel.com/docs/frameworks/nextjs)
- [Vercel 환경 변수](https://vercel.com/docs/projects/environment-variables)
- [Supabase 프로덕션 배포](https://supabase.com/docs/guides/platform/going-into-prod)
- [Anthropic API 문서](https://docs.anthropic.com)

---

## 추가 지원

배포 중 문제가 발생하면:

1. **GitHub Issues**: https://github.com/dophiplan/translation-manager/issues
2. **Vercel 지원**: https://vercel.com/support
3. **Supabase 문서**: https://supabase.com/docs
4. **Anthropic 문서**: https://docs.anthropic.com

---

**배포 완료! 축하합니다! 🎉**

이제 누구나 링크를 클릭해서 Translation Manager를 사용할 수 있습니다.
