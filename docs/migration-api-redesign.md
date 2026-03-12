# Backend API Design: 마이그레이션 API 수정 설계

## 1. 현재 API 구조 분석

### 1.1 기존 API 엔드포인트

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/migration/preview` | POST | 파일 파싱 및 미리보기 데이터 생성 |
| `/api/migration/commit` | POST | 실제 데이터 임포트 실행 |

### 1.2 기존 데이터 흐름

```
[Client] → 파일 업로드 + field_mappings + version → [Preview API]
                                            ↓
                              파싱된 데이터 + 중복체크 + 분류 제안
                                            ↓
[Client] ← entries + summary ← [Preview API]
   ↓
사용자 검토 및 action 선택 (import/skip/merge/overwrite)
   ↓
[Client] → entries + actions + product_code + version → [Commit API]
                                            ↓
                              translations/glossary 테이블 INSERT/UPDATE
                                            ↓
                              translation_products/glossary_products 연결
```

---

## 2. 수정 필요 사항 및 설계

### 2.1 버전 필드 제거

#### 변경 전
```typescript
// Request
{
  file: File,
  product_code: string,
  version: string,        // ← 제거
  field_mappings: FieldMappings
}
```

#### 변경 후
```typescript
// Request
{
  file: File,
  product_code: string,
  field_mappings: FieldMappings
}
```

#### 영향 범위
- **Preview API**: `selectedVersion` 파라미터 제거
- **Commit API**: `version` 파라미터 제거
- **DB**: `translation_products.version`, `glossary_products.version` 는 유지하되 null로 저장
- **Excel 파싱**: Sheet 선택 로직 제거 (첫 번째 시트만 사용)

---

### 2.2 버전별 매칭 제약 (핵심 검증 로직)

#### 요구사항
> 첫 번째 버전 컬럼 매칭 후 두 번째 버전은 같은 시스템 필드에 매칭 불가

#### 설계

```typescript
// FieldMappings 구조
interface FieldMappings {
  source: string | null;        // 원문 컬럼명
  translations: string[];       // 번역 컬럼명 배열
  metadata: {
    context?: string;           // 문맥 컬럼명
    product_category?: string;  // 제품 카테고리 컬럼명
    platform?: string;          // 플랫폼 컬럼명
    version?: string;           // ← 제거
  };
}
```

#### 검증 로직 (Preview API)

```typescript
// 1. 중복 언어 매핑 검증
function validateFieldMappings(fieldMappings: FieldMappings): ValidationResult {
  const errors: string[] = [];
  
  // 번역 컬럼에서 감지된 언어 코드 추출
  const detectedLanguages = new Map<string, string>(); // langCode -> columnName
  
  for (const columnName of fieldMappings.translations) {
    const langCode = detectLanguageFromColumn(columnName);
    
    if (detectedLanguages.has(langCode)) {
      errors.push(
        `언어 "${langCode}"는 이미 "${detectedLanguages.get(langCode)}" 컬럼에 매핑되어 있습니다. ` +
        `"${columnName}" 컬럼은 같은 언어로 매핑할 수 없습니다.`
      );
    } else {
      detectedLanguages.set(langCode, columnName);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    detectedLanguages: Object.fromEntries(detectedLanguages)
  };
}
```

#### 에러 응답
```typescript
// 400 Bad Request
{
  error: '필드 매핑 검증 실패',
  code: 'DUPLICATE_LANGUAGE_MAPPING',
  details: [
    {
      type: 'duplicate_language',
      language: 'ko',
      columns: ['KO Translation', 'Korean Text']
    }
  ]
}
```

---

### 2.3 필드 매핑 검증

#### 요구사항
> 매핑되지 않는 데이터는 업데이트되지 않음

#### 설계

```typescript
interface PreviewEntry {
  id: string;
  source_text: string;
  context?: string;
  translations: Record<string, string>;  // 매핑된 언어만 포함
  mapped_fields: {
    source: boolean;           // 원문 매핑 여부
    translations: string[];    // 매핑된 언어 코드
    context: boolean;          // 문맥 매핑 여부
    product: boolean;          // 제품 매핑 여부
    platform: boolean;         // 플랫폼 매핑 여부
  };
  unmapped_columns: string[];  // 매핑되지 않은 컬럼 목록
  suggested_category: 'glossary' | 'translation';
}
```

#### 검증 로직
```typescript
function validateDataMapping(
  row: ImportRow,
  fieldMappings: FieldMappings
): DataValidationResult {
  const warnings: string[] = [];
  
  // 필수 필드 검증
  if (!row.source_text?.trim()) {
    return { isValid: false, error: '원문이 비어있습니다.' };
  }
  
  // 매핑되지 않은 데이터 감지
  const rowColumns = Object.keys(row);
  const mappedColumns = [
    fieldMappings.source,
    ...fieldMappings.translations,
    ...Object.values(fieldMappings.metadata).filter(Boolean)
  ].filter(Boolean);
  
  const unmappedColumns = rowColumns.filter(col => !mappedColumns.includes(col));
  
  if (unmappedColumns.length > 0) {
    warnings.push(`매핑되지 않은 컬럼: ${unmappedColumns.join(', ')}`);
  }
  
  return {
    isValid: true,
    warnings,
    unmappedColumns
  };
}
```

---

### 2.4 분류 단계 API (4단계 처리)

#### 새로운 Action 타입
```typescript
type MigrationAction = 
  | 'import'      // 번역/용어집으로 임포트
  | 'skip'        // 무시 (중복 등)
  | 'glossary'    // 용어집으로 분류
  | 'delete';     // 휴지통 (제외)

interface CommitEntry {
  id: string;
  source_text: string;
  context?: string;
  translations: Record<string, string>;
  category: 'glossary' | 'translation';
  action: MigrationAction;
}
```

#### Preview Response 구조
```typescript
interface PreviewResponse {
  entries: PreviewEntry[];
  summary: {
    total: number;
    by_category: {
      glossary_suggested: number;
      translation_suggested: number;
    };
    by_duplicate_status: {
      exact: number;
      similar: number;
      new: number;
    };
    by_confidence: {
      high: number;    // 단어 수 기준 확실한 분류
      medium: number;  // 검토 필요
    };
  };
  validation: {
    is_valid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
  };
}

interface ValidationError {
  type: 'duplicate_language' | 'missing_source' | 'invalid_mapping';
  message: string;
  columns?: string[];
}

interface ValidationWarning {
  type: 'unmapped_columns' | 'empty_translations' | 'similar_detected';
  message: string;
  row_ids?: string[];
}
```

---

### 2.5 Commit 로직 상세 설계

#### 처리 흐름

```
[Commit API]
    ↓
1. entries.groupBy(category, action)
    ↓
2. Action별 처리:
   ├─ 'import' + 'translation' → createTranslation()
   ├─ 'import' + 'glossary' → createGlossary()
   ├─ 'glossary' + 'translation' → createGlossary()  // 카테고리 변경
   ├─ 'skip' → continue
   └─ 'delete' → continue (아무것도 안함)
    ↓
3. Product 연결
   ├─ translation_products INSERT
   └─ glossary_products INSERT
    ↓
4. Audit Log 기록
    ↓
[Response]
```

#### Commit Request 구조
```typescript
interface CommitRequest {
  entries: CommitEntry[];
  product_code: ProductCode;
  // version 제거됨
}

interface CommitEntry {
  id: string;
  source_text: string;
  context?: string;
  translations: Record<string, string>;
  category: 'glossary' | 'translation';
  action: MigrationAction;
  // 메타데이터 (선택적)
  product?: string;
  platform?: string;
  key?: string;
  note?: string;
}
```

#### Commit Response 구조
```typescript
interface CommitResponse {
  success: boolean;
  batch_id?: string;
  results: {
    glossary: {
      created: number;
      skipped: number;
      errors: MigrationError[];
    };
    translations: {
      created: number;
      updated: number;
      skipped: number;
      errors: MigrationError[];
    };
  };
}

interface MigrationError {
  row_id: string;
  source_text: string;
  message: string;
}
```

---

## 3. 공통 API 사용 가능 여부 분석

### 3.1 기존 API 재사용 가능성

| API | 재사용 가능 | 설명 |
|-----|------------|------|
| `POST /api/translations/create` | ❌ 불가능 | 마이그레이션은 batch 처리 + product 연결 필요 |
| `POST /api/glossary/create` | ❌ 불가능 | 마이그레이션은 batch 처리 + product 연결 필요 |
| `POST /api/glossary/import` | ⚠️ 참고 가능 | Excel 파싱 로직 참고 |

### 3.2 마이그레이션 전용 API 필요 이유

1. **Batch 처리**: 대량 데이터 트랜잭션 처리 필요
2. **Product 연결**: translation_products/glossary_products 테이블 동시 INSERT
3. **Audit Log**: migration 전용 로그 기록
4. **Rollback 지원**: operation_batches 테이블 연동
5. **복잡한 매핑**: field_mappings 기반 데이터 변환

### 3.3 내부 유틸리티 함수 분리

```typescript
// lib/migration/translation-handler.ts
export async function createTranslationWithProducts(
  supabase: SupabaseClient,
  entry: CommitEntry,
  productCode: ProductCode,
  userId: string
): Promise<TranslationResult>;

// lib/migration/glossary-handler.ts
export async function createGlossaryWithProducts(
  supabase: SupabaseClient,
  entry: CommitEntry,
  productCode: ProductCode,
  userId: string
): Promise<GlossaryResult>;

// lib/migration/validation.ts
export function validateFieldMappings(
  fieldMappings: FieldMappings
): ValidationResult;

export function validateDuplicateLanguageMapping(
  translations: string[]
): DuplicateCheckResult;
```

---

## 4. 에러 처리 설계

### 4.1 에러 코드 정의

```typescript
enum MigrationErrorCode {
  // 검증 에러
  DUPLICATE_LANGUAGE_MAPPING = 'DUPLICATE_LANGUAGE_MAPPING',
  MISSING_SOURCE_FIELD = 'MISSING_SOURCE_FIELD',
  INVALID_FIELD_MAPPING = 'INVALID_FIELD_MAPPING',
  
  // 파일 처리 에러
  FILE_PARSE_ERROR = 'FILE_PARSE_ERROR',
  UNSUPPORTED_FILE_TYPE = 'UNSUPPORTED_FILE_TYPE',
  EMPTY_FILE = 'EMPTY_FILE',
  
  // 데이터 에러
  NO_VALID_DATA = 'NO_VALID_DATA',
  REQUIRED_FIELD_MISSING = 'REQUIRED_FIELD_MISSING',
  
  // 커밋 에러
  PARTIAL_COMMIT_FAILED = 'PARTIAL_COMMIT_FAILED',
  BATCH_CREATE_FAILED = 'BATCH_CREATE_FAILED',
  
  // 권한 에러
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_PRODUCT_CODE = 'INVALID_PRODUCT_CODE'
}
```

### 4.2 에러 응답 형식

```typescript
// 단일 에러
{
  error: '필드 매핑 검증 실패',
  code: 'DUPLICATE_LANGUAGE_MAPPING',
  details: {
    language: 'ko',
    columns: ['KO Translation', 'Korean Text']
  }
}

// 복수 에러 (Preview)
{
  validation: {
    is_valid: false,
    errors: [
      {
        type: 'DUPLICATE_LANGUAGE_MAPPING',
        message: '언어 "ko"가 중복 매핑되었습니다.',
        columns: ['KO Translation', 'Korean Text']
      },
      {
        type: 'MISSING_SOURCE_FIELD',
        message: '원문 필드가 매핑되지 않았습니다.'
      }
    ]
  }
}

// 커밋 실패 (부분 성공)
{
  success: false,
  code: 'PARTIAL_COMMIT_FAILED',
  results: {
    glossary: { created: 10, skipped: 2, errors: [] },
    translations: { 
      created: 5, 
      updated: 0, 
      skipped: 0, 
      errors: [
        { row_id: 'uuid-123', source_text: 'Hello', message: 'DB constraint violation' }
      ] 
    }
  }
}
```

---

## 5. 데이터베이스 스키마 변경사항

### 5.1 현재 스키마 (변경 없음)

```sql
-- translations 테이블
CREATE TABLE translations (
  id UUID PRIMARY KEY,
  source_text TEXT NOT NULL,
  context TEXT,
  version TEXT,          -- 유지 (null 허용)
  is_migrated BOOLEAN DEFAULT FALSE,
  ...
);

-- translation_products 테이블
CREATE TABLE translation_products (
  id UUID PRIMARY KEY,
  translation_id UUID REFERENCES translations(id),
  product_code TEXT,
  version TEXT,          -- 유지 (null 허용)
  version_updated_at TIMESTAMP
);

-- glossary_products 테이블
CREATE TABLE glossary_products (
  id UUID PRIMARY KEY,
  glossary_id UUID REFERENCES glossary(id),
  product_code TEXT,
  version TEXT,          -- 유지 (null 허용)
  version_updated_at TIMESTAMP
);
```

### 5.2 version 필드 처리 방식

| 테이블 | 현재 | 변경 후 |
|--------|------|---------|
| translations.version | 사용 중 | null로 저장 |
| translation_products.version | 사용 중 | null로 저장 |
| glossary_products.version | 사용 중 | null로 저장 |

> **참고**: version 필드는 스키마에서 제거하지 않고, 마이그레이션 시 null로 저장하여 향후 확장성 유지

---

## 6. API 엔드포인트 최종 명세

### 6.1 POST /api/migration/preview

**Request**:
```typescript
Content-Type: multipart/form-data

{
  file: File,              // CSV or Excel
  product_code: string,    // 선택된 제품 코드
  field_mappings: string   // JSON 직렬화된 FieldMappings
}
```

**Response (200 OK)**:
```typescript
{
  entries: PreviewEntry[];
  summary: PreviewSummary;
  validation: ValidationResult;
}
```

**Response (400 Bad Request)**:
```typescript
{
  error: string;
  code: MigrationErrorCode;
  details?: unknown;
}
```

### 6.2 POST /api/migration/commit

**Request**:
```typescript
Content-Type: application/json

{
  entries: CommitEntry[];
  product_code: string;
}
```

**Response (200 OK)**:
```typescript
{
  success: true;
  batch_id: string;
  results: {
    glossary: { created: number; skipped: number; errors: MigrationError[] };
    translations: { created: number; updated: number; skipped: number; errors: MigrationError[] };
  }
}
```

**Response (207 Multi-Status - 부분 성공)**:
```typescript
{
  success: false;
  code: 'PARTIAL_COMMIT_FAILED';
  results: /* 위와 동일 */;
}
```

---

## 7. 클라이언트-서버 데이터 흐름

### 7.1 전체 흐름도

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Side                              │
└─────────────────────────────────────────────────────────────────┘
   │
   │ 1. 파일 선택 + 필드 매핑 설정
   ▼
┌─────────────────────────────────────────────────────────────────┐
│  POST /api/migration/preview                                     │
│  { file, product_code, field_mappings }                          │
└─────────────────────────────────────────────────────────────────┘
   │
   │ 2. 검증 결과 + 미리보기 데이터
   ▼
┌─────────────────────────────────────────────────────────────────┐
│  사용자 검토 UI                                                  │
│  - 중복/유사 데이터 표시                                          │
│  - 분류 확인/수정 (용어집 ↔ 번역)                                  │
│  - 행별 action 선택 (import/skip/glossary/delete)                 │
└─────────────────────────────────────────────────────────────────┘
   │
   │ 3. 검증 완료된 entries
   ▼
┌─────────────────────────────────────────────────────────────────┐
│  POST /api/migration/commit                                      │
│  { entries, product_code }                                       │
└─────────────────────────────────────────────────────────────────┘
   │
   │ 4. 처리 결과
   ▼
┌─────────────────────────────────────────────────────────────────┐
│  결과 페이지                                                     │
│  - 성공/실패 카운트                                               │
│  - 에러 상세 내역                                                 │
│  - 롤백 옵션 (batch_id 기반)                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. 구현 체크리스트

### 8.1 Preview API 수정

- [ ] `selectedVersion` 파라미터 제거
- [ ] `detectLanguageFromSamples` 중복 언어 검증 추가
- [ ] `validateFieldMappings` 함수 구현
- [ ] 매핑되지 않은 컬럼 감지 로직 추가
- [ ] 응답에 `mapped_fields`, `unmapped_columns` 포함

### 8.2 Commit API 수정

- [ ] `version` 파라미터 제거
- [ ] Action 타입 변경 (`import`/`skip`/`glossary`/`delete`)
- [ ] `createTranslationWithProducts` 내부 함수 구현
- [ ] `createGlossaryWithProducts` 내부 함수 구현
- [ ] 부분 성공 시 207 상태 코드 반환

### 8.3 유틸리티 함수 분리

- [ ] `lib/migration/types.ts` - 타입 정의
- [ ] `lib/migration/validation.ts` - 검증 로직
- [ ] `lib/migration/parsers.ts` - CSV/Excel 파싱
- [ ] `lib/migration/translation-handler.ts` - 번역 처리
- [ ] `lib/migration/glossary-handler.ts` - 용어집 처리

### 8.4 테스트 시나리오

- [ ] 중복 언어 매핑 시도 시 에러 반환
- [ ] 매핑되지 않은 컬럼 경고 표시
- [ ] 'glossary' action 처리 확인
- [ ] 'delete' action 처리 확인
- [ ] version 필드 null 저장 확인
- [ ] Product 연결 정상 작동 확인

---

## 9. 마이그레이션 정책 결정사항

### 9.1 Version 정보 처리

| 옵션 | 설명 | 결정 |
|------|------|------|
| A. 완전 제거 | DB 컬럼 삭제 | ❌ 기존 데이터 호환성 문제 |
| B. null 저장 | 컬럼 유지, 마이그레이션 시 null | ✅ 채택 |
| C. 파일명 추출 | 업로드 파일명을 version으로 | ❌ 요구사항 미부합 |

### 9.2 중복 데이터 처리

| 상황 | 동작 |
|------|------|
| Exact Duplicate | 사용자가 action 선택 (기본값: skip) |
| Similar Detected | 유사도 표시, 사용자가 action 선택 |
| New Entry | 기본값: import |

### 9.3 롤백 지원

- operation_batches 테이블 활용
- batch_id 기반 롤백 API 별도 존재 (`/api/rollback/:batchId`)

---

## 10. 참고사항

### 10.1 기존 마이그레이션과의 호환성
- 기존 마이그레이션 데이터 (is_migrated=true)는 영향 없음
- 새로운 마이그레이션만 변경된 로직 적용

### 10.2 성능 고려사항
- Preview: 기존과 동일 (파싱 + 중복체크)
- Commit: Batch INSERT 유지
- 대용량 파일: 스트리밍 파싱 고려 (추후 개선)

### 10.3 보안 고려사항
- File type 검증 유지
- File size 제한 유지
- User 권한 체크 유지
