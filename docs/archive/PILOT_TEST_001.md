# PILOT-TEST-001: Pilot Migration 기능 테스트 수리 및 커버리지 확보

**상태:** Open  
**우선순위:** Medium  
**담당자:** TBD  
**생성일:** 2026-03-15  
**목표 스프린트:** Pilot Phase 2 (Feature Flag 활성화 전)

---

## 📋 개요

Pilot Migration 시스템 구현 후 테스트 결과, 32개 테스트가 실패하고 있습니다. 본 티켓은 해당 테스트들을 수리하고 Pilot 기능의 테스트 커버리지를 확보하는 것을 목표로 합니다.

---

## 📊 현황

### 테스트 결과 요약
| 구분 | 수치 |
|-----|------|
| 전체 테스트 | 561개 |
| 통과 | 528개 (94.1%) |
| 실패 | 32개 (5.9%) |
| 스킵 | 1개 |

### 실패 테스트 목록

| # | 파일 | 실패 수 | 원인 | 프로덕션 영향 |
|---|------|---------|------|--------------|
| 1 | `sqlite.test.ts` | 2 | Query Builder count, Transaction commit | 없음 (Pilot 전용) |
| 2 | `users.shadow-mode.test.ts` | 2 | Feature Flag 이름 불일치 | 없음 (100% 비활성화) |
| 3 | `translation_repository.test.ts` | 1 | 테스트 DB 스키마 불완전 | 없음 (Pilot 전용) |
| 4 | `translation_audit_repository.test.ts` | 1 | create() 에러 핸들링 | 없음 (Pilot 전용) |
| 5 | `glossary.test.ts` | 2 | Mock 체인 설정 오류 | 없음 (Mock 테스트) |
| 6 | `rollback.route.test.ts` | 4 | Mock 체인 설정 오류 | 없음 (Mock 테스트) |
| 7 | `bulk.route.test.ts` | 6 | 타입 불일치 | 없음 (기존 테스트) |
| 8 | `users.dark-launch.test.ts` | 10 | NextRequest mock 필요 | 없음 (Pilot 전용) |
| 9 | `users.shadow-mode.test.ts` | 8 | Feature Flag mock 필요 | 없음 (Pilot 전용) |

---

## 🎯 목표

### 1차 목표: 테스트 수리 (필수)
- [ ] 32개 실패 테스트 → 0개
- [ ] 테스트 통과율 94.1% → 100%

### 2차 목표: 커버리지 확보 (권장)
- [ ] Pilot 기능 코드 커버리지 80% 이상
- [ ] Shadow Mode 수동 테스트 완료
- [ ] Dark Launch 수동 테스트 완료

### 3차 목표: 문서화 (선택)
- [ ] 테스트 가이드 업데이트
- [ ] 활성화 체크리스트 문서화

---

## 🔧 수리 작업 상세

### 1. SQLite Query Builder (`sqlite.test.ts`)

**문제:** 
- `getCount()` 메서드 동작 오류
- Transaction 이중 `commit()` 호출

**수리 방안:**
```typescript
// query_builder.ts
getCount(): Promise<number> {
  // COUNT 쿼리 로직 확인 및 수정
}

// sqlite.test.ts
// 이중 commit 호출 제거
tx.commit(); // 한 번만 호출
```

**예상 소요:** 1시간

---

### 2. Feature Flag 이름 통일

**문제:**
- `SHADOW_MODE` vs `FULL_CUTOVER` 혼용
- 테스트와 실제 코드 불일치

**수리 방안:**
```typescript
// 테스트 코드에서 플래그 이름 통일
const useShadowMode = isEnabled('FF_USERS_SHADOW_MODE');
const useFullCutover = isEnabled('FF_USERS_FULL_CUTOVER');
```

**예상 소요:** 30분

---

### 3. Test Fixture 개선

**문제:**
- `translation_audit_logs` 테이블 누락
- 테스트 DB 스키마 불완전

**수리 방안:**
```typescript
// setup.ts
await db.execute(`
  CREATE TABLE IF NOT EXISTS translation_audit_logs (
    id TEXT PRIMARY KEY,
    translation_id TEXT,
    action TEXT,
    user_id TEXT,
    created_at TIMESTAMP
  )
`);
```

**예상 소요:** 1시간

---

### 4. Repository 에러 핸들링

**문제:**
- `create()` 메서드 에러 핸들링 누락
- `RepositoryError` 미발생

**수리 방안:**
```typescript
// translation_audit_repository.ts
async create(data: CreateData): Promise<void> {
  try {
    // insert 로직
  } catch (error) {
    throw new RepositoryError('Failed to create audit log', error);
  }
}
```

**예상 소요:** 1시간

---

### 5. Mock 체인 정비

**문제:**
- Glossary/Rollback 테스트 Mock 설정 오류
- Vitest mock 체인 미완성

**수리 방안:**
```typescript
// mock 설정 정비
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
};
```

**예상 소요:** 2시간

---

### 6. NextRequest Mock 설정

**문제:**
- `users.dark-launch.test.ts` NextRequest mock 필요
- `users.shadow-mode.test.ts` Feature Flag mock 필요

**수리 방안:**
```typescript
// NextRequest mock
const createMockRequest = (body?: any) => {
  return new NextRequest('http://localhost/api/users', {
    method: body ? 'POST' : 'GET',
    body: body ? JSON.stringify(body) : undefined,
  });
};

// Feature Flag mock
vi.mock('@/lib/config/feature_flags', () => ({
  isEnabled: vi.fn((flag: string) => {
    if (flag === 'FF_USERS_DARK_LAUNCH') return true;
    return false;
  }),
}));
```

**예상 소요:** 2시간

---

## 📅 일정

| 작업 | 소요 | 담당 | 완료 기준 |
|------|------|------|----------|
| SQLite Query Builder | 1h | Backend | `sqlite.test.ts` 통과 |
| Feature Flag 통일 | 0.5h | Frontend | 플래그 이름 일치 |
| Test Fixture | 1h | Backend | 스키마 완성 |
| Repository 에러 핸들링 | 1h | Backend | 에러 테스트 통과 |
| Mock 체인 정비 | 2h | Frontend | glossary/rollback 통과 |
| NextRequest Mock | 2h | Frontend | users 테스트 통과 |
| **총계** | **7.5h** | | |

---

## ✅ 완료 기준 (Definition of Done)

- [ ] `npm run test` 실행 시 0개 실패
- [ ] `npm run type-check` 0개 에러
- [ ] `npm run build` 성공
- [ ] Pilot 기능 수동 테스트 완료
- [ ] 코드 리뷰 완료
- [ ] 관련 문서 업데이트

---

## ⚠️ 리스크 및 완화

| 리스크 | 영향 | 완화책 |
|--------|------|--------|
| 예상 소요 초과 | 중간 | 작업별로 커밋하여 진행 상황 추적 |
| 새로운 버그 유입 | 낮음 | 각 수정 후 즉시 테스트 실행 |
| 기존 테스트 영향 | 낮음 | 별도 브랜치에서 작업 |

---

## 🔗 관련 문서

- [PILOT_MIGRATION_GUIDE.md](./PILOT_MIGRATION_GUIDE.md)
- [FEATURE_FLAG_SYSTEM.md](./FEATURE_FLAG_SYSTEM.md)
- [ROLLBACK_PLAYBOOK.md](./ROLLBACK_PLAYBOOK.md)

---

## 📝 비고

- **중요:** 본 티켓은 Feature Flag 활성화 전에 반드시 완료되어야 함
- **참고:** 현재 Pilot 코드는 프로덕션에서 100% 비활성화 상태
- **연락:** 문제 발생 시 아키텍처 리드 문의
