# SQLite Migration System

Translation Manager의 SQLite 마이그레이션 시스템입니다. 로컬 개발 및 테스트 환경을 위한 경량 데이터베이스를 제공합니다.

## 개요

이 마이그레이션 시스템은 Supabase PostgreSQL 스키마를 SQLite 문법으로 변환하여 로컬 개발 환경에서 사용할 수 있게 합니다.

## 변환 규칙

| PostgreSQL | SQLite | 비고 |
|------------|--------|------|
| `UUID` | `TEXT` | UUID 문자열 저장 |
| `TIMESTAMP WITH TIME ZONE` | `TEXT` | ISO 8601 형식 (예: `2026-03-15T10:30:00.000Z`) |
| `JSONB` | `TEXT` | JSON 문자열로 저장 |
| `TEXT[]` (배열) | `TEXT` | JSON 배열 문자열로 저장 |
| `uuid_generate_v4()` | 앱에서 생성 | 애플리케이션 레벨에서 UUID 생성 |
| `auth.users` | `users` 테이블 | 별도 관리 |
| `auth.uid()` | 앱에서 처리 | 애플리케이션 레벨에서 처리 |
| RLS/POLICY | 미지원 | 주석 처리, 애플리케이션 레벨에서 권한 관리 |
| PostgreSQL 함수/트리거 | SQLite 트리거 | 가능한 경우 변환 |

## 디렉토리 구조

```
sqlite/
├── README.md                    # 이 파일
├── .gitignore                   # *.db 등 제외
├── migrations/                  # 마이그레이션 SQL 파일
│   ├── 001_initial_schema.sql   # 초기 스키마
│   ├── 002_add_audit_logs.sql   # 감사 로그 테이블
│   └── 003_seed_test_data.sql   # 개발용 테스트 데이터
└── scripts/
    └── apply-sqlite-migrations.js  # 마이그레이션 러너
```

## 사용법

### 1. 마이그레이션 실행

```bash
cd translation-manager
node sqlite/scripts/apply-sqlite-migrations.js
```

또는 특정 데이터베이스 파일 지정:

```bash
node sqlite/scripts/apply-sqlite-migrations.js ./dev.db
```

### 2. 마이그레이션 상태 확인

```bash
# _migrations 테이블 조회
sqlite3 dev.db "SELECT * FROM _migrations ORDER BY version;"
```

### 3. 롤백 (선택사항)

특정 버전으로 롤백:

```bash
node sqlite/scripts/apply-sqlite-migrations.js --rollback 001
```

## 마이그레이션 파일 작성 가이드

### 새 마이그레이션 추가

1. `migrations/` 디렉토리에 `NNN_description.sql` 형식으로 파일 생성
   - `NNN`: 3자리 숫자 (001, 002, ...)
   - `description`: 스네이크케이스 설명

2. SQL 파일 구조:

```sql
-- ============================================================================
-- Migration: 설명
-- Version: NNN
-- ============================================================================

-- Up Migration
-- ... 변경사항 SQL ...

-- Migration complete
```

### 마이그레이션 SQL 작성 시 주의사항

1. **IF NOT EXISTS 사용**: 테이블/인덱스 생성 시 기존 객체 존재 확인
2. **트랜잭션**: 각 마이그레이션은 원자적으로 실행됨
3. **외래 키**: SQLite는 외래 키 제약조건을 지원하나, `PRAGMA foreign_keys = ON;` 필요
4. **ALTER TABLE 제한**: SQLite는 제한된 ALTER TABLE만 지원
   - 열 추가: `ALTER TABLE ... ADD COLUMN ...`
   - 열 삭제/수정: 테이블 재생성 필요

## 테스트

### 테이블 생성 확인

```bash
sqlite3 dev.db ".tables"
```

### 마이그레이션 버전 확인

```bash
sqlite3 dev.db "SELECT version, name, applied_at FROM _migrations;"
```

### 스키마 확인

```bash
sqlite3 dev.db ".schema table_name"
```

## 주의사항

1. **프로덕션 사용 금지**: 이 SQLite 설정은 로컬 개발 및 테스트용입니다.
2. **RLS 미지원**: Row Level Security는 SQLite에서 지원되지 않으므로 애플리케이션 레벨에서 권한을 관리해야 합니다.
3. **동시성**: SQLite는 단일 쓰기 잠금을 사용하므로 높은 동시성이 필요한 경우 PostgreSQL을 사용하세요.
4. **백업**: `.db` 파일을 정기적으로 백업하세요.

## Supabase와의 차이점

1. **인증**: Supabase Auth 대신 로컬 인증 방식 사용
2. **실시간**: Supabase Realtime 미지원
3. **스토리지**: Supabase Storage 대신 로컬 파일 시스템 사용
4. **Edge Functions**: 지원되지 않음

## 문제 해결

### 데이터베이스 잠금 오류

```bash
# 잠금 파일 삭제
rm dev.db-shm dev.db-wal
```

### 마이그레이션 실패 시

1. `_migrations` 테이블에서 실패한 마이그레이션 확인
2. 데이터베이스 백업에서 복원 또는 처음부터 다시 생성

## 참고

- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [Supabase to SQLite Migration Guide](https://supabase.com/docs)
