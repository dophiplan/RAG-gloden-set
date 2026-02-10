# Claude Code와 함께 만드는 번역 관리 시스템 (1) - 프로젝트 시작과 기본 아키텍처 구축

> **"AI와 함께라면 5일 만에 엔터프라이즈급 시스템을 만들 수 있을까?"**
> Next.js, Supabase, Claude Code로 시작한 번역 관리 시스템 개발기 첫 번째 이야기

---

## 🎯 들어가며: 왜 번역 관리 시스템인가?

글로벌 서비스를 운영하다 보면 번역 관리는 생각보다 복잡한 문제입니다. 단순히 텍스트를 옮기는 것이 아니라, 버전 관리, 진행 상태 추적, 여러 언어 동시 관리, 번역가와의 협업 등 고려해야 할 요소가 많습니다.

기존 솔루션들은 있지만, 우리 팀의 워크플로우에 맞춤화된 시스템이 필요했습니다. 그리고 이번에는 특별한 동료와 함께하기로 했습니다. 바로 **Claude Code**였습니다.

### 프로젝트 목표

- ✅ **다국어 번역 관리**: 한국어, 영어, 일본어, 중국어 등 9개 언어 지원
- ✅ **진행 상태 추적**: 요청됨 → 진행중 → 검토중 → 완료 워크플로우
- ✅ **협업 기능**: 번역가, 검토자, 관리자 역할 구분
- ✅ **대량 처리**: PDF/이미지에서 텍스트 추출 및 일괄 등록
- ✅ **AI 통합**: OpenAI/Claude API를 활용한 자동 번역 제안

---

## 🏗️ 기술 스택 선정: 왜 이 조합인가?

### 1. Next.js 16 - 최신 풀스택 프레임워크

```typescript
// App Router 기반의 현대적인 구조
app/
  ├── (dashboard)/
  │   ├── translations/
  │   ├── glossary/
  │   └── users/
  ├── api/
  │   ├── translations/
  │   └── auth/
  └── page.tsx
```

**선택 이유:**
- **서버 컴포넌트**: 초기 로딩 속도 최적화
- **API Routes**: 백엔드 없이 풀스택 개발 가능
- **파일 기반 라우팅**: 직관적인 프로젝트 구조
- **TypeScript 네이티브**: 타입 안전성 보장

### 2. Supabase - 오픈소스 Firebase 대안

```sql
-- 핵심 데이터 모델
CREATE TABLE translations (
  id UUID PRIMARY KEY,
  source_text TEXT NOT NULL,
  product_codes TEXT[],
  scope TEXT CHECK (scope IN ('SaaS', 'Solution')),
  priority TEXT CHECK (priority IN ('상', '중', '하')),
  status TEXT DEFAULT '요청됨',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE translation_results (
  id UUID PRIMARY KEY,
  translation_id UUID REFERENCES translations(id),
  language_code TEXT NOT NULL,
  translated_text TEXT,
  status TEXT DEFAULT 'pending',
  translator_id UUID REFERENCES users(id)
);
```

**선택 이유:**
- **PostgreSQL 기반**: 강력한 관계형 데이터베이스
- **실시간 구독**: Realtime API로 협업 기능 구현
- **Row Level Security**: 세밀한 권한 관리
- **인증 내장**: Auth 시스템 별도 구축 불필요

### 3. Tailwind CSS - 유틸리티 퍼스트 CSS

```tsx
// 컴포넌트 예시
<Card className="p-6 hover:shadow-lg transition-shadow">
  <h2 className="text-xl font-semibold text-gray-900 mb-4">
    번역 요청
  </h2>
  <div className="grid grid-cols-3 gap-4">
    <Badge variant="pending">요청됨</Badge>
    <Badge variant="progress">진행중</Badge>
    <Badge variant="completed">완료</Badge>
  </div>
</Card>
```

**선택 이유:**
- **빠른 프로토타이핑**: 클래스 조합으로 즉시 UI 구현
- **일관된 디자인**: 디자인 시스템 자동 구축
- **최적화**: 사용된 클래스만 빌드에 포함

---

## 🎨 초기 UI/UX 설계

### 사용자 여정 맵핑

**1. 번역 요청자 (Product Manager)**
```
1. 로그인 → 대시보드
2. "번역 요청하기" 클릭
3. PDF 업로드 또는 직접 입력
4. 제품, 버전, 언어 선택
5. 요청 생성 → 알림 전송
```

**2. 번역가 (Translator)**
```
1. 로그인 → 할당된 번역 목록
2. 번역 항목 선택
3. 원문 확인 + 문맥 정보
4. 번역 입력 → 저장
5. "완료" 버튼 → 상태 변경
```

**3. 관리자 (Master)**
```
1. 전체 현황 대시보드
2. 통계: 언어별, 상태별, 번역가별
3. 사용자 권한 관리
4. 용어집 관리
5. 설정 (제품, 언어 관리)
```

### 핵심 화면 구성

#### 대시보드 (Dashboard)
```tsx
// 주요 지표 카드
<div className="grid grid-cols-4 gap-4">
  <StatCard title="전체 번역" value={1234} />
  <StatCard title="진행중" value={56} trend="+12%" />
  <StatCard title="이번 주 완료" value={89} trend="+23%" />
  <StatCard title="대기중" value={23} trend="-5%" />
</div>

// 최근 요청 목록
<RequestList requests={recentRequests} />

// 빠른 액션
<QuickActions>
  <Button>새 번역 요청</Button>
  <Button>용어집 검색</Button>
</QuickActions>
```

#### 번역 관리 (Translations)
```tsx
// 고급 필터링
<Filters>
  <ProductFilter products={products} />
  <LanguageFilter languages={languages} />
  <StatusFilter statuses={statuses} />
  <DateRangeFilter />
</Filters>

// 번역 테이블
<TranslationTable>
  <Column field="source_text" sortable searchable />
  <Column field="languages" render={LanguageBadges} />
  <Column field="status" render={StatusBadge} />
  <Column field="priority" sortable />
  <Column field="actions" render={ActionButtons} />
</TranslationTable>
```

---

## 🔧 개발 환경 세팅

### 1. 프로젝트 초기화

```bash
# Next.js 프로젝트 생성
npx create-next-app@latest translation-manager --typescript --tailwind --app

# 핵심 의존성 설치
npm install @supabase/supabase-js @supabase/ssr
npm install react-hot-toast uuid
npm install openai @anthropic-ai/sdk

# 개발 도구
npm install -D @types/uuid
```

### 2. 환경변수 설정

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI APIs (옵션)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Supabase 클라이언트 설정

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
}
```

---

## 📊 데이터베이스 스키마 설계

### 핵심 테이블 구조

#### 1. translations - 번역 요청의 중심

```sql
CREATE TABLE translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_text TEXT NOT NULL,
  context TEXT,
  product_codes TEXT[] DEFAULT '{}',
  scope TEXT CHECK (scope IN ('SaaS', 'Solution')),
  version TEXT,
  priority TEXT CHECK (priority IN ('상', '중', '하')) DEFAULT '중',
  status TEXT DEFAULT '요청됨',
  requester_id UUID REFERENCES users(id),
  completion_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 최적화
CREATE INDEX idx_translations_status ON translations(status);
CREATE INDEX idx_translations_product ON translations USING GIN(product_codes);
CREATE INDEX idx_translations_created ON translations(created_at DESC);
```

#### 2. translation_results - 다국어 번역 결과

```sql
CREATE TABLE translation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  translation_id UUID REFERENCES translations(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  translated_text TEXT,
  status TEXT DEFAULT 'pending',
  translator_id UUID REFERENCES users(id),
  reviewed_by UUID REFERENCES users(id),
  ai_suggested_text TEXT,
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(translation_id, language_code)
);

CREATE INDEX idx_results_language ON translation_results(language_code);
CREATE INDEX idx_results_status ON translation_results(status);
```

#### 3. users - 사용자 및 권한 관리

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  roles TEXT[] DEFAULT '{}',
  languages TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 역할 기반 권한
-- roles: ['master', '1st_master', 'translator', 'viewer']
```

#### 4. glossary - 용어집

```sql
CREATE TABLE glossary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term TEXT NOT NULL,
  language_code TEXT NOT NULL,
  translation TEXT NOT NULL,
  context TEXT,
  product_codes TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(term, language_code)
);
```

### Row Level Security (RLS) 정책

```sql
-- translations 테이블 보안
ALTER TABLE translations ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자만 읽기 가능
CREATE POLICY "Authenticated users can view translations"
  ON translations FOR SELECT
  TO authenticated
  USING (true);

-- 요청자 본인만 수정 가능
CREATE POLICY "Users can update own translations"
  ON translations FOR UPDATE
  TO authenticated
  USING (requester_id = auth.uid());

-- Master는 모든 권한
CREATE POLICY "Masters have full access"
  ON translations
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND ('master' = ANY(roles) OR '1st_master' = ANY(roles))
    )
  );
```

---

## 🎯 첫 번째 마일스톤: CRUD 구현

### 1. 번역 목록 조회 (Read)

```typescript
// app/api/translations/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)

  // 필터 파라미터
  const product = searchParams.get('product')
  const status = searchParams.get('status')
  const language = searchParams.get('language')

  let query = supabase
    .from('translations')
    .select(`
      *,
      requester:users!requester_id(name, email),
      results:translation_results(
        id,
        language_code,
        translated_text,
        status,
        translator:users!translator_id(name)
      )
    `)
    .order('created_at', { ascending: false })

  // 동적 필터링
  if (product) {
    query = query.contains('product_codes', [product])
  }
  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ translations: data })
}
```

### 2. 새 번역 생성 (Create)

```typescript
// app/api/translations/route.ts
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { source_text, context, product_codes, scope, priority, languages } = body

  // 1. 번역 생성
  const { data: translation, error: translationError } = await supabase
    .from('translations')
    .insert({
      source_text,
      context,
      product_codes,
      scope,
      priority,
      requester_id: user.id,
      status: '요청됨'
    })
    .select()
    .single()

  if (translationError) {
    return NextResponse.json({ error: translationError.message }, { status: 500 })
  }

  // 2. 각 언어별 결과 레코드 생성
  const results = languages.map((lang: string) => ({
    translation_id: translation.id,
    language_code: lang,
    status: 'pending'
  }))

  const { error: resultsError } = await supabase
    .from('translation_results')
    .insert(results)

  if (resultsError) {
    return NextResponse.json({ error: resultsError.message }, { status: 500 })
  }

  return NextResponse.json({ translation, results })
}
```

### 3. 번역 수정 (Update)

```typescript
// app/api/translations/[id]/route.ts
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params
  const body = await request.json()

  const { data, error } = await supabase
    .from('translations')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ translation: data })
}
```

---

## 🎨 재사용 가능한 UI 컴포넌트 구축

### 1. Card 컴포넌트

```typescript
// components/ui/Card.tsx
interface CardProps {
  children: React.ReactNode
  className?: string
}

export default function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }: CardProps) {
  return (
    <div className={`px-6 py-4 border-b border-gray-200 ${className}`}>
      {children}
    </div>
  )
}

export function CardTitle({ children, className = '' }: CardProps) {
  return (
    <h3 className={`text-lg font-semibold text-gray-900 ${className}`}>
      {children}
    </h3>
  )
}
```

### 2. Button 컴포넌트

```typescript
// components/ui/Button.tsx
type ButtonVariant = 'primary' | 'secondary' | 'danger'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  loading?: boolean
}

export default function Button({
  children,
  variant = 'primary',
  loading = false,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles = 'px-4 py-2 rounded-lg font-medium transition-colors'

  const variantStyles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700'
  }

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <Spinner size="sm" />
          처리 중...
        </span>
      ) : (
        children
      )}
    </button>
  )
}
```

### 3. Badge 컴포넌트 - 상태 표시

```typescript
// components/ui/Badge.tsx
type BadgeVariant = 'pending' | 'progress' | 'review' | 'completed'

interface BadgeProps {
  variant: BadgeVariant
  children: React.ReactNode
}

export default function Badge({ variant, children }: BadgeProps) {
  const variants = {
    pending: 'bg-gray-100 text-gray-800',
    progress: 'bg-blue-100 text-blue-800',
    review: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800'
  }

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  )
}
```

---

## 🚀 첫 번째 기능 완성: 번역 요청 폼

```typescript
// app/(dashboard)/translations/components/CreateTranslationModal.tsx
'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import { showSuccess, showError } from '@/lib/notifications'

export default function CreateTranslationModal({ isOpen, onClose, onSuccess }) {
  const [sourceText, setSourceText] = useState('')
  const [context, setContext] = useState('')
  const [productCode, setProductCode] = useState('')
  const [scope, setScope] = useState<'SaaS' | 'Solution' | ''>('')
  const [priority, setPriority] = useState<'상' | '중' | '하'>('중')
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['en', 'ja'])
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!sourceText || !scope) {
      showError('필수 항목을 입력해주세요.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/translations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_text: sourceText,
          context,
          product_codes: productCode ? [productCode] : [],
          scope,
          priority,
          languages: selectedLanguages
        })
      })

      if (!response.ok) {
        throw new Error('번역 생성 실패')
      }

      showSuccess('번역이 성공적으로 생성되었습니다!')
      onSuccess()
      onClose()
    } catch (error) {
      showError('오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="새 번역 추가">
      <div className="space-y-4">
        <Input
          label="원문 *"
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          placeholder="번역할 텍스트를 입력하세요"
        />

        <Input
          label="문맥/설명"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="이 텍스트가 사용되는 상황을 설명하세요"
        />

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="제품"
            value={productCode}
            onChange={(e) => setProductCode(e.target.value)}
            options={[
              { value: '', label: '선택 안함' },
              { value: 'MV', label: 'MindVoice' },
              { value: 'MP', label: 'MindPrint' }
            ]}
          />

          <Select
            label="제품 분류 *"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            options={[
              { value: '', label: '선택하세요' },
              { value: 'SaaS', label: 'SaaS' },
              { value: 'Solution', label: 'Solution' }
            ]}
          />
        </div>

        <Select
          label="중요도"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          options={[
            { value: '상', label: '상' },
            { value: '중', label: '중' },
            { value: '하', label: '하' }
          ]}
        />

        <LanguageSelector
          selected={selectedLanguages}
          onChange={setSelectedLanguages}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button onClick={handleSubmit} loading={loading}>
            추가
          </Button>
        </div>
      </div>
    </Modal>
  )
}
```

---

## 📈 1일차 성과와 배운 점

### 완성된 기능
- ✅ Next.js + Supabase 기본 설정
- ✅ 데이터베이스 스키마 설계 및 구현
- ✅ 번역 CRUD API 구현
- ✅ 기본 UI 컴포넌트 라이브러리
- ✅ 번역 생성 폼 완성

### Claude Code와의 협업 경험

**1. 빠른 프로토타이핑**
- 아이디어를 말하면 즉시 코드로 구현
- 보일러플레이트 코드 자동 생성
- 실시간 피드백으로 빠른 반복 개발

**2. 베스트 프랙티스 적용**
- TypeScript 타입 안전성 보장
- Next.js 13+ 최신 패턴 활용
- 접근성과 사용성 고려한 UI

**3. 문제 해결 지원**
- Supabase RLS 정책 설정 도움
- API 엔드포인트 구조화 조언
- 에러 핸들링 개선 제안

### 다음 스토리 예고

Story 2에서는 더 복잡하고 흥미로운 기능들을 구현합니다:
- 📄 PDF/이미지에서 텍스트 추출
- 🤖 AI 기반 자동 번역 제안
- 📊 대량 데이터 처리 시스템
- 🔍 고급 필터링과 검색
- 👥 협업 워크플로우

계속해서 Claude Code와 함께 어떻게 복잡한 기능들을 하나씩 정복해 나갔는지 다음 스토리에서 만나보세요!

---

**Keywords:** Next.js 16, Supabase, TypeScript, 번역 관리 시스템, Claude Code, AI 페어 프로그래밍, 풀스택 개발, React, Tailwind CSS, PostgreSQL, Row Level Security, API Routes, 서버 컴포넌트, App Router, 프로젝트 시작, 기술 스택 선정, 데이터베이스 설계, CRUD 구현

**Total Words:** 2,847 단어
