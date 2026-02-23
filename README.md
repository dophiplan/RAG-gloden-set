# Translation Resource Manager

번역 리소스 관리 시스템 - 기획서 PDF에서 번역 대상 텍스트를 자동 추출하고, 기존 번역과 중복 검사, AI 문맥 검토, 상태 관리를 제공하는 웹 서비스

## 기술 스택

- **Frontend/Backend**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL)
- **AI**: Anthropic API (Claude) - Primary service
  - OpenAI API (Optional - for context review feature)
- **PDF 파싱**: unpdf
- **스타일링**: Tailwind CSS

## 주요 기능

### 1. PDF 텍스트 추출
- PDF 업로드 후 따옴표로 감싼 텍스트 자동 추출
- 작은따옴표(' ') 및 큰따옴표(" ") 지원
- 한글 따옴표(' ', " ") 지원

### 2. 중복 번역 검사
- 완전 일치: "이미 번역됨" 표시
- 유사 (80%+): "유사 번역 존재" 경고
- 신규: 번역 필요 표시

### 3. AI 문맥 검토 (OpenAI)
- 용어 일관성 검토
- 어조 일관성 검토
- 브랜드 톤앤매너 검토

### 4. 상태 관리
| 상태 | 색상 | 의미 |
|------|------|------|
| 번역 요청 | 노란색 | 번역 필요 |
| 검수 완료 | 흰색 | 번역가 검수 완료 |
| 반영 완료 | 회색 | 개발에 반영됨 |

### 5. 지원 언어 (8개)
- 한국어 (ko)
- English (en)
- 日本語 (ja)
- 中文简体 (zh-CN)
- 中文繁體 (zh-TW)
- Español (es)
- Français (fr)
- Deutsch (de)

## 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

`.env.local.example`을 `.env.local`로 복사하고 값을 설정합니다:

```bash
cp .env.local.example .env.local
```

**필수 환경 변수:**

1. **Supabase** (https://supabase.com에서 프로젝트 생성 후 설정)
   - `NEXT_PUBLIC_SUPABASE_URL`: 프로젝트 URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Anonymous Key

2. **OpenAI API** (https://platform.openai.com에서 API 키 발급)
   - `OPENAI_API_KEY`: 필수 - AI 번역의 주요 서비스

**선택 환경 변수:**

3. **Anthropic API** (선택사항, https://console.anthropic.com)
   - `ANTHROPIC_API_KEY`: 문맥 검토 기능 활용 시에만 필요

4. **기타 설정**
   - `EMAIL_PROVIDER`: 이메일 서비스 (기본값: 'mock')
   - `NEXT_PUBLIC_APP_URL`: 앱 URL (기본값: 'http://localhost:3000')

### 3. Supabase 데이터베이스 설정

**Option 1: Supabase CLI (권장)**
```bash
npx supabase migration list
npx supabase db push
```

**Option 2: Supabase 대시보드**
Supabase 대시보드의 SQL Editor에서 `supabase/migrations/001_initial_schema.sql` 파일의 내용을 실행합니다.

**마이그레이션 파일:**
- `supabase/migrations/001_initial_schema.sql`: 기본 스키마 (테이블, 인덱스 생성)

설정 완료 후 다음을 확인하세요:
- [ ] Supabase 프로젝트가 생성됨
- [ ] 환경 변수가 모두 설정됨
- [ ] 데이터베이스 마이그레이션이 완료됨

`npm run verify` 명령으로 설정을 검증할 수 있습니다.

### 4. 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000 에서 앱에 접속할 수 있습니다.

### 5. 프로덕션 빌드

```bash
npm run build
npm start
```

## 프로젝트 구조

```
translation-manager/
├── src/
│   ├── app/
│   │   ├── (auth)/login/         # 로그인 페이지
│   │   ├── (dashboard)/
│   │   │   ├── page.tsx          # 대시보드
│   │   │   ├── upload/           # PDF 업로드
│   │   │   ├── translations/     # 번역 관리
│   │   │   ├── glossary/         # 용어집
│   │   │   └── settings/         # 설정
│   │   └── api/
│   │       ├── pdf/parse/        # PDF 파싱
│   │       ├── translations/     # 번역 CRUD
│   │       ├── ai/context-check/ # AI 문맥 검토
│   │       ├── glossary/         # 용어집 CRUD
│   │       └── import/           # 스프레드시트 import
│   ├── components/
│   │   ├── ui/                   # 공통 UI 컴포넌트
│   │   └── layout/               # 레이아웃 컴포넌트
│   ├── lib/
│   │   ├── supabase/             # Supabase 클라이언트
│   │   ├── openai/               # OpenAI 클라이언트
│   │   ├── pdf/                  # PDF 파싱 유틸리티
│   │   └── similarity.ts         # 텍스트 유사도 계산
│   └── types/                    # TypeScript 타입 정의
├── supabase/
│   └── migrations/               # 데이터베이스 마이그레이션
└── package.json
```

## API 엔드포인트

### 번역 관리
- `GET /api/translations` - 번역 목록 조회
- `POST /api/translations` - 번역 생성
- `GET /api/translations/[id]` - 번역 상세 조회
- `PATCH /api/translations/[id]` - 번역 수정
- `DELETE /api/translations/[id]` - 번역 삭제
- `POST /api/translations/bulk` - 번역 일괄 생성
- `PATCH /api/translations/bulk` - 번역 상태 일괄 수정
- `POST /api/translations/check-duplicates` - 중복 검사

### 용어집
- `GET /api/glossary` - 용어집 조회
- `POST /api/glossary` - 용어 추가
- `PATCH /api/glossary/[id]` - 용어 수정
- `DELETE /api/glossary/[id]` - 용어 삭제

### AI
- `POST /api/ai/context-check` - AI 문맥 검토

### 기타
- `POST /api/pdf/parse` - PDF 텍스트 추출
- `POST /api/import` - CSV 가져오기
- `GET /api/dashboard/stats` - 대시보드 통계

## CSV Import 형식

```csv
source_text,context,status,ko,en
"Login","로그인 버튼",pending,"로그인","Login"
"Sign up","회원가입 버튼",pending,"회원가입","Sign up"
```

## 빠른 시작 가이드

신규 사용자는 [GETTING_STARTED.md](./GETTING_STARTED.md)를 참고하여 15분 안에 설치할 수 있습니다.

## 배포

### 원클릭 Vercel 배포

<a href="https://vercel.com/new/clone?repository-url=https://github.com/dophiplan/translation-manager&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY,OPENAI_API_KEY&envDescription=Supabase%20and%20OpenAI%20API%20keys%20required&envLink=https://github.com/dophiplan/translation-manager/blob/main/DEPLOYMENT.md">
  <img src="https://vercel.com/button" alt="Deploy with Vercel" />
</a>

### 수동 배포

자세한 배포 방법은 [DEPLOYMENT.md](./DEPLOYMENT.md)를 참고하세요.

**중요**: 현재 버전은 4.5MB PDF를 지원합니다. 더 큰 파일은 Phase 2 업데이트에서 지원 예정입니다.

## 아키텍처

이 프로젝트는 **AI-Friendly 구조**와 **유지보수성**을 위해 리팩토링되었습니다.

### Backend: 3-Tier Architecture

```
/api/translations/
  ├── handlers/           # HTTP 요청/응답 처리
  ├── services/           # 비즈니스 로직
  ├── repositories/       # 데이터베이스 접근
  └── route.ts           # 라우팅 (21줄)
```

**계층별 책임:**
- **Handler**: HTTP 요청 파싱 + 응답 반환만
- **Service**: 비즈니스 로직 (여러 Repository 조합)
- **Repository**: DB CRUD만 (Supabase 쿼리)

### Frontend: Component & Hook Decomposition

```
/components/translations/
  └── table/
      ├── TranslationTableV2.tsx        # 테이블 컨테이너
      ├── TranslationRow.tsx            # 개별 행 (memoized)
      ├── TranslationTableHeader.tsx    # 헤더 (memoized)
      └── TranslationTablePagination.tsx # 페이지네이션

/hooks/
  ├── mutations/          # 데이터 변경 훅 (6개)
  ├── useModalStates.ts   # 모달 상태 관리
  ├── useTranslationEventHandlers.ts  # 이벤트 핸들러
  └── ...                 # 기타 전문화된 훅
```

**설계 원칙:**
- 각 파일 150줄 이하
- 단일 책임 원칙
- React.memo로 성능 최적화
- AI-Friendly 파일명 (파일명만으로 내용 파악 가능)

### 테스트

```
tests/
  └── characterization/units/
      ├── validation_schemas.test.ts    # 37 tests
      ├── format_functions.test.ts      # 10 tests
      └── similarity_functions.test.ts  # 26 tests
```

**75개 테스트**로 리팩토링 중 안전성 보장

자세한 내용은 [REFACTORING_REPORT.md](./REFACTORING_REPORT.md)를 참고하세요.

## 라이선스

MIT
