# 📊 Monitoring Metrics Guide

> Provider 패턴 마이그레이션 중 모니터링할 핵심 지표

---

## 🎯 핵심 메트릭 (Golden Signals)

### 1. Latency (지연 시간)

#### API Latency
```typescript
// Middleware에서 자동 수집
metrics.recordApiLatency(path, method, duration, statusCode);
```

| Metric | Type | Description | Alert Threshold |
|--------|------|-------------|-----------------|
| `api_latency_ms` | Histogram | API 요청 지연 시간 | p99 > 1000ms |
| `api_latency_by_provider_ms` | Histogram | Provider별 지연 시간 | p99 > 500ms |
| `db_query_duration_ms` | Histogram | DB 쿼리 시간 | p99 > 100ms |

#### Prometheus Query
```promql
# API 평균 지연 시간
rate(api_latency_ms_sum[5m]) / rate(api_latency_ms_count[5m])

# Provider별 지연 시간 비교
rate(api_latency_by_provider_ms_sum{provider="sqlite"}[5m]) / 
rate(api_latency_by_provider_ms_count{provider="sqlite"}[5m])

# 느린 요청 비율
rate(api_latency_ms_bucket{le="+Inf"}[5m]) - 
rate(api_latency_ms_bucket{le="1000"}[5m])
```

---

### 2. Traffic (트래픽)

```typescript
// 자동 수집
metrics.recordApiRequest(path, method, statusCode);
```

| Metric | Type | Description |
|--------|------|-------------|
| `api_requests_total` | Counter | 총 API 요청 수 |
| `api_requests_by_provider_total` | Counter | Provider별 요청 수 |
| `concurrent_requests` | Gauge | 동시 요청 수 |

#### Prometheus Query
```promql
# 초당 요청 수
rate(api_requests_total[1m])

# Provider별 요청 분포
rate(api_requests_by_provider_total[5m])

# 오류율
rate(api_requests_total{status=~"5.."}[5m]) / 
rate(api_requests_total[5m])
```

---

### 3. Errors (오류)

```typescript
// 수동 기록
metrics.recordError(component, type);
```

| Metric | Type | Description | Alert Threshold |
|--------|------|-------------|-----------------|
| `errors_total` | Counter | 총 오류 수 | - |
| `db_query_errors_total` | Counter | DB 쿼리 오류 | > 10/분 |
| `provider_switch_errors_total` | Counter | Provider 전환 오류 | > 0 |
| `api_error_rate` | Gauge | API 오류율 | > 1% |

#### Prometheus Query
```promql
# 5분간 오류율
rate(errors_total[5m])

# DB 오류율
rate(db_query_errors_total[5m])

# Provider별 오류율
sum by (provider) (rate(errors_total[5m]))
```

---

### 4. Saturation (포화도)

| Metric | Type | Description | Alert Threshold |
|--------|------|-------------|-----------------|
| `db_connection_pool_usage` | Gauge | DB 연결 풀 사용률 | > 80% |
| `memory_usage_bytes` | Gauge | 메모리 사용량 | > 1GB |
| `active_requests` | Gauge | 활성 요청 수 | > 100 |

---

## 📈 비즈니스 메트릭

### 번역 관련
```typescript
metrics.recordTranslationCreated(count, source);
metrics.recordGlossaryHit(count);
metrics.recordAiTranslation(provider, success);
```

| Metric | Type | Description |
|--------|------|-------------|
| `translations_created_total` | Counter | 생성된 번역 수 |
| `translations_updated_total` | Counter | 업데이트된 번역 수 |
| `glossary_hits_total` | Counter | 용어집 히트 수 |
| `ai_translation_total` | Counter | AI 번역 요청 수 |
| `ai_translation_success_total` | Counter | AI 번역 성공 수 |

### 사용자 관련
```typescript
metrics.recordUserLogin(userId);
metrics.recordUserAction(action, userId);
```

| Metric | Type | Description |
|--------|------|-------------|
| `user_logins_total` | Counter | 로그인 수 |
| `user_actions_total` | Counter | 사용자 행동 수 |

---

## 🔍 Provider 마이그레이션 특화 메트릭

### Provider 사용 분포
```typescript
// Provider별 메트릭 자동 태깅
const instrumentedRepo = withMetrics(baseRepo, 'sqlite', 'translations');
```

| Metric | Labels | Description |
|--------|--------|-------------|
| `provider_requests_total` | `provider`, `repository` | Provider별 요청 |
| `provider_latency_ms` | `provider`, `operation` | Provider별 지연 |
| `provider_errors_total` | `provider`, `error_type` | Provider별 오류 |

### 마이그레이션 진행률
```typescript
// Feature Flag 상태 메트릭
metrics.recordFlagStatus(flagName, isEnabled);
```

| Metric | Type | Description |
|--------|------|-------------|
| `feature_flag_enabled` | Gauge | 활성화된 Flag |
| `migrated_endpoints_total` | Gauge | 마이그레이션된 엔드포인트 수 |
| `provider_migration_percentage` | Gauge | 마이그레이션 진행률 |

---

## 📊 Grafana 대시보드 구성

### 1. API Performance Dashboard

```json
{
  "title": "API Performance",
  "panels": [
    {
      "title": "Request Rate",
      "targets": [{
        "expr": "rate(api_requests_total[1m])",
        "legendFormat": "{{method}} {{path}}"
      }]
    },
    {
      "title": "Error Rate",
      "targets": [{
        "expr": "rate(api_requests_total{status=~\"5..\"}[5m])",
        "legendFormat": "5xx errors"
      }]
    },
    {
      "title": "Latency (p99)",
      "targets": [{
        "expr": "histogram_quantile(0.99, rate(api_latency_ms_bucket[5m]))",
        "legendFormat": "p99"
      }]
    }
  ]
}
```

### 2. Provider Migration Dashboard

```json
{
  "title": "Provider Migration",
  "panels": [
    {
      "title": "Provider Distribution",
      "type": "piechart",
      "targets": [{
        "expr": "sum by (provider) (rate(provider_requests_total[5m]))"
      }]
    },
    {
      "title": "Migration Progress",
      "type": "gauge",
      "targets": [{
        "expr": "provider_migration_percentage"
      }]
    }
  ]
}
```

### 3. Database Performance Dashboard

```json
{
  "title": "Database Performance",
  "panels": [
    {
      "title": "Query Duration (p99)",
      "targets": [{
        "expr": "histogram_quantile(0.99, rate(db_query_duration_ms_bucket[5m]))",
        "legendFormat": "{{provider}}"
      }]
    },
    {
      "title": "Connection Pool Usage",
      "targets": [{
        "expr": "db_connection_pool_usage",
        "legendFormat": "{{database}}"
      }]
    }
  ]
}
```

---

## 🚨 AlertManager 설정

```yaml
# alertmanager.yml
groups:
  - name: provider-migration
    interval: 30s
    rules:
      # Critical: 높은 오류율
      - alert: HighErrorRate
        expr: rate(api_requests_total{status=~"5.."}[5m]) / rate(api_requests_total[5m]) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }}"
          
      # Critical: 높은 지연 시간
      - alert: HighLatency
        expr: histogram_quantile(0.99, rate(api_latency_ms_bucket[5m])) > 5000
        for: 3m
        labels:
          severity: critical
        annotations:
          summary: "High latency detected"
          description: "p99 latency is {{ $value }}ms"
          
      # Warning: Provider 전환 오류
      - alert: ProviderSwitchError
        expr: rate(provider_switch_errors_total[5m]) > 0
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "Provider switch error detected"
          
      # Info: 마이그레이션 진행
      - alert: MigrationProgress
        expr: provider_migration_percentage > 0
        for: 1h
        labels:
          severity: info
        annotations:
          summary: "Migration in progress: {{ $value }}%"
```

---

## 📱 Vercel Analytics 연동

```typescript
// src/lib/observability/vercel_analytics.ts

export function trackWebVitals(metric: any) {
  // Core Web Vitals 추적
  const { id, name, value, label } = metric;
  
  // 커스텀 메트릭으로 전송
  fetch('/api/metrics/webvitals', {
    method: 'POST',
    body: JSON.stringify({
      id,
      name,
      value,
      label,
      provider: getCurrentProviderType(),
    }),
  });
}
```

---

## 🔧 메트릭 수집 확인 방법

### 로컬에서 확인
```bash
# 메트릭 엔드포인트 호출
curl http://localhost:3000/api/metrics

# JSON 형식
curl http://localhost:3000/api/metrics/json
```

### Prometheus에서 확인
```bash
# 타겟 상태 확인
curl http://localhost:9090/api/v1/targets

# 메트릭 쿼리
curl 'http://localhost:9090/api/v1/query?query=up'
```

---

## 📊 슬라이스 및 인덱스

| 대시보드 | URL | 설명 |
|----------|-----|------|
| API Performance | `/d/api-performance` | API 지연/오류 |
| Provider Migration | `/d/provider-migration` | 마이그레이션 진행률 |
| Database | `/d/database` | DB 성능 |
| Business | `/d/business` | 비즈니스 메트릭 |

---

*작성일: 2026-03-15*
*버전: 1.0*
