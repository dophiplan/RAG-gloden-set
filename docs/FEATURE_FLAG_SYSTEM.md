# 🎛️ Feature Flag System

> 점진적 롤아웃과 안전한 배포를 위한 Feature Flag 시스템

---

## 🏗️ 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    Feature Flag Layer                        │
├─────────────────────────────────────────────────────────────┤
│  Environment Variables  │  Runtime Config  │  Code Defaults │
│  (VERCEL_ENV)          │  (API fetch)     │  (fallback)    │
└───────────┬─────────────┴────────┬─────────┴───────┬────────┘
            │                      │                 │
            ▼                      ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    Flag Evaluation Engine                    │
│         (환경 → 런타임 → 기본값 우선순위 적용)              │
└───────────┬─────────────────────────────────────────────────┘
            │
    ┌───────┴───────┐
    ▼               ▼
┌─────────┐    ┌─────────┐
│  활성화  │    │ 비활성화 │
│ (New)   │    │ (Old)   │
└────┬────┘    └────┬────┘
     │              │
     ▼              ▼
┌─────────┐    ┌─────────┐
│Provider │    │Supabase │
│Pattern  │    │Direct   │
└─────────┘    └─────────┘
```

---

## 📁 파일 구조

```
src/lib/config/
├── feature_flags.ts      # 메인 Feature Flag 정의
├── feature_flag_client.ts # 런타임 Flag 가져오기 (Client)
└── feature_flag_server.ts # 런타임 Flag 가져오기 (Server)

src/app/api/flags/route.ts # Feature Flag API (런타임 제어)
```

---

## 🚀 구현

### 1. 기본 Feature Flag 정의

```typescript
// src/lib/config/feature_flags.ts

/**
 * Feature Flag 정의
 * 
 * 우선순위:
 * 1. 환경변수 (process.env.FF_*)
 * 2. 런타임 설정 (API에서 가져온 값)
 * 3. 코드 기본값
 */

// Flag 타입 정의
export interface FeatureFlags {
  // SQLite 구현체
  USE_SQLITE_GLOSSARY: boolean;
  USE_SQLITE_TRANSLATION_AUDIT: boolean;
  
  // Provider 마이그레이션
  ENABLE_API_PROVIDER_MIGRATION: boolean;
  MIGRATED_ENDPOINTS: string[];
  
  // 파일럿 엔드포인트
  ENABLE_PILOT: boolean;
  PILOT_ENDPOINT: string;
  
  // 단계별 롤아웃
  ENABLE_PHASE_1: boolean;  // Read-only endpoints
  ENABLE_PHASE_2: boolean;  // Low-traffic write
  ENABLE_PHASE_3: boolean;  // Core business
  ENABLE_PHASE_4: boolean;  // High-traffic
  
  // 비상 롤백
  DISABLED_ENDPOINTS: string[];
  
  // CI/CD
  ENABLE_CI_OPTIMIZATIONS: boolean;
}

// 기본값
const defaultFlags: FeatureFlags = {
  USE_SQLITE_GLOSSARY: false,
  USE_SQLITE_TRANSLATION_AUDIT: false,
  ENABLE_API_PROVIDER_MIGRATION: false,
  MIGRATED_ENDPOINTS: [],
  ENABLE_PILOT: false,
  PILOT_ENDPOINT: '',
  ENABLE_PHASE_1: false,
  ENABLE_PHASE_2: false,
  ENABLE_PHASE_3: false,
  ENABLE_PHASE_4: false,
  DISABLED_ENDPOINTS: [],
  ENABLE_CI_OPTIMIZATIONS: false,
};

// 환경변수에서 Flag 로드
function loadFlagsFromEnv(): Partial<FeatureFlags> {
  return {
    USE_SQLITE_GLOSSARY: parseBool(process.env.FF_USE_SQLITE_GLOSSARY),
    USE_SQLITE_TRANSLATION_AUDIT: parseBool(process.env.FF_USE_SQLITE_TRANSLATION_AUDIT),
    ENABLE_API_PROVIDER_MIGRATION: parseBool(process.env.FF_ENABLE_API_PROVIDER_MIGRATION),
    MIGRATED_ENDPOINTS: parseArray(process.env.FF_MIGRATED_ENDPOINTS),
    ENABLE_PILOT: parseBool(process.env.FF_ENABLE_PILOT),
    PILOT_ENDPOINT: process.env.FF_PILOT_ENDPOINT || '',
    ENABLE_PHASE_1: parseBool(process.env.FF_ENABLE_PHASE_1),
    ENABLE_PHASE_2: parseBool(process.env.FF_ENABLE_PHASE_2),
    ENABLE_PHASE_3: parseBool(process.env.FF_ENABLE_PHASE_3),
    ENABLE_PHASE_4: parseBool(process.env.FF_ENABLE_PHASE_4),
    DISABLED_ENDPOINTS: parseArray(process.env.FF_DISABLED_ENDPOINTS),
    ENABLE_CI_OPTIMIZATIONS: parseBool(process.env.FF_ENABLE_CI_OPTIMIZATIONS),
  };
}

// 유틸리티 함수
function parseBool(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  return value === 'true' || value === '1';
}

function parseArray(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

// 전역 Flag 저장소 (런타임 업데이트용)
let runtimeFlags: Partial<FeatureFlags> = {};

/**
 * 현재 Feature Flag 값 가져오기
 */
export function getFeatureFlags(): FeatureFlags {
  const envFlags = loadFlagsFromEnv();
  
  return {
    ...defaultFlags,
    ...runtimeFlags,
    ...envFlags,  // 환경변수가 최우선
  } as FeatureFlags;
}

/**
 * 런타임에 Flag 업데이트 (Admin API용)
 */
export function updateRuntimeFlags(flags: Partial<FeatureFlags>): void {
  runtimeFlags = {
    ...runtimeFlags,
    ...flags,
  };
}

/**
 * 특정 Flag 값 가져오기
 */
export function getFlag<K extends keyof FeatureFlags>(key: K): FeatureFlags[K] {
  return getFeatureFlags()[key];
}

/**
 * 엔드포인트가 마이그레이션되었는지 확인
 */
export function isEndpointMigrated(endpoint: string): boolean {
  const flags = getFeatureFlags();
  
  // 비상 롤백 체크
  if (flags.DISABLED_ENDPOINTS.includes(endpoint)) {
    return false;
  }
  
  // 파일럿 체크
  if (flags.ENABLE_PILOT && flags.PILOT_ENDPOINT === endpoint) {
    return true;
  }
  
  // 마이그레이션 목록 체크
  if (flags.MIGRATED_ENDPOINTS.includes(endpoint)) {
    return true;
  }
  
  return false;
}
```

### 2. Server-side Flag Provider

```typescript
// src/lib/config/feature_flag_server.ts

import { getFeatureFlags, isEndpointMigrated } from './feature_flags';
import { DatabaseProviderType, initializeDatabaseProvider } from '@/lib/database/provider';
import { createClient } from '@/lib/supabase/server';

/**
 * API Route용 Provider 가져오기 (Server-side)
 */
export async function getServerProvider(endpoint?: string) {
  const flags = getFeatureFlags();
  
  // 엔드포인트가 마이그레이션되었는지 확인
  if (endpoint && !isEndpointMigrated(endpoint)) {
    // 기존 Supabase 사용
    const supabase = await createClient();
    return initializeDatabaseProvider({ type: 'supabase', supabase });
  }
  
  // 마이그레이션된 엔드포인트 또는 글로벌 설정 사용
  const providerType: DatabaseProviderType = flags.ENABLE_API_PROVIDER_MIGRATION
    ? (process.env.DATABASE_PROVIDER as DatabaseProviderType) || 'supabase'
    : 'supabase';
  
  const supabase = await createClient();
  return initializeDatabaseProvider({ type: providerType, supabase });
}

/**
 * SQLite 전용 Provider 가져오기 (특정 기능에만 사용)
 */
export async function getSQLiteProvider() {
  return initializeDatabaseProvider({ type: 'sqlite' });
}

/**
 * 현재 Flag 상태 반환 (Health check용)
 */
export function getFlagStatus() {
  const flags = getFeatureFlags();
  
  return {
    flags,
    provider: process.env.DATABASE_PROVIDER || 'supabase',
    timestamp: new Date().toISOString(),
  };
}
```

### 3. Feature Flag Admin API

```typescript
// src/app/api/admin/flags/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getFeatureFlags, updateRuntimeFlags } from '@/lib/config/feature_flags';
import { getFlagStatus } from '@/lib/config/feature_flag_server';

// Admin 인증 미들웨어 (간단한 토큰 기반)
function verifyAdminAuth(request: NextRequest): boolean {
  const token = request.headers.get('x-admin-token');
  return token === process.env.ADMIN_SECRET_TOKEN;
}

/**
 * GET /api/admin/flags
 * 현재 Feature Flag 상태 조회
 */
export async function GET(request: NextRequest) {
  if (!verifyAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  return NextResponse.json(getFlagStatus());
}

/**
 * POST /api/admin/flags
 * 런타임 Feature Flag 업데이트
 * 
 * Body: { [flagName]: value }
 */
export async function POST(request: NextRequest) {
  if (!verifyAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const updates = await request.json();
    updateRuntimeFlags(updates);
    
    return NextResponse.json({
      success: true,
      updated: Object.keys(updates),
      current: getFlagStatus(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/admin/flags
 * 런타임 Flag 초기화 (환경변수 값으로 복귀)
 */
export async function DELETE(request: NextRequest) {
  if (!verifyAdminAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // 런타임 Flag 초기화
  updateRuntimeFlags({});
  
  return NextResponse.json({
    success: true,
    message: 'Runtime flags reset to environment defaults',
    current: getFlagStatus(),
  });
}
```

### 4. 사용 예시

```typescript
// src/app/api/health/route.ts
import { NextResponse } from 'next/server';
import { getServerProvider } from '@/lib/config/feature_flag_server';
import { getFlag } from '@/lib/config/feature_flags';

export async function GET() {
  const start = Date.now();
  
  try {
    // Feature Flag 확인
    const useNewProvider = getFlag('ENABLE_PILOT') && 
                          getFlag('PILOT_ENDPOINT') === '/api/health';
    
    if (useNewProvider) {
      // 새로운 Provider 사용
      const provider = await getServerProvider('/api/health');
      
      // Provider 기반 헬스 체크
      const checks = await Promise.all([
        checkProviderHealth(provider),
        checkDatabaseHealth(),
      ]);
      
      const allHealthy = checks.every(c => c.healthy);
      
      return NextResponse.json({
        status: allHealthy ? 'healthy' : 'degraded',
        provider: provider.type,
        checks: Object.fromEntries(checks.map(c => [c.name, c.healthy])),
        duration: Date.now() - start,
        timestamp: new Date().toISOString(),
      }, {
        status: allHealthy ? 200 : 503,
        headers: {
          'x-provider-type': provider.type,
        },
      });
    }
    
    // 기존 방식 (Supabase 직접)
    const supabase = await createClient();
    const { error } = await supabase.from('users').select('id').limit(1);
    
    return NextResponse.json({
      status: error ? 'unhealthy' : 'healthy',
      provider: 'supabase',
      error: error?.message,
      duration: Date.now() - start,
    });
    
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - start,
      },
      { status: 500 }
    );
  }
}
```

---

## 🔧 환경변수 설정

### 개발 환경 (`.env.local`)
```bash
# SQLite 구현체 활성화
FF_USE_SQLITE_GLOSSARY=true
FF_USE_SQLITE_TRANSLATION_AUDIT=true

# Provider 마이그레이션
DATABASE_PROVIDER=sqlite
FF_ENABLE_API_PROVIDER_MIGRATION=true
FF_MIGRATED_ENDPOINTS=/api/health,/api/platforms

# 파일럿
FF_ENABLE_PILOT=true
FF_PILOT_ENDPOINT=/api/health

# Admin API 토큰
ADMIN_SECRET_TOKEN=dev-secret-token
```

### 스테이징 환경 (Vercel)
```bash
# 점진적 롤아웃 (50%)
FF_ENABLE_PHASE_1=true
FF_ENABLE_PHASE_2=false
FF_ENABLE_PHASE_3=false
FF_ENABLE_PHASE_4=false

# Admin API 토큰
ADMIN_SECRET_TOKEN=${STAGING_ADMIN_TOKEN}
```

### 프로덕션 환경 (Vercel)
```bash
# 초기에는 모두 비활성화
FF_ENABLE_PHASE_1=false
FF_ENABLE_PHASE_2=false
FF_ENABLE_PHASE_3=false
FF_ENABLE_PHASE_4=false

# Admin API 토큰
ADMIN_SECRET_TOKEN=${PROD_ADMIN_TOKEN}
```

---

## 📊 Flag 변경 이력 추적

```typescript
// src/lib/config/feature_flag_audit.ts

interface FlagChangeEvent {
  timestamp: string;
  flag: string;
  oldValue: any;
  newValue: any;
  changedBy: string;  // Admin token hash 또는 user ID
  source: 'environment' | 'api' | 'code';
}

const flagChangeHistory: FlagChangeEvent[] = [];
const MAX_HISTORY_SIZE = 1000;

export function recordFlagChange(
  flag: string,
  oldValue: any,
  newValue: any,
  changedBy: string,
  source: 'environment' | 'api' | 'code'
): void {
  const event: FlagChangeEvent = {
    timestamp: new Date().toISOString(),
    flag,
    oldValue,
    newValue,
    changedBy,
    source,
  };
  
  flagChangeHistory.push(event);
  
  // 히스토리 크기 제한
  if (flagChangeHistory.length > MAX_HISTORY_SIZE) {
    flagChangeHistory.shift();
  }
  
  // 중요한 변경은 로깅
  if (source === 'api') {
    logger.info('Feature flag changed', { event });
  }
}

export function getFlagChangeHistory(flag?: string): FlagChangeEvent[] {
  if (flag) {
    return flagChangeHistory.filter(e => e.flag === flag);
  }
  return [...flagChangeHistory];
}
```

---

## 🚨 비상 롤백 절차

### 1. 자동 롤백 트리거 조건
```typescript
// src/lib/config/auto_rollback.ts

interface AutoRollbackRule {
  metric: string;
  threshold: number;
  duration: number;  // seconds
  action: 'disable_flag' | 'alert_only';
  flagToDisable?: string;
}

const autoRollbackRules: AutoRollbackRule[] = [
  {
    metric: 'api_error_rate_5xx',
    threshold: 0.05,  // 5%
    duration: 60,     // 1분 지속
    action: 'disable_flag',
    flagToDisable: 'ENABLE_PHASE_1',
  },
  {
    metric: 'api_p99_latency_ms',
    threshold: 5000,  // 5초
    duration: 120,    // 2분 지속
    action: 'disable_flag',
    flagToDisable: 'ENABLE_PILOT',
  },
];
```

### 2. 수동 롤백 명령어
```bash
# 1. Vercel Dashboard에서 환경변수 변경
# Settings → Environment Variables → FF_ENABLE_PHASE_1 → false

# 2. CLI로 롤백
vercel env add FF_ENABLE_PHASE_1 production false --token=$VERCEL_TOKEN
vercel --prod --token=$VERCEL_TOKEN

# 3. Admin API로 런타임 롤백 (즉시 적용)
curl -X POST https://api.example.com/api/admin/flags \
  -H "x-admin-token: $ADMIN_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ENABLE_PHASE_1": false}'

# 4. 긴급 엔드포인트 차단
curl -X POST https://api.example.com/api/admin/flags \
  -H "x-admin-token: $ADMIN_SECRET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"DISABLED_ENDPOINTS": "/api/translations"}'
```

---

## 📈 모니터링 대시보드

### Flag 상태 모니터링
```typescript
// /api/metrics/flags 엔드포인트

export function getFlagMetrics() {
  const flags = getFeatureFlags();
  
  return {
    // 활성화된 Flag 수
    activeFlagsCount: Object.values(flags).filter(v => 
      typeof v === 'boolean' && v
    ).length,
    
    // 마이그레이션 진행률
    migrationProgress: {
      phase1: flags.ENABLE_PHASE_1,
      phase2: flags.ENABLE_PHASE_2,
      phase3: flags.ENABLE_PHASE_3,
      phase4: flags.ENABLE_PHASE_4,
    },
    
    // 마이그레이션된 엔드포인트 수
    migratedEndpointsCount: flags.MIGRATED_ENDPOINTS.length,
    
    // 비활성화된 엔드포인트 (비상 롤백)
    disabledEndpointsCount: flags.DISABLED_ENDPOINTS.length,
  };
}
```

---

*작성일: 2026-03-15*
*버전: 1.0*
