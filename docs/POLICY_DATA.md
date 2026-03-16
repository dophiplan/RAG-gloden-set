# 🗄️ 데이터 정책
## Data Policy for Migration & Integrity

**버전:** 1.0  
**생성일:** 2026-03-15  
**책임자:** @data

---

## 🎯 목적

- 데이터 정합성 보장
- 마이그레이션 안전성
- 데이터 유실 방지
- 롤백 가능성 확보

---

## 📊 데이터 원칙

### 1. 단일 진실 공급원 (Single Source of Truth)
```yaml
현재: Supabase (PostgreSQL)
전환 중: SQLite (개발/테스트)
목표: SQLite (전체) - 선택적

원칙:
- Dual Write: Supabase가 Source of Truth
- Full Cutover: SQLite가 Source of Truth
- 항상 하나의 시스템이 권위 있음
```

### 2. 데이터 일관성
```typescript
// ✅ 트랜잭션 사용
await db.transaction(async (trx) => {
  await trx.insert('users', userData);
  await trx.insert('audit_logs', auditData);
});

// ✅ 제약조건 활용
// FOREIGN KEY, UNIQUE, NOT NULL 등
```

### 3. 데이터 검증
```typescript
// ✅ 입력 검증
function validateUser(data: unknown): User {
  const schema = z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string().min(1).max(100),
  });
  return schema.parse(data);
}

// ✅ 출력 검증
function sanitizeUser(user: User): SafeUser {
  const { password, ...safe } = user;
  return safe;
}
```

---

## 🔄 마이그레이션 정책

### Pilot Phase별 데이터 처리

#### Phase 1: Shadow Mode
```yaml
동작: Legacy만 쓰기, Provider는 읽기만
데이터 흐름:
  쓰기: Client → Legacy (Supabase)
  읽기: Client → Legacy (Supabase)
  검증: Legacy 결과 ↔ Provider 결과 비교

데이터 정합성:
  - Provider 데이터는 참조용
  - 불일치 시 로깅만, 수정 없음
```

#### Phase 2: Dark Launch
```yaml
동작: Legacy만 사용, Provider는 병렬 실행
데이터 흐름:
  쓰기: Client → Legacy (Supabase)
  읽기: Client → Legacy (Supabase)
  검증: Legacy 응답 ↔ Provider 응답 비교

데이터 정합성:
  - Provider 결과는 폐기
  - 성능/정확도 메트릭 수집
```

#### Phase 3: Dual Write
```yaml
동작: 양쪽 모두 쓰기
데이터 흐름:
  쓰기: Client → Legacy + Provider
  읽기: Client → Legacy (Source of Truth)
  복구: 실패 시 큐에 저장 후 재시도

데이터 정합성:
  - Legacy 실패: 전체 롤백
  - Provider 실패: Legacy 유지, 복구 큐
  - 모니터링: 불일치 알림
```

#### Phase 4: Full Cutover
```yaml
동작: Provider만 사용
데이터 흐름:
  쓰기: Client → Provider (SQLite)
  읽기: Client → Provider (SQLite)
  폰백: Provider 실패 시 Legacy

데이터 정합성:
  - Provider가 Source of Truth
  - Legacy는 읽기 전용 백업
  - 정기적 데이터 동기화 검증
```

---

## ✅ 데이터 체크리스트

### 마이그레이션 전
```markdown
□ 스키마 호환성 검증
□ 데이터 타입 매핑 확인
□ 인덱스/제약조건 일치
□ 샘플 데이터 검증
□ 롤백 절차 확인
□ 백업 완료
```

### 마이그레이션 중
```markdown
□ 진행률 모니터링
□ 에러 로그 실시간 확인
□ 데이터 정합성 샘플링
□ 성능 메트릭 확인
```

### 마이그레이션 후
```markdown
□ 전체 레코드 수 일치
□ 체크섬 비교
□ 핵심 쿼리 성능 테스트
□ 롤백 테스트
□ 모니터링 (24시간)
```

---

## 🔍 데이터 검증 방법

### 1. 레코드 수 비교
```typescript
async function validateRecordCount(): Promise<boolean> {
  const supabaseCount = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true });
    
  const sqliteCount = await sqlite
    .prepare('SELECT COUNT(*) as count FROM users')
    .get();
    
  return supabaseCount.count === sqliteCount.count;
}
```

### 2. 샘플링 검증
```typescript
async function validateSampling(sampleSize: number = 100): Promise<ValidationResult> {
  const samples = await supabase
    .from('users')
    .select('*')
    .limit(sampleSize);
    
  const results = await Promise.all(
    samples.data.map(async (record) => {
      const sqliteRecord = await sqlite
        .prepare('SELECT * FROM users WHERE id = ?')
        .get(record.id);
      return compareRecords(record, sqliteRecord);
    })
  );
  
  return {
    total: samples.length,
    matched: results.filter(r => r.matches).length,
    mismatched: results.filter(r => !r.matches),
  };
}
```

### 3. 체크섬 비교
```typescript
async function validateChecksum(table: string): Promise<boolean> {
  const supabaseHash = await calculateHash(supabase, table);
  const sqliteHash = await calculateHash(sqlite, table);
  return supabaseHash === sqliteHash;
}

async function calculateHash(db: Database, table: string): Promise<string> {
  const records = await db.select(table).order('id');
  const content = JSON.stringify(records);
  return crypto.createHash('md5').update(content).digest('hex');
}
```

---

## 📦 데이터 백업

### 정책
```yaml
백업 주기:
  프로덕션: 매일 02:00 KST
  스테이징: 매주 일요일
  개발: 수동

보관 기간:
  일일 백업: 7일
  주간 백업: 4주
  월간 백업: 12개월

암호화:
  저장: AES-256
  전송: TLS 1.3
```

### 백업 스크립트
```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/${DATE}"

# Supabase 백업
pg_dump $DATABASE_URL > "${BACKUP_DIR}/supabase.sql"

# SQLite 백업
cp data/production.db "${BACKUP_DIR}/sqlite.db"

# 압축 및 암호화
tar -czf - "${BACKUP_DIR}" | gpg --symmetric --cipher-algo AES256 \
  --output "${BACKUP_DIR}.tar.gz.gpg"

# 원격 저장소 업로드
aws s3 cp "${BACKUP_DIR}.tar.gz.gpg" s3://backups/

# 로컬 정리
rm -rf "${BACKUP_DIR}"
```

---

## 🚨 데이터 유실 대응

### 복구 우선순위
| 순위 | 데이터 | RTO | RPO |
|------|--------|-----|-----|
| 1 | 사용자 데이터 | 1시간 | 5분 |
| 2 | 번역 데이터 | 4시간 | 1시간 |
| 3 | 감사 로그 | 24시간 | 24시간 |
| 4 | 분석 데이터 | 72시간 | 24시간 |

### 복구 절차
```
1. 유실 범위 확인
   ↓
2. 마지막 백업 확인
   ↓
3. 백업 복원
   ↓
4. 데이터 검증
   ↓
5. 누락 데이터 수동 복구 (필요 시)
   ↓
6. 서비스 재개
   ↓
7. 사후 검토
```

---

## 📈 데이터 메트릭

### 모니터링 항목
```yaml
정합성:
  - 레코드 수 불일치
  - 체크섬 불일치
  - 샘플링 불일치

성능:
  - 쿼리 응답 시간
  - 동시 연결 수
  - 디스크 사용량

안정성:
  - 백업 성공률
  - 복구 시간
  - 데이터 유실 이벤트
```

### 알림 설정
```yaml
Critical:
  - 레코드 수 불일치 > 1%
  - 백업 실패
  - 복구 시간 > RTO

Warning:
  - 체크섬 불일치 > 0.1%
  - 디스크 사용 > 80%
  - 응답 시간 > 1s (p95)
```

---

## 📚 참고 문서
- [PILOT_MIGRATION_GUIDE.md](./PILOT_MIGRATION_GUIDE.md)
- [AGENTS_TEAM.md](./AGENTS_TEAM.md)
- [POLICY_SECURITY.md](./POLICY_SECURITY.md)
