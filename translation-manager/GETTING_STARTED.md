# 빠른 시작 가이드 (15분 안에 설치)

Translation Manager를 15분 안에 설치하고 실행하는 단계별 가이드입니다.

## 요구사항

- Node.js 18+ (확인: `node --version`)
- npm 9+ (확인: `npm --version`)
- Git
- 웹 브라우저

## Step 1: 프로젝트 클론 (1분)

```bash
git clone https://github.com/dophiplan/translation-manager.git
cd translation-manager
```

## Step 2: 필수 API 키 준비 (5분)

### 2-1. Supabase 프로젝트 생성

1. https://supabase.com 방문 및 로그인
2. **New Project** 클릭
3. 프로젝트 이름 입력 (예: "translation-manager")
4. 강력한 데이터베이스 비밀번호 설정
5. Region 선택 (권장: Asia Pacific - Singapore)
6. **Create new project** 클릭 (2-3분 소요)

7. 프로젝트 생성 완료 후:
   - 좌측 메뉴 → **Settings** → **API**
   - `Project URL` 복사 (예: `https://xxx.supabase.co`)
   - `anon public` 키 복사

### 2-2. Anthropic API 키 발급

1. https://console.anthropic.com 방문
2. **API Keys** 섹션으로 이동
3. **Create Key** 클릭
4. 키 생성 후 복사 (나중에 보면 안 보이므로 지금 복사!)

### 2-3. OpenAI API 키 (선택사항)

문맥 검토 기능을 사용하려면:

1. https://platform.openai.com/api-keys 방문
2. **Create new secret key** 클릭
3. 키 복사

## Step 3: 환경 변수 설정 (2분)

```bash
# .env.local 파일 생성
cp .env.local.example .env.local
```

`.env.local` 파일을 열어 다음 값들을 입력합니다:

```env
# Step 2-1에서 복사한 Supabase 정보
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Step 2-2에서 복사한 Anthropic API 키
ANTHROPIC_API_KEY=your_anthropic_api_key

# (선택사항) Step 2-3의 OpenAI 키
OPENAI_API_KEY=your_openai_api_key
```

## Step 4: 의존성 설치 (3분)

```bash
npm install
```

## Step 5: 데이터베이스 마이그레이션 (2분)

### Option A: Supabase CLI (권장)

```bash
# Supabase CLI 설치 (처음 한 번만)
npm install -g supabase

# 마이그레이션 실행
supabase migration list  # 마이그레이션 확인
supabase db push        # 데이터베이스에 적용
```

### Option B: Supabase 대시보드 수동 실행

1. https://app.supabase.com 로그인
2. 생성한 프로젝트 선택
3. **SQL Editor** 클릭
4. **New Query** 클릭
5. `supabase/migrations/001_initial_schema.sql` 파일의 전체 내용 복사
6. SQL Editor에 붙여넣기
7. **Run** 클릭

## Step 6: 설정 검증 (1분)

```bash
npm run verify
```

성공 메시지가 나오면 모든 설정이 완료됩니다:

```
✓ Environment Variables - configured
✓ Dependencies - installed
✓ Migrations - applied
✓ Project Structure - verified
```

## Step 7: 개발 서버 실행

```bash
npm run dev
```

브라우저에서 http://localhost:3000 열기

## 로그인

기본 테스트 계정:

- **이메일**: test@example.com
- **비밀번호**: password123

> 첫 로그인 후 설정 페이지에서 API 키를 추가 설정할 수 있습니다.

## 문제 해결

### "ANTHROPIC_API_KEY is not configured" 오류

- `.env.local` 파일이 프로젝트 루트에 있는지 확인
- Anthropic API 키가 올바르게 입력됐는지 확인
- 개발 서버 재시작: `npm run dev`

### "Cannot connect to Supabase" 오류

- Supabase URL과 Anon Key가 올바른지 확인
- Supabase 프로젝트가 정상 상태인지 https://app.supabase.com에서 확인
- 인터넷 연결 확인

### "Migration failed" 오류

- Supabase 프로젝트가 완전히 생성됐는지 확인 (3분 정도 소요)
- 마이그레이션 파일의 SQL 문법 오류 확인
- Supabase 대시보드에서 **Logs** 섹션 확인

### npm install 오류

```bash
# 캐시 초기화
npm cache clean --force

# 다시 설치
npm install
```

## 다음 단계

✓ 설치 완료!

이제 다음을 시도해보세요:

1. **PDF 업로드**: Dashboard → Upload에서 PDF 업로드
2. **번역 관리**: Translations 탭에서 번역 항목 관리
3. **용어집 설정**: Glossary 탭에서 용어 추가
4. **API 테스트**: Settings에서 API 키 설정 후 번역 실행

## 추가 자료

- [README.md](./README.md) - 전체 문서
- [API 엔드포인트](./README.md#api-엔드포인트) - API 사용 방법
- [프로젝트 구조](./README.md#프로젝트-구조) - 코드 구조 설명

## 문의

문제가 있으면 GitHub Issues에 보고해주세요:
https://github.com/dophiplan/translation-manager/issues

---

**팁**: 설정이 완료되면 `npm run verify`를 실행하여 언제든지 설정 상태를 확인할 수 있습니다.
