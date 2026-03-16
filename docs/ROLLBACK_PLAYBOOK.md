# 📋 Rollback Playbook

> 위험 상황 발생 시 신속하고 안전한 롤백 절차

---

## 🚨 롤백 트리거 조건

### Critical (즉시 롤백)
| 조건 | 임계값 | 감지 방법 |
|------|--------|-----------|
| 5xx 에러율 | > 5% | `/api/metrics`, Vercel Logs |
| API 응답 시간 (p99) | > 5초 | Middleware metrics |
| 데이터 손실 의심 | Any | Error logs, DB monitoring |
| 로그인 실패율 | > 10% | Auth metrics |

### Warning (15분 이내 결정)
| 조건 | 임계값 | 감지 방법 |
|------|--------|-----------|
| 4xx 에러율 | > 20% | `/api/metrics` |
| API 응답 시간 (p95) | > 2초 | Middleware metrics |
| 특정 엔드포인트 에러 | > 10% | Error aggregation |

### Info (모니터링 지속)
| 조건 | 임계값 | 감지 방법 |
|------|--------|-----------|
| 메모리 사용량 | > 80% | Vercel Dashboard |
| SQLite 쿼리 시간 | > 100ms | Repository metrics |

---

## ⚡ 롤백 레벨

### Level 1: Feature Flag 롤백 (30초 이내)
**사용 시기:** 특정 기능에만 문제가 있는 경우

```bash
# 1. Admin API로 즉시 비활성화
curl -X POST https://your-app.vercel.app/api/admin/flags \
  -H "x-admin-token: $ADMIN_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ENABLE_PHASE_1": false,
    "ENABLE_PILOT": false
  }'

# 2. 특정 엔드포인트 비활성화
curl -X POST https://your-app.vercel.app/api/admin/flags \
  -H "x-admin-token: $ADMIN_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "DISABLED_ENDPOINTS": "/api/translations,/api/glossary"
  }'
```

**검증:**
```bash
# Flag 상태 확인
curl https://your-app.vercel.app/api/admin/flags \
  -H "x-admin-token: $ADMIN_SECRET_TOKEN"

# Health check
curl https://your-app.vercel.app/api/health
```

### Level 2: 환경변수 롤백 (2분 이내)
**사용 시기:** Provider 수준의 문제, 런타임 Flag가 효과 없는 경우

```bash
# 1. Vercel CLI로 환경변수 변경
vercel env add DATABASE_PROVIDER production supabase --token=$VERCEL_TOKEN
vercel env add FF_ENABLE_API_PROVIDER_MIGRATION production false --token=$VERCEL_TOKEN

# 2. 프로덕션 재배포
vercel --prod --token=$VERCEL_TOKEN

# 3. 또는 Dashboard에서 수동 재배포
# Vercel Dashboard → Deployments → Redeploy
```

**검증:**
```bash
# 배포 상태 확인
vercel --token=$VERCEL_TOKEN

# Provider 타입 확인
curl https://your-app.vercel.app/api/health -v
# 응답 헤더: x-provider-type: supabase
```

### Level 3: 코드 롤백 (5분 이내)
**사용 시기:** Level 1, 2로 해결되지 않는 경우

```bash
# 1. 이전 버전으로 롤백 (Vercel Dashboard)
# Deployments → 이전 stable 버전 → Promote to Production

# 2. 또는 Git으로 롤백
git log --oneline -10  # 최근 커밋 확인
git revert HEAD --no-edit  # 마지막 커밋 되돌리기
git push origin main

# 3. Hotfix 브랜치 생성 (선택사항)
git checkout -b hotfix/rollback-$(date +%Y%m%d)
git revert HEAD
git push origin hotfix/rollback-$(date +%Y%m%d)
# PR 생성 및 머지
```

**검증:**
```bash
# Git 상태 확인
git log --oneline -5

# 배포 완료 확인 (최대 2분 소요)
watch -n 5 'curl -s https://your-app.vercel.app/api/health | jq .'
```

### Level 4: 인프라 롤백 (10분 이내)
**사용 시기:** 데이터베이스 문제, 심각한 데이터 손상

```bash
# 1. SQLite 모드 완전 비활성화
vercel env add DATABASE_PROVIDER production supabase --token=$VERCEL_TOKEN
vercel env remove SQLITE_DB_PATH production --token=$VERCEL_TOKEN --yes

# 2. SQLite 파일 백업 (문제 해결 후 분석용)
# 로컬에 백업이 있다면 보관
cp ./data/app.db ./data/app.db.backup.$(date +%Y%m%d_%H%M%S)

# 3. Supabase로 완전 전환
vercel --prod --token=$VERCEL_TOKEN
```

---

## 📊 롤백 검증 체크리스트

### 즉시 검증 (롤백 후 1분)
- [ ] `/api/health` 정상 응답 (200)
- [ ] `/api/metrics` 메트릭 수집 확인
- [ ] 에러율 5xx < 0.1%
- [ ] API 응답 시간 p99 < 1초

### 단기 검증 (롤백 후 15분)
- [ ] 주요 기능 수동 테스트
  - [ ] 로그인/로그아웃
  - [ ] 번역 조회/생성
  - [ ] 용어집 조회
- [ ] 에러 로그 모니터링 (새로운 에러 없음)
- [ ] 사용자 피드백 채널 확인

### 장기 검증 (롤백 후 1시간)
- [ ] 비즈니스 메트릭 정상
  - [ ] 번역 생성 수
  - [ ] 사용자 활성 세션
  - [ ] API 요청량
- [ ] 성능 메트릭 정상
  - [ ] 평균 응답 시간
  - [ ] 데이터베이스 연결 수

---

## 📝 롤백 후 조치사항

### 1. 사후 분석 (Post-mortem) 작성
```markdown
# Rollback Post-mortem

## 개요
- **일시:** YYYY-MM-DD HH:MM
- **지속 시간:** XX분
- **영향:** 사용자 X명, 기능 Y

## 원인
- 트리거: [에러/성능 이슈/기타]
- 근본 원인: [기술적 원인]

## 롤백 과정
- 시도한 방법: [Level 1, 2, 3]
- 소요 시간: [분]
- 효과: [성공/부분 성공/실패]

## 개선사항
- [ ] 예방 조치
- [ ] 감지 개선
- [ ] 롤백 프로세스 개선
```

### 2. 팀 커뮤니케이션
```
Slack #incidents 채널:

🚨 Incident Report: 롤백 완료

- 시간: XX:XX ~ XX:XX (XX분)
- 원인: [간단한 설명]
- 조치: [수행한 롤백]
- 현재 상태: ✅ 정상 운영 중
- 후속 조치: [사후 분석 링크]
```

### 3. 기술적 개선
- [ ] Issue 생성 및 우선순위 할당
- [ ] 테스트 강화 (해당 시나리오)
- [ ] 모니터링 알림 개선
- [ ] 문서 업데이트

---

## 🎯 롤백 시나리오별 가이드

### 시나리오 1: SQLite 쿼리 에러
**증상:** SQLite 관련 에러 로그 다수, 특정 기능만 오류

**롤백:**
```bash
# Level 1: SQLite 기능 비활성화
curl -X POST /api/admin/flags \
  -d '{"USE_SQLITE_GLOSSARY": false, "USE_SQLITE_TRANSLATION_AUDIT": false}'
```

### 시나리오 2: API 응답 시간 증가
**증상:** p99 지연 시간 > 2초, 사용자 불만

**롤백:**
```bash
# Level 1: Provider 마이그레이션 중단
curl -X POST /api/admin/flags \
  -d '{"ENABLE_API_PROVIDER_MIGRATION": false}'

# 효과 없으면 Level 2
vercel env add DATABASE_PROVIDER production supabase
vercel --prod
```

### 시나리오 3: 데이터 불일치
**증상:** SQLite와 Supabase 간 데이터 차이

**롤백:**
```bash
# Level 4: SQLite 완전 비활성화
vercel env add DATABASE_PROVIDER production supabase
vercel env remove SQLITE_DB_PATH production --yes
vercel --prod

# 데이터 동기화 검증 필요
```

### 시나리오 4: 메모리 누수
**증상:** 서버 메모리 지속 증가, OOM 발생

**롤백:**
```bash
# Level 3: 코드 롤백
# Vercel Dashboard에서 이전 안정 버전으로 Promote
```

---

## 🛡️ 롤백 방지를 위한 예방 조치

### 배포 전 체크리스트
- [ ] Staging 환경에서 모든 테스트 통과
- [ ] Feature Flag 기본값 확인 (false)
- [ ] 롤백 절차 리뷰
- [ ] 온콜 담당자 공유

### 배포 중 모니터링
- [ ] 10% 트래픽 → 5분 대기 → 지표 확인
- [ ] 50% 트래픽 → 10분 대기 → 지표 확인
- [ ] 100% 트래픽 → 30분 밀착 모니터링

### 자동화
```yaml
# .github/workflows/rollback-check.yml
name: Auto Rollback Check

on:
  schedule:
    - cron: '*/5 * * * *'  # 5분마다

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - name: Check Error Rate
        run: |
          ERROR_RATE=$(curl -s /api/metrics | jq '.error_rate_5xx')
          if (( $(echo "$ERROR_RATE > 0.05" | bc -l) )); then
            echo "Error rate too high: $ERROR_RATE"
            # Trigger rollback
            curl -X POST /api/admin/flags \
              -H "x-admin-token: $TOKEN" \
              -d '{"ENABLE_PHASE_1": false}'
          fi
```

---

*작성일: 2026-03-15*
*버전: 1.0*
*긴급 연락: [온콜 담당자 연락처]*
