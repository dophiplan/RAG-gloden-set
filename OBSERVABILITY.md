# Observability System

번역 관리 시스템을 위한 통합 Observability 시스템입니다.

## 주요 기능

### 1. 구조화된 로깅 (`src/lib/observability/logger.ts`)

- **개발 환경**: 콘솔 pretty print (색상, 포맷팅)
- **프로덕션**: JSON 형식 (Vercel Logs, Datadog 등 연동)
- **요청 추적**: AsyncLocalStorage 기반 컨텍스트 전파
- **로그 레벨**: debug, info, warn, error

```typescript
import { logger, getContextLogger } from '@/lib/observability';

// 기본 사용
logger.info('Operation completed', { userId: '123' });
logger.error('Operation failed', error, { userId: '123' });

// 컨텍스트 로거
const serviceLogger = getContextLogger('TranslationService');
serviceLogger.info('Translation created', { translationId: '456' });
```

### 2. 메트릭 수집 (`src/lib/observability/metrics.ts`)

- **Prometheus 호환**: 표준 Prometheus 형식 지원
- **자동 수집**: API 지연 시간, DB 쿼리 성능, 비즈니스 메트릭
- **Histogram/Counter/Gauge**: 다양한 메트릭 타입

```typescript
import { metrics } from '@/lib/observability';

// 비즈니스 메트릭
metrics.recordTranslationCreated(1, 'manual');
metrics.recordGlossaryHit(1);
metrics.recordAiTranslation('anthropic', true);
```

### 3. Repository 자동 계측 (`src/lib/observability/repository_wrapper.ts`)

- **Proxy 기반**: 모든 메서드 자동 래핑
- **성능 측정**: 자동 duration, error 카운트 수집

```typescript
import { withMetrics } from '@/lib/observability';

const baseRepo = new SupabaseTranslationRepository(supabase);
const instrumentedRepo = withMetrics(baseRepo, 'supabase', 'translations');

// 자동으로 계측됨
await instrumentedRepo.findMany({ status: 'pending' });
```

### 4. Middleware 계측 (`src/middleware.ts`)

- **요청 추적**: 자동 request ID 생성
- **지연 시간 측정**: 모든 요청의 API 지연 시간 기록
- **에러 추적**: 실패한 요청 자동 로깅

### 5. API Endpoints

#### Health Check
```bash
GET /api/health
# => { "status": "healthy", "timestamp": "2024-01-01T00:00:00Z" }

GET /api/health?detailed=true
# => 상세 시스템 상태 (DB, Memory, Uptime)
```

#### Metrics
```bash
GET /api/metrics
# => Prometheus 형식 메트릭

GET /api/metrics/json
# => JSON 형식 메트릭
```

## 환경 변수

```bash
# 로그 레벨 (debug | info | warn | error)
LOG_LEVEL=info

# 메트릭 수집 활성화
ENABLE_METRICS=true

# 메트릭 엔드포인트 보안 토큰
METRICS_TOKEN=your_secure_token
```

## 파일 구조

```
src/lib/observability/
├── index.ts           # 모듈 통합 낳출
├── logger.ts          # 구조화된 로깅
├── metrics.ts         # 메트릭 수집
├── repository_wrapper.ts  # Repository 계측
├── api_helpers.ts     # API Route 헬퍼
└── USAGE.md          # 사용 가이드

src/app/api/
├── health/route.ts    # 헬스체크 엔드포인트
├── metrics/route.ts   # Prometheus 메트릭
└── metrics/json/route.ts  # JSON 메트릭
```

## 사용 예시

### API Route 계측

```typescript
import { withApiInstrumentation } from '@/lib/observability';

async function handler(request: Request) {
  // 비즈니스 로직
  return Response.json({ data });
}

export const GET = withApiInstrumentation(handler, {
  component: 'MyApi',
});
```

### 데코레이터 사용

```typescript
import { timed, counted } from '@/lib/observability';

class MyService {
  @timed('operation_duration_ms')
  async doSomething() {
    // ...
  }

  @counted('operations_total')
  async doAnother() {
    // ...
  }
}
```

## 모니터링 대시보드

### Prometheus 쿼리 예시

```promql
# API 평균 응답 시간
rate(api_latency_ms_sum[5m]) / rate(api_latency_ms_count[5m])

# 초당 요청 수
rate(api_requests_total[1m])

# DB 에러율
rate(db_query_errors_total[5m])

# 번역 생성 추이
rate(translations_created_total[1h])
```

### Grafana 대시보드

1. **API Performance Panel**
   - Query: `histogram_quantile(0.95, rate(api_latency_ms_bucket[5m]))`
   - Legend: `{{path}}`

2. **Error Rate Panel**
   - Query: `rate(errors_total[5m])`
   - Legend: `{{type}}`

3. **Business Metrics Panel**
   - Query: `rate(translations_created_total[1h])`
   - Query: `rate(glossary_hits_total[1h])`

## 알림 설정

### Vercel Logs

```json
{
  "filter": "level:error",
  "alert": {
    "webhook": "https://hooks.slack.com/..."
  }
}
```

### Prometheus AlertManager

```yaml
groups:
  - name: translation-manager
    rules:
      - alert: HighErrorRate
        expr: rate(errors_total[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
```

## 트러블슈팅

### 로그가 출력되지 않음

1. `LOG_LEVEL` 환경 변수 확인
2. `NODE_ENV` 확인 (production에서는 JSON 출력)

### 메트릭이 수집되지 않음

1. `ENABLE_METRICS=true` 확인
2. `/api/metrics` 엔드포인트 접근 권한 확인

### 성능 저하

- 메트릭 수집은 비동기로 처리됨
- 느린 쿼리는 자동으로 경고 로그 출력
