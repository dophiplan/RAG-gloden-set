# Observability System Usage Guide

## Overview

이 Observability 시스템은 다음 기능을 제공합니다:

1. **Structured Logging** - 개발: 콘솔 pretty print / 프로덕션: JSON
2. **Metrics Collection** - Prometheus 형식 지원
3. **Repository Instrumentation** - 자동 계측
4. **Health Checks** - DB 연결 상태 포함

## Quick Start

### 1. Logger 사용

```typescript
import { logger, getContextLogger } from '@/lib/observability';

// 기본 로거
logger.info('Operation completed', { userId: '123', path: '/api/users' });
logger.error('Operation failed', error, { userId: '123' });

// 컨텍스트 로거 (요청 추적)
const contextLogger = getContextLogger('TranslationService');
contextLogger.info('Translation created', { translationId: '456' });
```

### 2. Repository 자동 계측

```typescript
import { withMetrics } from '@/lib/observability';
import { SupabaseTranslationRepository } from '@/repositories/implementations/supabase';

const baseRepo = new SupabaseTranslationRepository(supabase);
const instrumentedRepo = withMetrics(baseRepo, 'supabase', 'translations');

// 모든 메서드가 자동으로 계측됩니다
const result = await instrumentedRepo.findMany({ status: 'pending' });
```

### 3. API Route에서 메트릭 기록

```typescript
import { metrics } from '@/lib/observability/metrics';

export async function POST(request: Request) {
  const start = Date.now();
  
  try {
    // ... 비즈니스 로직
    
    // 비즈니스 메트릭 기록
    metrics.recordTranslationCreated(1, 'api');
    
    return Response.json({ success: true });
  } finally {
    // API 지연 시간 자동 기록 (미들웨어에서도 수행됨)
    const duration = Date.now() - start;
  }
}
```

### 4. 데코레이터 사용

```typescript
import { timed, counted } from '@/lib/observability';

class TranslationService {
  @timed('translation_duration_ms', { provider: (text: string) => 'anthropic' })
  async translate(text: string, targetLang: string) {
    // ... 번역 로직
  }

  @counted('translations_total', { type: 'auto' })
  async autoTranslate(text: string) {
    // ... 자동 번역
  }
}
```

## Environment Variables

```bash
# 로그 레벨 설정 (debug | info | warn | error)
LOG_LEVEL=info

# 메트릭 수집 활성화/비활성화
ENABLE_METRICS=true

# 메트릭 엔드포인트 접근 토큰 (보안)
METRICS_TOKEN=your_secure_token
```

## API Endpoints

### Health Check

```bash
# 기본 헬스체크
GET /api/health
# => { "status": "healthy", "timestamp": "2024-01-01T00:00:00Z" }

# 상세 헬스체크
GET /api/health?detailed=true
# => { 
#   "status": "healthy",
#   "checks": {
#     "database": { "status": "healthy", "responseTime": 45 },
#     "memory": { "status": "healthy", "usedMB": 128, "percentage": 45 }
#   }
# }
```

### Metrics

```bash
# Prometheus 형식
GET /api/metrics
# => 
# # HELP api_latency_ms API endpoint latency in milliseconds
# # TYPE api_latency_ms histogram
# api_latency_ms_bucket{path="/api/translations",method="GET",status_code="200",le="100"} 45

# JSON 형식
GET /api/metrics/json
# => { "timestamp": "...", "metrics": { "api_requests_total": {...} } }
```

## Log Output Examples

### Development (Pretty Print)

```
[14:30:45]  INFO [TranslationService] Translation created req=abc123 user=user-1 150ms
[14:30:46]  WARN [ApiRoute] Slow request detected path=/api/bulk duration=2500ms
[14:30:47] ERROR [Repository] Query failed
  → Error: Connection timeout
    at SupabaseTranslationRepository.findMany
```

### Production (JSON)

```json
{
  "timestamp": "2024-01-01T14:30:45.123Z",
  "level": "info",
  "message": "Translation created",
  "component": "TranslationService",
  "context": {
    "requestId": "abc123",
    "userId": "user-1",
    "duration": 150
  },
  "environment": {
    "nodeEnv": "production",
    "version": "0.1.0"
  }
}
```

## Best Practices

1. **로거는 컴포넌트별로 생성**
   ```typescript
   const logger = getContextLogger('MyComponent');
   ```

2. **에러는 반드시 Error 객체와 함께 로깅**
   ```typescript
   logger.error('Failed to save', error, { entityId: '123' });
   ```

3. **민감한 정보는 로그에 포함하지 않음**
   ```typescript
   // ❌ Bad
   logger.info('User login', { password: user.password });
   
   // ✅ Good
   logger.info('User login', { userId: user.id });
   ```

4. **Repository는 항상 계측하여 사용**
   ```typescript
   const repo = withMetrics(new MyRepository(), 'supabase', 'my_table');
   ```
