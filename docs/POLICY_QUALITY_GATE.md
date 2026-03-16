# 🚦 품질 게이트 정책
## Quality Gate Policy for All Deployments

**버전:** 1.0  
**생성일:** 2026-03-15  
**목표:** 배포 전 품질 기준 확립

---

## 🎯 개요

모든 코드는 **4단계 품질 게이트**를 통과해야 배포 가능합니다.

```
[코드 작성] → [로컬 검증] → [PR 리뷰] → [CI 검증] → [스테이징] → [프로덕션]
     │              │              │              │              │
     ▼              ▼              ▼              ▼              ▼
   게이트 0       게이트 1       게이트 2       게이트 3       게이트 4
  (자체검증)    (로컬테스트)    (리뷰통과)    (CI통과)    (수동검증)
```

---

## 🚦 게이트 상세

### 게이트 0: 코드 작성 (자체 검증)
**책임:** 개발자  
**시점:** 커밋 전

```yaml
필수 체크:
  - [ ] TypeScript any 미사용
  - [ ] 에러 핸들링 구현
  - [ ] 로깅 추가
  - [ ] 단위 테스트 작성 (핵심 로직)
  
명령어:
  npm run lint:fix      # 자동 수정
  npm run type-check    # 타입 검증

통과 기준:
  lint: 0 errors, warnings 권장
  type-check: 0 errors
```

---

### 게이트 1: 로컬 검증
**책임:** 개발자  
**시점:** PR 생성 전

```yaml
필수 체크:
  - [ ] 전체 테스트 통과 90%+
  - [ ] 빌드 성공
  - [ ] npm audit (0 critical, 0 high)
  
명령어:
  npm run test
  npm run build
  npm audit

통과 기준:
  test: >= 90% 통과
  build: "Compiled successfully"
  audit: 0 critical, 0 high
```

---

### 게이트 2: PR 리뷰
**책임:** @architect @qa @security  
**시점:** PR 생성 후

```yaml
필수 체크:
  코드 리뷰:
    - [ ] 설계 적절성 (@architect)
    - [ ] 테스트 충분성 (@qa)
    - [ ] 보안 취약점 없음 (@security)
    - [ ] 데이터 정합성 (@data - 해당 시)
    
  자동화 검증:
    - [ ] GitHub Actions 통과
    - [ ] Code Coverage >= 80%
    - [ ] SonarQube (해당 시)

통과 기준:
  승인: 최소 2인 (핵심 변경 시 3인)
  충돌: 0개
```

---

### 게이트 3: CI 검증
**책임:** @devops  
**시점:** main 병합 후

```yaml
필수 체크:
  파이프라인:
    - [ ] Install: 성공
    - [ ] Lint: 통과
    - [ ] Type Check: 통과
    - [ ] Unit Test: 통과
    - [ ] Integration Test: 통과
    - [ ] Build: 성공
    - [ ] Security Scan: 통과
    
통과 기준:
  모든 job: success
  실패 job: 0개 (허용 시 continue-on-error 명시)
```

**GitHub Actions Workflow:**
```yaml
name: Quality Gate
on:
  push:
    branches: [main]

jobs:
  quality-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install
        run: npm ci
        
      - name: Lint
        run: npm run lint
        
      - name: Type Check
        run: npm run type-check
        
      - name: Unit Test
        run: npm run test:unit
        
      - name: Integration Test
        run: npm run test:integration
        continue-on-error: true  # PILOT-TEST-001 완료 전까지
        
      - name: Build
        run: npm run build
        
      - name: Security Scan
        run: npm audit --audit-level=high
```

---

### 게이트 4: 스테이징 검증
**책임:** @qa @devops  
**시점:** 스테이징 배포 후

```yaml
필수 체크:
  기능 검증:
    - [ ] 핵심 기능 수동 테스트
    - [ ] 회귀 테스트
    - [ ] 성능 기준 충족
    
  모니터링:
    - [ ] 에러 로그 확인 (10분)
    - [ ] 응답 시간 체크
    - [ ] 리소스 사용량 정상

통과 기준:
  에러: 0개
  응답 시간: p95 < 500ms
  CPU/메모리: 정상 범위
```

---

## 📊 품질 지표 (Metrics)

### 코드 품질
| 지표 | 최소 | 목표 | 측정 |
|------|------|------|------|
| Test Coverage | 80% | 90% | jest |
| Type Coverage | 95% | 100% | tsc |
| Lint Errors | 0 | 0 | eslint |
| Code Smells | <10 | 0 | SonarQube |

### 성능
| 지표 | 최소 | 목표 | 측정 |
|------|------|------|------|
| API 응답 (p95) | <1s | <500ms | Lighthouse |
| First Contentful Paint | <2s | <1s | Lighthouse |
| Time to Interactive | <3s | <2s | Lighthouse |

### 보안
| 지표 | 최소 | 목표 | 측정 |
|------|------|------|------|
| Critical Vulns | 0 | 0 | npm audit |
| High Vulns | 0 | 0 | npm audit |
| Secrets in Code | 0 | 0 | GitLeaks |

---

## ⚠️ 예외 처리

### 테스트 실패 허용
```
조건:
- PILOT-TEST-XXX 티켓 생성
- 90% 이상 통과
- 실패가 Legacy 코드

절차:
1. PR 설명에 기록
2. @qa 승인
3. CI에서 continue-on-error 설정
```

### 긴급 배포 (Hotfix)
```
조건:
- 프로덕션 장애
- 보안 취약점

절차:
1. 최소 1인 리뷰 (핵심 변경 시 2인)
2. QA 빠른 통과
3. 배포 후 30분 모니터링
4. 사후 검토 (Post-mortem)
```

---

## 🔄 게이트 위반 시

| 위반 | 조치 |
|------|------|
| 게이트 0 실패 | 로컬 수정 후 재시도 |
| 게이트 1 실패 | 브랜치 수정 후 재시도 |
| 게이트 2 실패 | PR 수정, 재리뷰 |
| 게이트 3 실패 | main 롤백, 재작업 |
| 게이트 4 실패 | 스테이징 롤백, 재배포 |

---

## 📈 품질 대시보드

### 주간 리포트
```markdown
## 품질 리포트 - 2026.03 W3

### 게이트 통과율
- 게이트 0: 95%
- 게이트 1: 92%
- 게이트 2: 88%
- 게이트 3: 95%
- 게이트 4: 100%

### 주요 지표
- Test Coverage: 87% (목표 90%)
- Build Success: 98%
- Security: 0 Critical

### 개선 필요
- 통합 테스트 커버리지 PILOT-TEST-001 진행 중
```

---

## 📚 참고 문서
- [POLICY_SOP.md](./POLICY_SOP.md)
- [PILOT_TEST_001.md](./PILOT_TEST_001.md)
- [AGENTS_TEAM.md](./AGENTS_TEAM.md)
