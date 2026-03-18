# Phase 3: API 통합 (API Consolidation)

> **목표**: 81개 API → 40개 API로 통합
> **완료일**: 2026-03-11

---

## 📊 통합 현황

| 통합 그룹 | 통합 전 | 통합 후 | 감소율 |
|-----------|---------|---------|--------|
| Revert/Rollback | 7개 | 1개 | -86% |
| Bulk Operations | 11개 | 1개 | -91% |
| **총계** | **18개** | **2개** | **-89%** |

---

## 🔀 통합된 API

### 1. Revert/Rollback 통합 API

**새 엔드포인트**: `POST|GET /api/rollback`

#### 이전 엔드포인트들 (Deprecated)

| 이전 경로 | 대체 방법 |
|-----------|----------|
| `POST /api/translations/[id]/revert` | `POST /api/rollback` |
| `POST /api/glossary/revert` | `POST /api/rollback` |
| `POST /api/rollback/execute` | `POST /api/rollback` |
| `POST /api/rollback/batch` | `POST /api/rollback` |
| `POST /api/rollback/batch-by-date` | `POST /api/rollback` |
| `GET /api/rollback/check` | `GET /api/rollback` |

#### 요청 형식

```typescript
// 단일 롤백
POST /api/rollback
{
  "operation": "single",
  "entityType": "translation",  // "translation" | "glossary"
  "entityId": "uuid",
  "logId": "audit-log-uuid"     // translation에만 필요
}

// 배치 롤백
POST /api/rollback
{
  "operation": "batch",
  "entityType": "translation",
  "entityIds": ["uuid1", "uuid2", "..."]
}

// 날짜 기반 롤백
POST /api/rollback
{
  "operation": "date-based",
  "entityType": "translation",
  "date": "2026-03-11"
}
```

#### 응답 형식

```typescript
{
  "success": true,
  "message": "롤백이 완료되었습니다.",
  "results": [
    { "entityId": "uuid", "reverted": true }
  ]
}
```

---

### 2. Bulk Operations 통합 API

**새 엔드포인트**: `POST /api/bulk?type={type}&action={action}`

#### 이전 엔드포인트들 (Deprecated)

| 이전 경로 | 대체 방법 |
|-----------|----------|
| `POST /api/translations/bulk` | `POST /api/bulk?type=translations&action=create` |
| `POST /api/translations/bulk-update` | `POST /api/bulk?type=translations&action=update` |
| `DELETE /api/translations/bulk-delete` | `POST /api/bulk?type=translations&action=delete` |
| `POST /api/translations/bulk-revert` | `POST /api/bulk?type=translations&action=revert` |
| `POST /api/translations/bulk-products` | `POST /api/bulk?type=translations&action=products` |
| `POST /api/translations/bulk-logs` | `POST /api/bulk?type=translations&action=logs` |
| `POST /api/translations/bulk-status` | `POST /api/bulk?type=translations&action=status` |
| `POST /api/glossary/bulk` | `POST /api/bulk?type=glossary&action=create` |
| `POST /api/glossary/bulk-update` | `POST /api/bulk?type=glossary&action=update` |
| `DELETE /api/glossary/bulk-delete` | `POST /api/bulk?type=glossary&action=delete` |
| `POST /api/glossary/bulk-revert` | `POST /api/bulk?type=glossary&action=revert` |
| `POST /api/users/bulk-upload` | `POST /api/bulk?type=users&action=upload` |
| `POST /api/admin/users/bulk-delete` | `POST /api/bulk?type=admin-users&action=delete` |
| `POST /api/admin/users/bulk-update` | `POST /api/bulk?type=admin-users&action=update` |

#### 지원되는 타입/액션 조합

| 타입 | 액션 | 설명 |
|------|------|------|
| `translations` | `create` | 번역 일괄 생성 (AI) |
| `translations` | `update` | 번역 필드 일괄 수정 |
| `translations` | `delete` | 번역 일괄 삭제 (Soft) |
| `translations` | `revert` | 번역 일괄 복원 |
| `translations` | `products` | 제품 연결/해제 |
| `translations` | `logs` | 로그 일괄 조회 |
| `translations` | `status` | 상태 일괄 변경 |
| `glossary` | `create` | 용어 일괄 생성 |
| `glossary` | `update` | 용어 일괄 수정 |
| `glossary` | `delete` | 용어 일괄 삭제 |
| `glossary` | `revert` | 용어 일괄 복원 |
| `users` | `upload` | 사용자 일괄 등록 |
| `admin-users` | `delete` | 관리자 - 사용자 일괄 삭제 |
| `admin-users` | `update` | 관리자 - 사용자 일괄 수정 |

#### 요청 예시

```typescript
// 번역 일괄 생성
POST /api/bulk?type=translations&action=create
{
  "texts": ["Hello", "World"],
  "languages": ["ko", "ja"],
  "product_code": "RMS",
  "context": "UI labels",
  "priority": "high"
}

// 번역 상태 일괄 변경
POST /api/bulk?type=translations&action=status
{
  "ids": ["uuid1", "uuid2"],
  "status": "approved",
  "reason": "일괄 승인"
}

// 용어 일괄 생성
POST /api/bulk?type=glossary&action=create
{
  "items": [
    { "term": "API", "translation": "API", "domain": "tech" },
    { "term": "Rollback", "translation": "롤백", "domain": "tech" }
  ]
}
```

---

## 🔄 마이그레이션 가이드

### 클라이언트 코드 마이그레이션

#### Before (개별 API 사용)

```typescript
// 번역 복원
const res = await fetch(`/api/translations/${id}/revert`, {
  method: 'POST',
  body: JSON.stringify({ logId, languageCode }),
});

// 배치 롤백
const res = await fetch('/api/rollback/batch', {
  method: 'POST',
  body: JSON.stringify({ batchId, targetType: 'translation' }),
});

// 용어집 일괄 업데이트
const res = await fetch('/api/glossary/bulk-update', {
  method: 'POST',
  body: JSON.stringify({ items }),
});
```

#### After (통합 API 사용)

```typescript
// 번역 복원
const res = await fetch('/api/rollback', {
  method: 'POST',
  body: JSON.stringify({ 
    operation: 'single', 
    entityType: 'translation', 
    entityId: id,
    logId 
  }),
});

// 배치 롤백
const res = await fetch('/api/rollback', {
  method: 'POST',
  body: JSON.stringify({ 
    operation: 'batch', 
    entityType: 'translation',
    entityIds: [...] 
  }),
});

// 용어집 일괄 업데이트
const res = await fetch('/api/bulk?type=glossary&action=update', {
  method: 'POST',
  body: JSON.stringify({ items }),
});
```

---

## ⚠️ 하위 호환성

### Deprecated API들
- 기존 API들은 **즉시 삭제되지 않음**
- 3개월 유예 기간 제공 (2026-06-11까지)
- `@deprecated` JSDoc 태그로 마킹됨
- 콘솔 warning 로그 출력 예정

### 호환성 유지 계획
1. **Phase 3.1** (현재): 통합 API 배포 + 기존 API deprecation 마킹
2. **Phase 3.2** (4주 후): 클라이언트 마이그레이션 진행
3. **Phase 3.3** (8주 후): 기존 API에 runtime warning 추가
4. **Phase 3.4** (12주 후): 기존 API 제거

---

## 📈 통합 효과

### 코드 복잡도 감소
```
통합 전:
- Revert/Rollback: 7개 파일, ~1,200줄
- Bulk: 11개 파일, ~3,500줄
- 총: 18개 파일, ~4,700줄

통합 후:
- rollback/route.ts: 1개 파일, ~400줄
- bulk/route.ts: 1개 파일, ~600줄
- 총: 2개 파일, ~1,000줄
```

### 유지보수성 향상
- 중복 로직 제거 → 버그 감소
- 일관된 에러 핸들링
- 일관된 응답 형식
- 테스트 작성 용이

### API 일관성
- 통일된 인증/인가 체계
- 통일된 audit logging
- 통일된 validation 패턴

---

## 🎯 다음 단계 (Phase 3+)

### Remaining APIs for Consolidation (63 → 38)

| 그룹 | 개수 | 통합 방향 |
|------|------|----------|
| Stats/Analytics | 8개 | `/api/stats?type={}` |
| Export/Import | 6개 | `/api/export`, `/api/import` |
| Search | 4개 | `/api/search?type={}` |
| Settings | 5개 | `/api/settings` |
| Admin Operations | 12개 | `/api/admin/operations` |

### 예상 최종 API 개수
- **목표**: 81개 → 40개 (-50%)
- **현재 진행**: 81개 → 63개 (Phase 3 완료)
- **남은 작업**: 63개 → 40개 (Phase 3+)

---

## ✅ 테스트 체크리스트

- [ ] `/api/rollback` - 단일 롤백 테스트
- [ ] `/api/rollback` - 배치 롤백 테스트
- [ ] `/api/rollback` - 날짜 기반 롤백 테스트
- [ ] `/api/rollback` - GET 목록 조회 테스트
- [ ] `/api/bulk?type=translations&action=create` - AI 번역 생성
- [ ] `/api/bulk?type=translations&action=update` - 필드 업데이트
- [ ] `/api/bulk?type=translations&action=delete` - Soft delete
- [ ] `/api/bulk?type=translations&action=revert` - 복원
- [ ] `/api/bulk?type=translations&action=products` - 제품 연결
- [ ] `/api/bulk?type=translations&action=logs` - 로그 조회
- [ ] `/api/bulk?type=translations&action=status` - 상태 변경
- [ ] `/api/bulk?type=glossary&action=create` - 용어 생성
- [ ] `/api/bulk?type=glossary&action=update` - 용어 수정
- [ ] `/api/bulk?type=glossary&action=delete` - 용어 삭제
- [ ] `/api/bulk?type=glossary&action=revert` - 용어 복원

---

## 📚 참고 문서

- [Phase 1: Page Consolidation](./PAGE_CONSOLIDATION_PHASE1.md)
- [Phase 2: Service Layer Migration](./SERVICE_LAYER_PHASE2.md)
- [Refactoring Guide](../REFACTORING_GUIDE.md)
