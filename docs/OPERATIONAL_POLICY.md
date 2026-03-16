# 운영 및 롤백 정책

> 번역 관리 시스템의 안정적인 운영과 신속한 롤백을 위한 표준 정책

---

## 1. Feature Flag 정책

### Flag 목록 및 용도

| Flag 이름 | 용도 | 기본값 | 위험도 |
|-----------|------|--------|--------|
| `USE_SQLITE_GLOSSARY` | SQLite 용어집 사용 | `false` | 🟢 낮음 |
| `USE_SQLITE_TRANSLATION_AUDIT` | SQLite 번역 감사로그 사용 | `false` | 🟢 낮음 |
| `ENABLE_API_PROVIDER_MIGRATION` | API Provider 마이그레이션 활성화 | `false` | 🟡 중간 |
| `MIGRATED_ENDPOINTS` | 마이그레이션된 엔드포인트 목록 | `[]` | 🟡 중간 |
| `ENABLE_PILOT` | 파일럿 모드 활성화 | `false` | 🟢 낮음 |
| `PILOT_ENDPOINT` | 파일럿 대상 엔드포인트 | `''` | 🟢 낮음 |
| `ENABLE_PHASE_1` | Phase 1: Read-only 엔드포인트 | `false` | 🟡 중간 |
| `ENABLE_PHASE_2` | Phase 2: Low-traffic write | `false` | 🟡 중간 |
| `ENABLE_PHASE_3` | Phase 3: Core business | `false` | 🔴 높음 |
| `ENABLE_PHASE_4` | Phase 4: High-traffic | `false` | 🔴 높음 |
| `DISABLED_ENDPOINTS` | 비상 롤백용 비활성화 엔드포인트 | `[]` | 🔴 높음 |
| `ENABLE_CI_OPTIMIZATIONS` | CI/CD 최적화 활성화 | `false` | 🟢 낮음 |

### 활성화/비활성화 절차

#### 활성화 절차

```bash
# 1. 현재 Flag 상태 확인
curl https://your-app.vercel.app/api/admin/flags \
  -H "x-admin-token: $ADMIN_SECRET_TOKEN"

# 2. 단계별 활성화 (10% → 50% → 100%)
# 2.1. 개발 환경에서 테스트
curl -X POST https://dev.your-app.vercel.app/api/admin/flags \
  -H "x-admin-token: $ADMIN_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ENABLE_PHASE_1": true}'

# 2.2. 스테이징 환경 검증
curl -X POST https://staging.your-app.vercel.app/api/admin/flags \
  -H "x-admin-token: $ADMIN_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ENABLE_PHASE_1": true}'

# 2.3. 프로덕션 환경 점진적 적용
# - 10% 트래픽: 5분 모니터링
# - 50% 트래픽: 10분 모니터링
# - 100% 트래픽: 30분 모니터링
curl -X POST https://your-app.vercel.app/api/admin/flags \
  -H "x-admin-token: $ADMIN_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ENABLE_PHASE_1": true}'

# 3. 활성화 검증 체크리스트
```

**활성화 검증 체크리스트:**
- [ ] `/api/health` 정상 응답 (200)
- [ ] `/api/metrics` 에러율 < 0.1%
- [ ] p99 응답 시간 < 1000ms
- [ ] 주요 기능 수동 테스트 통과
- [ ] 에러 로그에 새로운 오류 없음

#### 비활성화 절차

```bash
# 1. 즉시 비활성화 (런타임)
curl -X POST https://your-app.vercel.app/api/admin/flags \
  -H "x-admin-token: $ADMIN_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ENABLE_PHASE_1": false}'

# 2. 환경변수 업데이트 (영구 적용)
vercel env add FF_ENABLE_PHASE_1 production false --token=$VERCEL_TOKEN

# 3. 특정 엔드포인트만 비활성화 (비상 롤백)
curl -X POST https://your-app.vercel.app/api/admin/flags \
  -H "x-admin-token: $ADMIN_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"DISABLED_ENDPOINTS": "/api/translations,/api/glossary"}'

# 4. 모든 런타임 Flag 초기화
curl -X DELETE https://your-app.vercel.app/api/admin/flags \
  -H "x-admin-token: $ADMIN_SECRET_TOKEN"
```

### 우선순위 규칙

```
우선순위 (높음 → 낮음):
┌─────────────────────────────────────┐
│  1. 환경변수 (process.env.FF_*)     │  ← 최우선
├─────────────────────────────────────┤
│  2. 런타임 설정 (API fetch)         │  ← Admin API로 변경
├─────────────────────────────────────┤
│  3. 코드 기본값                     │  ← fallback
└─────────────────────────────────────┘
```

**우선순위 적용 예시:**
```typescript
// 환경변수가 런타임 설정을 덮어씀
process.env.FF_ENABLE_PHASE_1 = 'true'  // ← 이 값이 최종 적용
runtimeFlags.ENABLE_PHASE_1 = false      // ← 무시됨
defaultFlags.ENABLE_PHASE_1 = false      // ← 무시됨
```

---

## 2. 모니터링 정책

### 체크 항목

#### 2.1. 핵심 메트릭 (Golden Signals)

| 카테고리 | 메트릭 | 수집 방법 | 체크 주기 |
|----------|--------|-----------|-----------|
| **Latency** | `api_latency_ms` | Middleware 자동 수집 | 실시간 |
| | `api_latency_by_provider_ms` | Provider별 태깅 | 실시간 |
| | `db_query_duration_ms` | Repository 수동 기록 | 실시간 |
| **Traffic** | `api_requests_total` | Middleware 자동 수집 | 실시간 |
| | `concurrent_requests` | Gauge | 실시간 |
| **Errors** | `api_error_rate` | 자동 계산 | 실시간 |
| | `db_query_errors_total` | Repository 수동 기록 | 실시간 |
| | `provider_switch_errors_total` | Provider 레이어 | 실시간 |
| **Saturation** | `db_connection_pool_usage` | Connection pool | 30초 |
| | `memory_usage_bytes` | Vercel 제공 | 1분 |

#### 2.2. 비즈니스 메트릭

| 메트릭 | 설명 | Alert Threshold |
|--------|------|-----------------|
| `translations_created_total` | 번역 생성 수 | 하락 시 |
| `translations_updated_total` | 번역 업데이트 수 | 하락 시 |
| `glossary_hits_total` | 용어집 히트 수 | 하락 시 |
| `ai_translation_total` | AI 번역 요청 수 | 급등 시 |
| `user_logins_total` | 로그인 수 | 하락 시 |

#### 2.3. 마이그레이션 특화 메트릭

| 메트릭 | 설명 | 체크 방법 |
|--------|------|-----------|
| `feature_flag_enabled` | 활성화된 Flag 수 | `/api/admin/flags` |
| `migrated_endpoints_total` | 마이그레이션된 엔드포인트 수 | `/api/metrics` |
| `provider_migration_percentage` | 마이그레이션 진행률 | `/api/metrics` |
| `provider_requests_total{provider="sqlite"}` | SQLite 요청 비율 | Prometheus |
| `provider_requests_total{provider="supabase"}` | Supabase 요청 비율 | Prometheus |

### 알림 기준

#### Critical (즉시 대응)

| 조건 | 임계값 | 지속 시간 | 알림 채널 |
|------|--------|-----------|-----------|
| 5xx 에러율 | > 5% | 1분 | PagerDuty + Slack #ops-critical |
| API 응답 시간 (p99) | > 5초 | 2분 | PagerDuty + Slack #ops-critical |
| 데이터 손실 의심 | Any | 즉시 | PagerDuty + 전화 |
| 로그인 실패율 | > 10% | 1분 | Slack #ops-critical |
| Provider 전환 오류 | > 0 | 즉시 | Slack #ops-warning |

#### Warning (15분 이내 대응)

| 조건 | 임계값 | 지속 시간 | 알림 채널 |
|------|--------|-----------|-----------|
| 4xx 에러율 | > 20% | 5분 | Slack #ops-warning |
| API 응답 시간 (p95) | > 2초 | 5분 | Slack #ops-warning |
| DB 쿼리 시간 (p99) | > 100ms | 5분 | Slack #ops-warning |
| 메모리 사용량 | > 80% | 10분 | Slack #ops-info |

#### Info (모니터링 지속)

| 조건 | 임계값 | 알림 채널 |
|------|--------|-----------|
| 마이그레이션 진행률 | 변화 있음 | Slack #dev-updates |
| SQLite 쿼리 시간 | > 50ms | Slack #dev-updates |
| 테스트 커버리지 | < 80% | Slack #dev-updates |

### 대응 절차

#### Critical 알림 대응

```
[0분] 알림 수신
  ↓
[1분] 담당자 확인 (PagerDuty)
  ↓
[2분] 상황 파악 (로그/메트릭 확인)
  ↓
[3분] 롤백 결정 및 실행 (Level 1~4)
  ↓
[5분] 롤백 검증 (헬스체크/메트릭)
  ↓
[10분] 팀 알림 및 사후 분석 시작
```

**상황 파악 명령어:**
```bash
# 1. 헬스체크
curl https://your-app.vercel.app/api/health | jq .

# 2. 메트릭 확인
curl https://your-app.vercel.app/api/metrics | grep -E "error_rate|latency"

# 3. Flag 상태 확인
curl https://your-app.vercel.app/api/admin/flags \
  -H "x-admin-token: $ADMIN_SECRET_TOKEN" | jq .

# 4. Vercel 로그 확인
vercel logs your-app.vercel.app --token=$VERCEL_TOKEN --follow
```

#### Warning 알림 대응

```
[0분] 알림 수신
  ↓
[5분] 원인 파악 (로그 분석)
  ↓
[10분] 대응 방안 결정
  ├─ 자동 복수 예상 → 모니터링 지속
  └─ 악화 조짐 → Level 1 롤백 준비
  ↓
[15분] 조치 실행 또는 상황 공유
```

---

## 3. 롤백 정책

### Level 1: Feature Flag 롤백 (30초)

**사용 시기:**
- 특정 기능에만 문제가 있는 경우
- 특정 엔드포인트에서만 에러 발생
- 신규 Phase rollout 중 문제 발견

**절차:**

```bash
# Step 1: 문제 Flag 즉시 비활성화 (10초)
curl -X POST https://your-app.vercel.app/api/admin/flags \
  -H "x-admin-token: $ADMIN_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ENABLE_PHASE_1": false,
    "ENABLE_PILOT": false,
    "USE_SQLITE_GLOSSARY": false
  }'

# Step 2: 특정 엔드포인트 비활성화 (10초)
curl -X POST https://your-app.vercel.app/api/admin/flags \
  -H "x-admin-token: $ADMIN_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "DISABLED_ENDPOINTS": "/api/translations"
  }'

# Step 3: 롤백 검증 (10초)
curl https://your-app.vercel.app/api/admin/flags \
  -H "x-admin-token: $ADMIN_SECRET_TOKEN"

curl https://your-app.vercel.app/api/health
```

**체크리스트:**
- [ ] Flag 비활성화 확인 (API 응답 확인)
- [ ] `/api/health` 정상 응답 (200)
- [ ] 에러율 5xx < 0.1% (30초 내)
- [ ] p99 응답 시간 < 1초 (30초 내)

### Level 2: 환경변수 롤백 (2분)

**사용 시기:**
- Provider 수준의 문제
- 런타임 Flag가 효과 없는 경우
- SQLite 전체 문제

**절차:**

```bash
# Step 1: 환경변수 변경 (30초)
vercel env add DATABASE_PROVIDER production supabase --token=$VERCEL_TOKEN
vercel env add FF_ENABLE_API_PROVIDER_MIGRATION production false --token=$VERCEL_TOKEN
vercel env add FF_USE_SQLITE_GLOSSARY production false --token=$VERCEL_TOKEN

# Step 2: 프로덕션 재배포 (60초)
vercel --prod --token=$VERCEL_TOKEN

# Step 3: 또는 Dashboard에서 수동 재배포
# Vercel Dashboard → Deployments → Redeploy

# Step 4: 검증 (30초)
vercel --token=$VERCEL_TOKEN  # 배포 상태 확인
curl https://your-app.vercel.app/api/health -v  # x-provider-type: supabase 확인
```

**체크리스트:**
- [ ] 환경변수 업데이트 완료
- [ ] 재배포 완료 (Vercel Dashboard 확인)
- [ ] 응답 헤더 `x-provider-type: supabase` 확인
- [ ] `/api/health` 정상 응답
- [ ] SQLite 관련 에러 로그 감소

### Level 3: 코드 롤백 (5분)

**사용 시기:**
- Level 1, 2로 해결되지 않는 경우
- 코드 수준의 버그
- 메모리 누수 등

**절차:**

```bash
# 방법 1: Vercel Dashboard에서 롤백 (추천)
# Vercel Dashboard → Deployments → 이전 stable 버전 → Promote to Production
# (2분 소요)

# 방법 2: Git revert (로컬)
# Step 1: 최근 커밋 확인
git log --oneline -10

# Step 2: 마지막 커밋 되돌리기
git revert HEAD --no-edit
git push origin main
# (3분 소요 - CI/CD 실행)

# 방법 3: Hotfix 브랜치
git checkout -b hotfix/rollback-$(date +%Y%m%d)
git revert HEAD
git push origin hotfix/rollback-$(date +%Y%m%d)
# PR 생성 및 머지 (5분 소요)
```

**검증:**
```bash
# Git 상태 확인
git log --oneline -5

# 배포 완료 확인
watch -n 5 'curl -s https://your-app.vercel.app/api/health | jq .'
```

**체크리스트:**
- [ ] 이전 버전으로 롤백 완료
- [ ] 배포 완료 확인 (Vercel)
- [ ] `/api/health` 정상 응답
- [ ] 에러율 정상화
- [ ] 주요 기능 수동 테스트 통과

### Level 4: 인프라 롤백 (10분)

**사용 시기:**
- 데이터베이스 문제
- 심각한 데이터 손상
- SQLite 파일 손상

**절차:**

```bash
# Step 1: SQLite 모드 완전 비활성화 (30초)
vercel env add DATABASE_PROVIDER production supabase --token=$VERCEL_TOKEN
vercel env remove SQLITE_DB_PATH production --token=$VERCEL_TOKEN --yes

# Step 2: 모든 SQLite Flag 비활성화 (30초)
vercel env add FF_USE_SQLITE_GLOSSARY production false --token=$VERCEL_TOKEN
vercel env add FF_USE_SQLITE_TRANSLATION_AUDIT production false --token=$VERCEL_TOKEN
vercel env add FF_ENABLE_API_PROVIDER_MIGRATION production false --token=$VERCEL_TOKEN

# Step 3: SQLite 파일 백업 (로컬에 있다면)
cp ./data/app.db ./data/app.db.backup.$(date +%Y%m%d_%H%M%S)

# Step 4: Supabase로 완전 전환 (60초)
vercel --prod --token=$VERCEL_TOKEN

# Step 5: 데이터 동기화 검증 (7분)
# - Supabase 데이터 정합성 확인
# - 주요 레코드 수 확인
# - 무결성 검증
```

**데이터 동기화 검증 명령어:**
```bash
# Supabase에서 데이터 확인
psql $SUPABASE_DB_URL -c "SELECT COUNT(*) FROM translations;"
psql $SUPABASE_DB_URL -c "SELECT COUNT(*) FROM glossary;"

# 로컬 SQLite와 비교 (백업된 파일)
sqlite3 ./data/app.db.backup.$(date +%Y%m%d_%H%M%S) "SELECT COUNT(*) FROM translations;"
```

**체크리스트:**
- [ ] SQLite 환경변수 모두 제거
- [ ] DATABASE_PROVIDER=supabase 설정 확인
- [ ] 배포 완료
- [ ] Supabase 연결 확인
- [ ] 데이터 정합성 검증 완료
- [ ] 주요 테이블 레코드 수 확인
- [ ] 무결성 제약조건 확인

---

## 4. 비상 연락망

### 담당자

| 역할 | 이름 | 연락처 | 비고 |
|------|------|--------|------|
| **온콜 엔지니어** | [담당자 1] | [전화번호] | 24/7 |
| **백업 온콜** | [담당자 2] | [전화번호] | 24/7 |
| **Tech Lead** | [담당자 3] | [전화번호] | 업무시간 |
| **Product Owner** | [담당자 4] | [전화번호] | 업무시간 |
| **DBA** | [담당자 5] | [전화번호] | Level 4 롤백 시 |

### 에스컬레이션

```
Level 1 (0-5분): 온콜 엔지니어
  ↓ 미해결
Level 2 (5-15분): 백업 온콜 + Tech Lead
  ↓ 미해결
Level 3 (15-30분): 전체 개발팀 + Product Owner
  ↓ 미해결
Level 4 (30분+): 임원 + 외부 지원
```

**에스컬레이션 조건:**

| 레벨 | 조건 | 조치 |
|------|------|------|
| Level 1 | Critical 알림 발생 | 온콜이 롤백 수행 |
| Level 2 | 5분 내 미해결 또는 Level 1 실패 | 백업 온콜 투입 |
| Level 3 | 15분 내 미해결 또는 데이터 손상 | 전체 투입, 외부 지원 고려 |
| Level 4 | 30분 내 미해결 또는 서비스 중단 | 임원 보고, 재난 대응 모드 |

**연락처 템플릿:**

```
[CRITICAL] 번역관리시스템 롤백 필요

- 시간: [YYYY-MM-DD HH:MM]
- 증상: [에러율 상승/응답시간 지연/데이터 문제]
- 영향: [사용자 X명, 기능 Y]
- 시도: [Level X 롤백 진행 중/완료]
- 필요: [추가 지원/DBA/임원 결정]
```

---

## 5. 복구 절차

### 데이터 불일치 복구

#### 5.1. SQLite → Supabase 동기화

**상황:** SQLite 사용 중 데이터가 Supabase와 불일치

```bash
# Step 1: 불일치 범위 파악
psql $SUPABASE_DB_URL -c "SELECT MAX(updated_at) FROM translations;"
sqlite3 ./data/app.db "SELECT MAX(updated_at) FROM translations;"

# Step 2: 차이 분석 스크립트 실행
node scripts/compare_databases.js \
  --sqlite ./data/app.db \
  --supabase $SUPABASE_DB_URL \
  --output diff_report.json

# Step 3: 동기화 방식 결정
# 방법 A: SQLite 데이터를 Supabase로 마이그레이션
node scripts/sync_to_supabase.js \
  --since "2026-03-15T10:00:00Z" \
  --dry-run

# 방법 B: Supabase를 기준으로 SQLite 재동기화 (권장)
node scripts/sync_from_supabase.js \
  --sqlite ./data/app.db \
  --reset

# Step 4: 동기화 실행 (dry-run 확인 후)
node scripts/sync_to_supabase.js \
  --since "2026-03-15T10:00:00Z" \
  --execute
```

**체크리스트:**
- [ ] 불일치 범위 확인 (시간대)
- [ ] 차이 레코드 수량 파악
- [ ] 동기화 방식 결정 (A 또는 B)
- [ ] Dry-run 실행 및 검증
- [ ] 실제 동기화 실행
- [ ] 동기화 결과 검증

#### 5.2. 데이터 손상 복구

**상황:** SQLite 파일 손상 또는 데이터 유실

```bash
# Step 1: 손상 확인
sqlite3 ./data/app.db "PRAGMA integrity_check;"

# Step 2: 백업에서 복구
# 가장 최근 정상 백업 찾기
ls -la ./data/app.db.backup.* | tail -5

# 백업 복원
cp ./data/app.db.backup.20260315_120000 ./data/app.db

# Step 3: Supabase에서 누락 데이터 복원
node scripts/sync_from_supabase.js \
  --sqlite ./data/app.db \
  --since "2026-03-15T12:00:00Z"

# Step 4: 복구 검증
sqlite3 ./data/app.db "PRAGMA integrity_check;"
sqlite3 ./data/app.db "SELECT COUNT(*) FROM translations;"
```

### Provider 동기화

#### 6.1. Provider 전환 후 검증

```bash
# Step 1: 현재 Provider 확인
curl https://your-app.vercel.app/api/health -v  # x-provider-type 헤더 확인

# Step 2: Provider별 메트릭 비교
# Prometheus 쿼리
# rate(api_requests_by_provider_total[5m])

# Step 3: 기능별 테스트
curl https://your-app.vercel.app/api/translations | jq '.data | length'
curl https://your-app.vercel.app/api/glossary | jq '.data | length'

# Step 4: 동시성 테스트
./scripts/load_test.sh \
  --endpoint /api/translations \
  --concurrency 10 \
  --requests 100
```

#### 6.2. Dual-write 모드 동기화

**상황:** SQLite와 Supabase 동시 사용 중 데이터 동기화

```typescript
// src/lib/database/dual_write_sync.ts

// 1. 양쪽 Provider에서 데이터 조회
const sqliteData = await sqliteRepo.findAll();
const supabaseData = await supabaseRepo.findAll();

// 2. 차이 분석
const diff = compareData(sqliteData, supabaseData);

// 3. 누락 데이터 동기화
for (const item of diff.missingInSupabase) {
  await supabaseRepo.create(item);
}

for (const item of diff.missingInSQLite) {
  await sqliteRepo.create(item);
}

// 4. 충돌 해결 (timestamp 기준)
for (const conflict of diff.conflicts) {
  const winner = conflict.sqlite.updatedAt > conflict.supabase.updatedAt 
    ? conflict.sqlite 
    : conflict.supabase;
  await resolveConflict(winner);
}
```

**실행 명령어:**
```bash
# 동기화 스크립트 실행
node scripts/dual_write_sync.js \
  --check-only  # 먼저 차이만 확인

node scripts/dual_write_sync.js \
  --execute \
  --conflict-strategy timestamp  # timestamp 기준 충돌 해결
```

**체크리스트:**
- [ ] 양쪽 Provider 연결 확인
- [ ] 차이 레코드 목록 생성
- [ ] 충돌 해결 전략 결정 (timestamp/수동)
- [ ] Dry-run 실행
- [ ] 실제 동기화 실행
- [ ] 동기화 결과 검증
- [ ] 양쪽 데이터 수 일치 확인

---

## 부록: 빠른 참조 카드

### 롤백 결정 트리

```
문제 발생!
    │
    ├─ 특정 기능만 문제? ──→ Level 1: Feature Flag 롤백 (30초)
    │
    ├─ Provider 문제? ────→ Level 2: 환경변수 롤백 (2분)
    │
    ├─ 코드 버그? ────────→ Level 3: 코드 롤백 (5분)
    │
    └─ 데이터 손상? ──────→ Level 4: 인프라 롤백 (10분)
```

### 긴급 명령어 모음

```bash
# 헬스체크
curl https://your-app.vercel.app/api/health | jq .

# 메트릭 확인
curl https://your-app.vercel.app/api/metrics

# Flag 확인
curl -H "x-admin-token: $ADMIN_SECRET_TOKEN" \
  https://your-app.vercel.app/api/admin/flags

# Level 1 롤백
curl -X POST -H "x-admin-token: $ADMIN_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ENABLE_PHASE_1": false}' \
  https://your-app.vercel.app/api/admin/flags

# Level 2 롤백
vercel env add DATABASE_PROVIDER production supabase --token=$VERCEL_TOKEN
vercel --prod --token=$VERCEL_TOKEN

# 로그 확인
vercel logs your-app.vercel.app --token=$VERCEL_TOKEN
```

---

*작성일: 2026-03-15*  
*버전: 1.0*  
*담당: Policy Agent*
