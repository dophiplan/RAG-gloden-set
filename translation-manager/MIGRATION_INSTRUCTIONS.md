# 데이터베이스 마이그레이션 실행 방법

## Supabase Dashboard에서 SQL 실행하기

### 1단계: Supabase Dashboard 접속
1. https://supabase.com 에 로그인
2. 프로젝트 선택 (translation-manager)
3. 왼쪽 메뉴에서 **"SQL Editor"** 클릭

### 2단계: Migration 035 실행

**"New Query"** 버튼을 클릭하고 아래 SQL을 복사해서 붙여넣기:

```sql
-- Migration 035: Translation Source Tracking
-- 번역 출처 추적 (DB 검색 vs AI 번역)

ALTER TABLE translation_results
ADD COLUMN IF NOT EXISTS source_type TEXT CHECK (source_type IN ('glossary', 'ai', 'manual', 'imported')),
ADD COLUMN IF NOT EXISTS glossary_term_id UUID REFERENCES glossary(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_translation_results_source_type ON translation_results(source_type);
CREATE INDEX IF NOT EXISTS idx_translation_results_glossary_term_id ON translation_results(glossary_term_id);

COMMENT ON COLUMN translation_results.source_type IS 'Translation source: glossary (DB match), ai (new AI translation), manual (user edited), imported (bulk import)';
COMMENT ON COLUMN translation_results.glossary_term_id IS 'Reference to glossary term if source_type=glossary';
```

우측 하단의 **"Run"** 버튼 클릭 ✅

### 3단계: Migration 036 실행

**"New Query"** 버튼을 다시 클릭하고 아래 SQL을 붙여넣기:

```sql
-- Migration 036: Glossary Approval Workflow
-- AI가 추가한 용어집 검수 기능

ALTER TABLE glossary
ADD COLUMN IF NOT EXISTS approval_status TEXT CHECK (approval_status IN ('pending', 'approved', 'rejected')) DEFAULT 'approved',
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_glossary_approval_status ON glossary(approval_status);

-- 기존 데이터 처리: 수동/엑셀 import는 자동 승인
UPDATE glossary
SET approval_status = 'approved'
WHERE source_type IN ('manual', 'excel_import')
AND approval_status IS NULL;

-- AI가 추가한 용어는 검수 대기 상태로
UPDATE glossary
SET approval_status = 'pending'
WHERE source_type = 'ai_generated'
AND approval_status IS NULL;

COMMENT ON COLUMN glossary.approval_status IS 'Approval status: pending (awaiting review), approved (ready to use), rejected';
COMMENT ON COLUMN glossary.approved_by IS 'User who approved/rejected this term';
COMMENT ON COLUMN glossary.approved_at IS 'Timestamp of approval/rejection';
```

우측 하단의 **"Run"** 버튼 클릭 ✅

### 4단계: 마이그레이션 확인

마지막으로 확인 쿼리 실행:

```sql
-- translation_results 테이블 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'translation_results'
AND column_name IN ('source_type', 'glossary_term_id');

-- glossary 테이블 확인
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'glossary'
AND column_name IN ('approval_status', 'approved_by', 'approved_at');
```

**예상 결과:**
- translation_results: `source_type`, `glossary_term_id` 열이 표시되어야 함
- glossary: `approval_status`, `approved_by`, `approved_at` 열이 표시되어야 함

---

## 마이그레이션 완료 후

마이그레이션이 성공하면:

1. ✅ 번역 출처 추적 기능 활성화
   - DB 검색 결과 vs AI 신규 번역 구분
   - 💾 [DB 검색 결과] / 🤖 [신규 AI 번역] 배지 표시

2. ✅ 용어집 검수 워크플로우 활성화
   - AI 추가 용어는 "검수 대기" 상태
   - "⚠️ 승인 대기 항목" 필터로 빠른 확인
   - 승인 후에만 번역에 사용

3. ✅ 통계 대시보드 표시
   - 비용 절감액 계산
   - 재사용 횟수 추적
   - 언어별 사용 통계

**개발 서버 재시작:**
```bash
npm run dev
```

**페이지 확인:**
- http://localhost:3000/glossary - 통계 카드 및 검수 기능 확인
- http://localhost:3000 - 번역 생성 후 출처 배지 확인

---

## 문제 해결

### "relation already exists" 에러가 나면?
→ 이미 실행된 마이그레이션입니다. `IF NOT EXISTS` 절 덕분에 안전하게 스킵됩니다.

### "check constraint" 에러가 나면?
→ 이미 해당 제약 조건이 존재합니다. 무시하고 다음 단계 진행하세요.

### 마이그레이션을 되돌리고 싶다면?
```sql
-- 주의: 데이터가 삭제될 수 있습니다!
ALTER TABLE translation_results
DROP COLUMN IF EXISTS source_type,
DROP COLUMN IF EXISTS glossary_term_id;

ALTER TABLE glossary
DROP COLUMN IF EXISTS approval_status,
DROP COLUMN IF EXISTS approved_by,
DROP COLUMN IF EXISTS approved_at;
```
