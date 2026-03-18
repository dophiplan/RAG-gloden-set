# 📦 Git 커밋 정책
## Git Commit & Branch Policy

**버전:** 1.0  
**생성일:** 2026-03-15  
**책임자:** @devops

---

## 🌳 브랜치 전략

```
main (배포)
  ↑
feature/* (기능 개발)
  ↑
hotfix/* (긴급 수정)
  ↑
release/* (배포 준비)
```

### 브랜치 네이밍
```
feature/PILOT-123-shadow-mode
bugfix/PILOT-456-null-pointer
hotfix/PROD-789-critical-fix
refactor/user-repository
```

---

## ✍️ 커밋 메시지 규칙

### Conventional Commits

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 타입 (Type)

| 타입 | 설명 | 예시 |
|------|------|------|
| **feat** | 새 기능 | `feat: Add Shadow Mode` |
| **fix** | 버그 수정 | `fix: Resolve type error` |
| **docs** | 문서 | `docs: Update API guide` |
| **style** | 포맷팅 | `style: Fix indentation` |
| **refactor** | 리팩토링 | `refactor: Simplify logic` |
| **test** | 테스트 | `test: Add unit tests` |
| **chore** | 빌드/기타 | `chore: Update dependencies` |
| **perf** | 성능 | `perf: Optimize query` |
| **security** | 보안 | `security: Fix SQL injection` |

### 스코프 (Scope)

```
api: API 엔드포인트
ui: 사용자 인터페이스
db: 데이터베이스
auth: 인증/인가
pilot: Pilot Migration 관련
repo: Repository 레이어
config: 설정 파일
```

### 예시

```
feat(pilot): Add Shadow Mode for user API

- Implement shadowWrite utility
- Add result comparison logic
- Create metrics tracking

Relates to: PILOT-123
```

```
fix(repo): Resolve type error in AuditLogRepository

- Add ValidationResult export
- Update interface definition

Fixes: PILOT-456
```

---

## 🚫 금지 커밋

| 금지 | 이유 | 대안 |
|------|------|------|
| `.` 또는 `update` | 의미 없음 | 구체적인 변경 내용 |
| `WIP` | 작업 중 | 완료 후 커밋 |
| `fix bug` | 어떤 버그? | 버그 설명 포함 |
| `asdf` | 무의미 | 의미 있는 메시지 |
| 대용량 파일 | repo 비대화 | .gitignore 또는 별도 저장소 |

---

## 📝 커밋 단위

### 원칙: 작고 논리적인 단위

**✅ 좋은 예:**
```bash
# 각 변경은 독립적인 커밋
git commit -m "feat(pilot): Add Shadow Mode utility"
git commit -m "test(pilot): Add Shadow Mode tests"
git commit -m "docs(pilot): Add Shadow Mode guide"
```

**❌ 나쁜 예:**
```bash
# 모든 변경을 하나의 커밋
git commit -m "update"
# Shadow Mode + tests + docs + bug fix 한꺼번에
```

---

## 🔍 PR (Pull Request) 규칙

### PR 제목
```
[타입] 간략한 설명

예시:
[PILOT-123] Add Shadow Mode for user API
[FIX] Resolve type error in repository layer
[DOCS] Update migration guide
```

### PR 설명 템플릿
```markdown
## 📋 변경사항
- 변경 내용 요약

## ✅ 체크리스트
- [ ] Type Check: 0 errors
- [ ] Build: 성공
- [ ] Test: 90%+ 통과
- [ ] Security: 0 critical

## 🧪 테스트 방법
1. ...
2. ...

## 📎 관련 티켓
- PILOT-XXX

## 🖼️ 스크린샷 (UI 변경 시)
```

### 리뷰 규칙
```yaml
최소 승인: 2인
필수 리뷰어:
  - @architect (설계)
  - @qa (테스트)
  
선택 리뷰어:
  - @security (보안 관련)
  - @data (데이터 관련)
```

---

## 🔄 마이크로 커밋 가이드

### 1단계: 기능 분해
```
기능: Shadow Mode 구현

분해:
1. 유틸리티 함수 작성
2. 단위 테스트 작성
3. API 적용
4. 문서 작성
```

### 2단계: 순차 커밋
```bash
# 1. 유틸리티
git add src/lib/pilot/shadow-mode.ts
git commit -m "feat(pilot): Add shadowWrite utility function"

# 2. 테스트
git add tests/pilot/shadow-mode.test.ts
git commit -m "test(pilot): Add Shadow Mode unit tests"

# 3. API 적용
git add src/app/api/users/route.ts
git commit -m "feat(api): Apply Shadow Mode to users API"

# 4. 문서
git add docs/PILOT_MIGRATION_GUIDE.md
git commit -m "docs(pilot): Add Shadow Mode documentation"
```

### 3단계: PR 생성
```bash
# main에 머지
gh pr create --title "[PILOT-123] Implement Shadow Mode" \
             --body-file .github/PULL_REQUEST_TEMPLATE.md
```

---

## 🏷️ 태그/릴리즈

### 버전 네이밍 (Semantic Versioning)
```
v{major}.{minor}.{patch}

v1.0.0  # 메이저 릴리즈
v1.1.0  # 기능 추가
v1.1.1  # 버그 수정
```

### 태그 생성
```bash
# 릴리즈 태그
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# Pilot Phase 태그
git tag -a pilot-phase-1-complete -m "Shadow Mode 구현 완료"
```

---

## 📊 커밋 품질 메트릭

### 측정 항목
```yaml
커밋 크기:
  - 변경 파일 수: 1-5개 권장
  - 변경 라인 수: 50-200라인 권장
  
커밋 메시지:
  - 타입 준수율: 100%
  - 50자 이내 제목: 90%+
  
커밋 빈도:
  - 하루 3-5회 권장
  - 큰 변경은 분할
```

---

## 🚨 긴급 수정 (Hotfix)

### 절차
```bash
# 1. main에서 분기
git checkout main
git pull origin main
git checkout -b hotfix/PROD-123-critical-fix

# 2. 최소한의 수정
git commit -m "fix(prod): Resolve critical bug"

# 3. PR 생성 (최소 1인 리뷰)
gh pr create --title "[HOTFIX] PROD-123" --base main

# 4. 머지 후 태그
git tag -a v1.0.1-hotfix -m "Hotfix for PROD-123"
```

---

## 📚 참고 문서
- [Conventional Commits](https://www.conventionalcommits.org/)
- [AGENTS_TEAM.md](./AGENTS_TEAM.md)
- [POLICY_SOP.md](./POLICY_SOP.md)
