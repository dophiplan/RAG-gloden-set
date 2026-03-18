# 🔒 보안 정책
## Security Policy for Development & Operations

**버전:** 1.0  
**생성일:** 2026-03-15  
**책임자:** @security

---

## 🎯 목적

- 코드 수준 보안 취약점 예방
- 데이터 유출 방지
- 인증/인가 체계 유지
- 보안 사고 대응

---

## 🚫 금지 패턴 (Critical)

### 1. SQL Injection
**금지:**
```typescript
// ❌ 문자열 연결
db.query(`SELECT * FROM users WHERE id = ${userId}`);

// ❌ 템플릿 리터럴
db.query(`SELECT * FROM users WHERE id = '${userId}'`);
```

**필수:**
```typescript
// ✅ 파라미터화 쿼리
db.query('SELECT * FROM users WHERE id = ?', [userId]);

// ✅ ORM 사용
await prisma.users.findUnique({ where: { id: userId } });
```

---

### 2. XSS (Cross-Site Scripting)
**금지:**
```typescript
// ❌ innerHTML에 사용자 입력 직접 삽입
element.innerHTML = userInput;

// ❌ dangerouslySetInnerHTML
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

**필수:**
```typescript
// ✅ React 자동 이스케이프
<div>{userInput}</div>

// ✅ DOMPurify 사용 (필요 시)
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(userInput);
```

---

### 3. 비밀번호/키 하드코딩
**금지:**
```typescript
// ❌ 코드에 비밀번호
const password = 'mySecret123!';
const apiKey = 'sk-1234567890';
```

**필수:**
```typescript
// ✅ 환경 변수
const password = process.env.DB_PASSWORD;
const apiKey = process.env.API_KEY;

// ✅ 검증
if (!process.env.DB_PASSWORD) {
  throw new Error('DB_PASSWORD is required');
}
```

---

### 4. 민감정보 로깅
**금지:**
```typescript
// ❌ 민감정보 포함 로깅
logger.info('User login', { email, password });
logger.debug('API request', { headers: { authorization } });
```

**필수:**
```typescript
// ✅ 마스킹
logger.info('User login', { email: maskEmail(email) });
logger.debug('API request', { 
  headers: { authorization: '***' } 
});

// 마스킹 함수
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local[0]}***@${domain}`;
}
```

---

## ✅ 필수 보안 체크리스트

### 코드 작성 시
```markdown
□ SQL Injection: 파라미터화 쿼리 사용
□ XSS: 사용자 입력 검증/이스케이프
□ 인증: 모든 API 엔드포인트 인증 체크
□ 인가: 권한 검증 (role-based)
□ 비밀번호: bcrypt 등 안전한 해싱
□ 세션: JWT 또는 안전한 세션 관리
□ 파일 업로드: 확장자/크기 검증
□ CORS: 허용 origin 명시적 설정
```

### 배포 전
```markdown
□ npm audit (0 critical/high)
□ .env.example 최신화
□ 민감정보 로깅 없음
□ HTTPS 강제
□ 보안 헤더 설정
```

---

## 🔐 Pilot Migration 특수 보안

### 1. Dual Write 보안
```typescript
// ✅ 트랜잭션 내에서 양쪽 모두 성공/실패
try {
  await db.transaction(async (trx) => {
    await supabaseClient.from('table').insert(data);
    await sqliteClient.insert(data);
  });
} catch (error) {
  // 하나라도 실패하면 모두 롤백
  logger.error('Dual write failed', error);
}
```

### 2. SQLite 파일 보안
```typescript
// ✅ 파일 권한 설정
fs.chmodSync(dbPath, 0o600); // 소유자만 읽기/쓰기

// ✅ 접근 로깅
logger.info('SQLite accessed', { 
  operation, 
  userId,
  timestamp: new Date().toISOString()
});
```

### 3. Feature Flag 보안
```typescript
// ✅ 관리 API 인증 강화
export async function PATCH(request: NextRequest) {
  const { user } = await getAuthUser();
  if (!user?.roles?.includes('admin')) {
    return apiUnauthorized();
  }
  // ...
}

// ✅ 변경 로그
logger.info('Feature flag changed', {
  flag: flagName,
  oldValue,
  newValue,
  changedBy: user.id,
});
```

### 4. Shadow Mode 로그
```typescript
// ✅ 민감정보 마스킹
logShadowMismatch({
  operation: 'updateUser',
  entityId: userId, // 마스킹 불필요
  legacyResult: maskSensitive(legacy),
  providerResult: maskSensitive(provider),
});
```

---

## 🛡️ 보안 스캔

### 자동화
```yaml
# GitHub Actions
- name: Security Audit
  run: npm audit --audit-level=moderate
  
- name: Secret Detection
  uses: trufflesecurity/trufflehog@main
  
- name: SAST
  uses: returntocorp/semgrep-action@v1
```

### 수동 검토
```bash
# npm audit
npm audit
npm audit fix

# secrets 검색
git log --all --full-history -- .env
grep -r "password\|secret\|key" src/ --include="*.ts"
```

---

## 🚨 보안 사고 대응

### 심각도 분류
| 레벨 | 설명 | 예시 | 대응 시간 |
|------|------|------|----------|
| Critical | 즉시 대응 필요 | 데이터 유출, RCE | 30분 |
| High | 빠른 대응 필요 | 인증 우회 | 2시간 |
| Medium | 계획적 대응 | XSS, 정보 노출 | 24시간 |
| Low | 개선 권장 | 취약한 의존성 | 다음 스프린트 |

### 대응 절차
```
1. 발견
   ↓
2. 보고 (@security @devops)
   ↓
3. 영향 범위 평가
   ↓
4. 임시 조치 (필요 시)
   ↓
5. 수정
   ↓
6. 검증
   ↓
7. 배포
   ↓
8. 사후 검토
```

---

## 📚 참고 문서
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [AGENTS_TEAM.md](./AGENTS_TEAM.md)
- [POLICY_SOP.md](./POLICY_SOP.md)
