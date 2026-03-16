# 🛡️ Safe Roll-out Execution Plan

> **Zero-downtime**, **Rollback 가능**, **점진적 적용**을 보장하는 실행 계획

---

## 📊 위험 평가 매트릭스

| 작업 | 복잡도 | 위험도 | 롤백 난이도 | 권장 순서 | 예상 기간 |
|------|--------|--------|-------------|-----------|-----------|
| **1. SQLite 구현체 완성** (Glossary, TranslationAudits) | 🟡 중간 | 🟢 낮음 | 🟢 쉬움 | **1순위** | 3일 |
| **2. Provider 마이그레이션 기반 작업** | 🟡 중간 | 🟡 중간 | 🟡 보통 | **2순위** | 2일 |
| **3. API Route 점진적 전환** - 단일 엔드포인트 | 🟡 중간 | 🟡 중간 | 🟢 쉬움 | **3순위** | 3일 |
| **4. API Route 확대 적용** | 🟡 중간 | 🟡 중간 | 🟡 보통 | **4순위** | 5일 |
| **5. CI/CD 개선** (GitHub Actions 최적화) | 🟢 낮음 | 🟢 낮음 | 🟢 쉬움 | **5순위** | 2일 |
| **6. 성능 벤치마크** | 🟡 중간 | 🟢 낮음 | 🟢 쉬움 | **6순위** | 2일 |

**범례:**
- 복잡도: 🟢 낮음 (1-2일) / 🟡 중간 (3-5일) / 🔴 높음 (1주+)
- 위험도: 🟢 낮음 (기존 기능 영향 없음) / 🟡 중간 (일부 기능 영향 가능) / 🔴 높음 (전체 기능 영향)
- 롤백 난이도: 🟢 쉬움 (환경변수 변경) / 🟡 보통 (코드 롤백) / 🔴 어려움 (DB 롤백 필요)

---

## 🎯 1주차 스프린트: 기반 강화 (SQLite 완성)

### 목표
- SQLite Glossary Repository 구현
- SQLite TranslationAudit Repository 구현
- Provider 테스트 커버리지 80% 달성

### Feature Flag 전략
```typescript
// src/lib/config/feature_flags.ts
export const FeatureFlags = {
  // SQLite Glossary 사용 여부
  USE_SQLITE_GLOSSARY: process.env.FF_USE_SQLITE_GLOSSARY === 'true',
  
  // SQLite TranslationAudit 사용 여부
  USE_SQLITE_TRANSLATION_AUDIT: process.env.FF_USE_SQLITE_TRANSLATION_AUDIT === 'true',
  
  // Provider 전환 비율 (0-100)
  PROVIDER_ROLLOUT_PERCENTAGE: parseInt(process.env.FF_PROVIDER_ROLLOUT || '0'),
};
```

### 단계별 롤백 지점

| 단계 | 작업 내용 | 롤백 방법 | 검증 지표 |
|------|-----------|-----------|-----------|
| **Day 1** | Glossary Interface 분석 및 스키마 설계 | Git revert | Type check pass |
| **Day 2** | SqliteGlossaryRepository 구현 + 단위 테스트 | `FF_USE_SQLITE_GLOSSARY=false` | Unit test 100% pass |
| **Day 3** | TranslationAudit Repository 구현 + 통합 테스트 | `FF_USE_SQLITE_TRANSLATION_AUDIT=false` | Integration test pass |
| **Day 4** | Placeholder 교체 및 Provider 통합 테스트 | Provider type rollback | API equality test pass |
| **Day 5** | 코드 리뷰, 문서화, 모니터링 설정 | - | Coverage ≥ 80% |

### 모니터링 지표
```yaml
# 모니터링 대상
metrics:
  - sqlite_glossary_query_duration_ms  # SQLite Glossary 쿼리 시간
  - sqlite_glossary_error_rate         # SQLite Glossary 에러율
  - provider_initialization_time_ms    # Provider 초기화 시간
  - test_coverage_percentage           # 테스트 커버리지

alerts:
  - test_failure_rate > 0%             # 테스트 실패 시 즉시 알림
  - coverage < 80%                     # 커버리지 하락 시 알림
```

---

## 🎯 2주차 스프린트: Provider 마이그레이션 기반 작업

### 목표
- API Route에서 Provider 패턴 사용을 위한 기반 구축
- 기존 Repository 사용 코드를 Provider로 대체하는 어댑터 구현

### Feature Flag 전략
```typescript
// src/lib/config/feature_flags.ts (확장)
export const FeatureFlags = {
  // ... 기존 플래그
  
  // API Route Provider 마이그레이션 활성화
  ENABLE_API_PROVIDER_MIGRATION: process.env.FF_ENABLE_API_PROVIDER_MIGRATION === 'true',
  
  // 마이그레이션 대상 엔드포인트 (쉼표로 구분)
  MIGRATED_ENDPOINTS: process.env.FF_MIGRATED_ENDPOINTS?.split(',') || [],
};
```

### 단계별 롤백 지점

| 단계 | 작업 내용 | 롤백 방법 | 검증 지표 |
|------|-----------|-----------|-----------|
| **Day 1-2** | API Route Helper 함수 구현 (Provider 기반) | Git revert | Helper unit test pass |

### API Route Helper 구현
```typescript
// src/lib/api/provider-helpers.ts
import { getDatabaseProvider, DatabaseProvider } from '@/lib/database/provider';
import { createClient } from '@/lib/supabase/server';

/**
 * API Route용 Provider 가져오기
 * Feature Flag에 따라 Supabase 또는 SQLite Provider 반환
 */
export async function getApiProvider(): Promise<DatabaseProvider> {
  const supabase = await createClient();
  
  // 환경변수 기반 Provider 선택
  const providerType = process.env.DATABASE_PROVIDER || 'supabase';
  
  return initializeDatabaseProvider({
    type: providerType as DatabaseProviderType,
    supabase,
  });
}

/**
 * Feature Flag 기반 Provider 선택
 */
export async function getProviderForEndpoint(endpoint: string): Promise<DatabaseProvider> {
  const migratedEndpoints = FeatureFlags.MIGRATED_ENDPOINTS;
  
  // 마이그레이션된 엔드포인트는 새 Provider 사용
  if (FeatureFlags.ENABLE_API_PROVIDER_MIGRATION && 
      migratedEndpoints.includes(endpoint)) {
    return getApiProvider();
  }
  
  // 그 외는 기존 Supabase Client 사용
  const supabase = await createClient();
  return initializeDatabaseProvider({ type: 'supabase', supabase });
}
```

---

## 🎯 3주차 스프린트: API Route 점진적 전환 (파일럿)

### 목표
- **1개의 단순한 API Route**를 Provider 패턴으로 전환
- `/api/health` 또는 `/api/platforms` (GET only, low risk)

### 선택 이유
| 엔드포인트 | 복잡도 | 위험도 | 선택 이유 |
|-----------|--------|--------|-----------|
| `/api/health` | 🟢 낮음 | 🟢 낮음 | Read-only, 사용자 영향 없음 |
| `/api/platforms` | 🟢 낮음 | 🟢 낮음 | Read-only, 데이터 변경 없음 |

### Feature Flag 전략
```typescript
// 특정 엔드포인트에 대해서만 새로운 Provider 사용
export const FeatureFlags = {
  // ... 기존 플래그
  
  // 파일럿 엔드포인트
  PILOT_ENDPOINT: process.env.FF_PILOT_ENDPOINT || '',
  
  // 파일럿 활성화 여부
  ENABLE_PILOT: process.env.FF_ENABLE_PILOT === 'true',
};
```

### 단계별 롤백 지점

| 단계 | 작업 내용 | 롤백 방법 | 검증 지표 |
|------|-----------|-----------|-----------|
| **Day 1** | 파일럿 엔드포인트 선정 및 분석 | - | 문서화 완료 |
| **Day 2** | Provider 기반 구현 (기존 코드 유지) | Feature flag off | 단위 테스트 pass |
| **Day 3** | 통합 테스트 및 스테이징 배포 | Vercel rollback | Health check pass |

### 구현 패턴
```typescript
// src/app/api/health/route.ts
import { NextResponse } from 'next/server';
import { getApiProvider, FeatureFlags } from '@/lib/api/provider-helpers';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    // Feature Flag에 따라 Provider 선택
    if (FeatureFlags.ENABLE_PILOT && FeatureFlags.PILOT_ENDPOINT === '/api/health') {
      // 새로운 Provider 패턴 사용
      const provider = await getApiProvider();
      const healthStatus = await checkHealthWithProvider(provider);
      return NextResponse.json(healthStatus);
    }
    
    // 기존 방식 유지
    const supabase = await createClient();
    const healthStatus = await checkHealthLegacy(supabase);
    return NextResponse.json(healthStatus);
  } catch (error) {
    return NextResponse.json(
      { status: 'unhealthy', error: error.message },
      { status: 500 }
    );
  }
}
```

---

## 🎯 4주차 스프린트: API Route 확대 적용

### 목표
- 파일럿 검증 후 추가 엔드포인트 전환
- 우선순위: Read-only → Write operations (low traffic → high traffic)

### 전환 우선순위
```
Phase 1: Read-only endpoints (Week 4)
  ├─ /api/platforms/* (GET)
  ├─ /api/products/* (GET)
  └─ /api/holidays (GET)

Phase 2: Low-traffic write endpoints (Week 5)
  ├─ /api/settings/* 
  └─ /api/organization/*

Phase 3: Core business endpoints (Week 6)
  ├─ /api/translations/* (GET first)
  ├─ /api/glossary/* (GET first)
  └─ /api/bulk/* (low traffic hours)

Phase 4: High-traffic endpoints (Week 7)
  └─ /api/translations/* (POST/PUT/DELETE)
```

### Feature Flag: 단계별 롤아웃
```typescript
export const FeatureFlags = {
  // ... 기존 플래그
  
  // Phase별 활성화
  ENABLE_PHASE_1: process.env.FF_ENABLE_PHASE_1 === 'true',
  ENABLE_PHASE_2: process.env.FF_ENABLE_PHASE_2 === 'true',
  ENABLE_PHASE_3: process.env.FF_ENABLE_PHASE_3 === 'true',
  ENABLE_PHASE_4: process.env.FF_ENABLE_PHASE_4 === 'true',
  
  // 특정 엔드포인트 비활성화 (긴급 롤백용)
  DISABLED_ENDPOINTS: process.env.FF_DISABLED_ENDPOINTS?.split(',') || [],
};
```

### 롤백 전략

#### 1. 환경변수 기반 즉시 롤백 (30초 이내)
```bash
# Vercel Dashboard 또는 CLI에서 즉시 적용
vercel env add FF_ENABLE_PHASE_1 production false
vercel --prod
```

#### 2. 코드 롤백 (5분 이내)
```bash
# 이전 커밋으로 롤백
git revert HEAD
gh pr create --title "Hotfix: Rollback Phase 1" --body "Issue detected"
```

#### 3. 데이터베이스 롤백 (비상시)
```typescript
// Placeholder 복구
DATABASE_PROVIDER=supabase  # SQLite에서 Supabase로 전환
```

---

## 🎯 5주차 스프린트: CI/CD 개선

### 목표
- GitHub Actions 실행 시간 최적화
- 캐싱 전략 개선
- 병렬 테스트 최적화

### 개선 항목

| 항목 | 현재 | 목표 | 개선 방법 |
|------|------|------|-----------|
| Unit Test | ~30초 | ~15초 | Mock 개선, 병렬 실행 |
| Integration Test | ~2분 | ~1분 | SQLite 메모리 최적화 |
| Build | ~3분 | ~2분 | Next.js 캐싱 개선 |
| Total CI | ~8분 | ~4분 | Job 병렬화 |

### Feature Flag
```typescript
export const FeatureFlags = {
  // CI/CD 개선 적용
  ENABLE_CI_OPTIMIZATIONS: process.env.FF_ENABLE_CI_OPTIMIZATIONS === 'true',
  
  // 새로운 테스트 러너 사용
  USE_VITEST_POOL: process.env.FF_USE_VITEST_POOL === 'true',
};
```

---

## 🎯 6주차 스프린트: 성능 벤치마크

### 목표
- Supabase vs SQLite 성능 비교
- API 응답 시간 측정
- 부하 테스트

### 벤치마크 항목
```typescript
// tests/benchmark/performance.bench.ts
interface BenchmarkSuite {
  // Repository 레벨 벤치마크
  repository: {
    'user.findById': () => Promise<void>;
    'translation.findMany': () => Promise<void>;
    'glossary.search': () => Promise<void>;
  };
  
  // API 레벨 벤치마크
  api: {
    'GET /api/health': () => Promise<void>;
    'GET /api/translations': () => Promise<void>;
    'POST /api/translations': () => Promise<void>;
  };
}
```

### 성능 기준
| 메트릭 | Supabase | SQLite (목표) | 허용 오차 |
|--------|----------|---------------|-----------|
| 평균 응답 시간 | 50ms | 10ms | ±20% |
| p99 응답 시간 | 200ms | 50ms | ±30% |
| 에러율 | <0.1% | <0.1% | ±0.05% |
| 동시 요청 처리 | 100/s | 1000/s | - |

---

## 🚨 모니터링 및 알림 설정

### 핵심 메트릭
```yaml
# /api/metrics에 노출될 메트릭

critical_metrics:
  # 가용성
  - name: api_availability_percentage
    threshold: "> 99.9%"
    alert: pagerduty
    
  # 오류율
  - name: api_error_rate_5xx
    threshold: "< 0.1%"
    alert: slack_critical
    
  # 지연 시간
  - name: api_p99_latency_ms
    threshold: "< 500ms"
    alert: slack_warning
    
  # Provider 전환 상태
  - name: provider_migration_percentage
    threshold: "progress tracking"
    alert: slack_info

warning_metrics:
  - name: sqlite_query_duration_p99
  - name: supabase_query_duration_p99
  - name: test_coverage_trend
```

### 알림 채널
```typescript
// 알림 심각도별 채널
const AlertChannels = {
  critical: ['pagerduty', 'slack-ops', 'email-oncall'],
  warning: ['slack-ops'],
  info: ['slack-dev'],
};
```

---

## 📋 실행 체크리스트

### Pre-flight Checklist (각 스프린트 시작 전)
- [ ] 이전 스프린트 모든 테스트 통과 확인
- [ ] Staging 환경 배포 완료
- [ ] Feature Flag 설정 완료
- [ ] 롤백 절차 문서 확인
- [ ] 모니터링 대시보드 확인
- [ ] 온콜 엔지니어 알림

### Deployment Checklist (배포 시)
- [ ] Blue-Green 배포 준비
- [ ] 데이터베이스 백업 확인
- [ ] Feature Flag 점진적 활성화 (10% → 50% → 100%)
- [ ] 메트릭 모니터링 (30분)
- [ ] 에러 로그 확인
- [ ] 사용자 피드백 채널 모니터링

### Post-deployment Checklist (배포 후)
- [ ] 1시간: 핵심 메트릭 확인
- [ ] 24시간: 성능 추이 확인
- [ ] 1주일: 안정성 평가
- [ ] 문서 업데이트
- [ ] 회고 및 개선점 도출

---

## 🔐 보안 및 안전 고려사항

### 데이터 보호
```typescript
// SQLite 데이터베이스 암호화 (선택적)
const ENCRYPTED_SQLITE = process.env.SQLITE_ENCRYPTION_KEY;

// 민감한 데이터 마스킹
function maskSensitiveData(data: any): any {
  return {
    ...data,
    email: data.email?.replace(/(?<=.).(?=.*@)/g, '*'),
    apiKey: data.apiKey ? '***' : undefined,
  };
}
```

### 접근 제어
- SQLite DB 파일: 600 권한 (owner only)
- 마이그레이션 스크립트: CI/CD 전용 서비스 계정
- Feature Flag 변경: 관리자 권한 필요

---

## 📝 문서 및 커뮤니케이션

### 스프린트별 산출물
| 스프린트 | 산출물 | 담당자 |
|----------|--------|--------|
| 1주차 | SQLite 구현체 PR | 개발자 |
| 2주차 | API Helper PR | 개발자 |
| 3주차 | 파일럿 전환 문서 | 개발자 |
| 4주차 | 확대 적용 보고서 | 개발자 |
| 5주차 | CI/CD 최적화 보고서 | 개발자 |
| 6주차 | 성능 벤치마크 리포트 | 개발자 |

### 커뮤니케이션 계획
```yaml
weekly_standup:
  - 진행 상황 공유
  - 차단 요소 논의
  - 다음 주 계획 수립

daily_check:
  - 배포 현황 확인
  - 메트릭 리뷰
  - 이슈 대응
```

---

*작성일: 2026-03-15*
*버전: 1.0*
*담당: Lead Architect Agent*
