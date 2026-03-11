# Deprecated API 마이그레이션 가이드

> **⚠️ 중요**: 14개의 Legacy API가 2026-06-11에 제거될 예정입니다.  
> **권장**: 신규 코드는 Unified API (`/api/bulk`, `/api/rollback`)를 사용하세요.

---

## 📅 타임라인

| 날짜 | 이벤트 |
|------|--------|
| 2026-03-11 | Unified API 출시, Legacy API deprecated 표시 |
| 2026-06-11 | **Legacy API 제거** (D-92일) |

---

## 🔍 마이그레이션 매트릭스

### Bulk Operations

| 기존 API | 메서드 | 신규 Unified API |
|----------|--------|-----------------|
| `/api/translations/bulk` | POST | `POST /api/bulk?type=translations&action=create` |
| `/api/translations/bulk-update` | PATCH | `POST /api/bulk?type=translations&action=update` |
| `/api/translations/bulk-delete` | DELETE | `POST /api/bulk?type=translations&action=delete` |
| `/api/glossary/bulk` | POST | `POST /api/bulk?type=glossary&action=create` |
| `/api/glossary/bulk-update` | PATCH | `POST /api/bulk?type=glossary&action=update` |
| `/api/glossary/bulk-revert` | POST | `POST /api/bulk?type=glossary&action=revert` |
| `/api/admin/users/bulk-update` | PATCH | `POST /api/bulk?type=admin-users&action=update` |
| `/api/admin/users/bulk-delete` | POST | `POST /api/bulk?type=admin-users&action=delete` |

### Rollback Operations

| 기존 API | 메서드 | 신규 Unified API |
|----------|--------|-----------------|
| `/api/translations/[id]/revert` | POST | `POST /api/rollback` (body에 `operation: 'single'`) |
| `/api/glossary/revert` | POST | `POST /api/rollback` (body에 `operation: 'single'`, `entityType: 'glossary'`) |
| `/api/rollback/execute` | POST | `POST /api/rollback` (body에 `operation: 'single'`) |
| `/api/rollback/batch` | POST | `POST /api/rollback` (body에 `operation: 'batch'`) |
| `/api/rollback/batch-by-date` | POST | `POST /api/rollback` (body에 `operation: 'date-based'`) |
| `/api/rollback/check` | POST | `GET /api/rollback?entity_type={type}&entity_id={id}` |

---

## 💻 마이그레이션 예시

### 1. Translations Bulk Create

**Before (Legacy)**:
```typescript
const response = await fetch('/api/translations/bulk', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    texts: ['Hello', 'World'],
    languages: ['en', 'ko'],
    product_code: 'RMS'
  })
});
```

**After (Unified)**:
```typescript
const response = await fetch('/api/bulk?type=translations&action=create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    texts: ['Hello', 'World'],
    languages: ['en', 'ko'],
    product_code: 'RMS'
  })
});
```

### 2. Translations Bulk Update

**Before (Legacy)**:
```typescript
const response = await fetch('/api/translations/bulk-update', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    translation_ids: ['trans-1', 'trans-2'],
    status: 'approved'
  })
});
```

**After (Unified)**:
```typescript
const response = await fetch('/api/bulk?type=translations&action=update', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ids: ['trans-1', 'trans-2'],
    data: { status: 'approved' }
  })
});
```

### 3. Single Rollback

**Before (Legacy)**:
```typescript
const response = await fetch('/api/translations/trans-123/revert', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ logId: 'log-456' })
});
```

**After (Unified)**:
```typescript
const response = await fetch('/api/rollback', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operation: 'single',
    entityType: 'translation',
    entityId: 'trans-123',
    logId: 'log-456'
  })
});
```

### 4. Batch Rollback

**Before (Legacy)**:
```typescript
const response = await fetch('/api/rollback/batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    entityType: 'translation',
    entityIds: ['trans-1', 'trans-2']
  })
});
```

**After (Unified)**:
```typescript
const response = await fetch('/api/rollback', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operation: 'batch',
    entityType: 'translation',
    entityIds: ['trans-1', 'trans-2']
  })
});
```

### 5. Date-based Rollback

**Before (Legacy)**:
```typescript
const response = await fetch('/api/rollback/batch-by-date', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    entityType: 'translation',
    date: '2026-03-01'
  })
});
```

**After (Unified)**:
```typescript
const response = await fetch('/api/rollback', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operation: 'date-based',
    entityType: 'translation',
    date: '2026-03-01'
  })
});
```

### 6. Rollback Operations List

**Before (Legacy)**:
```typescript
const response = await fetch('/api/rollback/check', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    entityType: 'translation',
    entityId: 'trans-123'
  })
});
```

**After (Unified)**:
```typescript
const response = await fetch('/api/rollback?entity_type=translation&entity_id=trans-123', {
  method: 'GET',
  headers: { 'Content-Type': 'application/json' }
});
```

### 7. Glossary Bulk Create

**Before (Legacy)**:
```typescript
const response = await fetch('/api/glossary/bulk', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    items: [
      { term: 'API', translation: 'API', domain: 'tech' }
    ]
  })
});
```

**After (Unified)**:
```typescript
const response = await fetch('/api/bulk?type=glossary&action=create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    items: [
      { term: 'API', translation: 'API', domain: 'tech' }
    ]
  })
});
```

### 8. Admin Users Bulk Delete

**Before (Legacy)**:
```typescript
const response = await fetch('/api/admin/users/bulk-delete', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ids: ['user-1', 'user-2']
  })
});
```

**After (Unified)**:
```typescript
const response = await fetch('/api/bulk?type=admin-users&action=delete', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ids: ['user-1', 'user-2']
  })
});
```

---

## 🔧 클라이언트 마이그레이션 헬퍼

`useBulkActions` 훅이 이미 Unified API를 사용하도록 업데이트되었습니다.

```typescript
// 기존 사용법 (자동으로 Unified API 사용)
import { useBulkActions } from '@/hooks/useBulkActions';

const { bulkCreate } = useBulkActions();

// 내부적으로 /api/bulk?type=translations&action=create 호출
await bulkCreate({
  texts: ['Hello'],
  languages: ['en'],
  product_code: 'RMS'
});
```

---

## ⚡ 자동 마이그레이션 스크립트

### 검색 패턴

```bash
# 프로젝트에서 Legacy API 사용처 찾기
grep -r "translations/bulk" src/ --include="*.ts" --include="*.tsx"
grep -r "glossary/bulk" src/ --include="*.ts" --include="*.tsx"
grep -r "rollback/batch" src/ --include="*.ts" --include="*.tsx"
```

### ESLint 규칙 (권장)

`.eslintrc`에 추가:
```json
{
  "rules": {
    "no-restricted-imports": ["warn", {
      "patterns": [{
        "group": ["*/api/translations/bulk*", "*/api/glossary/bulk*", "*/api/rollback/batch*"],
        "message": "Use Unified API (/api/bulk or /api/rollback) instead"
      }]
    }]
  }
}
```

---

## 📊 모니터링

### Deprecated API 사용량 확인

```bash
curl /api/monitoring/deprecated-usage
```

또는 브라우저 콘솔에서 확인:
```javascript
// Deprecated API 사용 시 경고 로그 출력
[DEPRECATED API USED] /api/translations/bulk
```

---

## ❓ FAQ

### Q: 마이그레이션 기한은 언제인가요?
**A**: 2026-06-11까지 완료해야 합니다. 이후 Legacy API는 동작하지 않습니다.

### Q: Unified API와 Legacy API의 응답 형식이 다른가요?
**A**: 대부분 동일하나, 일부 필드명이 변경되었습니다:
- `translation_ids` → `ids`
- `translation_data` → `data`

### Q: 기존 코드를 모두 수정해야 하나요?
**A**: 네, 2026-06-11 이전까지는 반드시 마이그레이션해야 합니다.

### Q: 마이그레이션 중 문제가 발생하면 어떻게 하나요?
**A**: 이슈를 생성하거나 개발팀에 문의해주세요.

---

## 📚 참고 자료

- [REFACTORING_GUIDE.md](./REFACTORING_GUIDE.md) - 아키텍처 변경 상세
- [API_REFERENCE.md](./API_REFERENCE.md) - 전체 API 명세
- [src/app/api/bulk/README.md](./src/app/api/bulk/README.md) - Bulk API 내부 문서

---

**마지막 업데이트**: 2026-03-11
