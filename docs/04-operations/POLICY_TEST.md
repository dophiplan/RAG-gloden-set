# 🧪 테스트 정책
## Testing Policy for Quality Assurance

**버전:** 1.0  
**생성일:** 2026-03-15  
**책임자:** @qa

---

## 🎯 목표

- 코드 품질 보장
- 회귀 버그 예방
- 문서화된 동작
- 자동화된 검증

---

## 📊 테스트 피라미드

```
       ▲
      / \
     / E2E \      (10%) - 사용자 시나리오
    /-------\
   /Integration\   (30%) - API, DB 통합
  /-------------\
 /   Unit Test   \ (60%) - 함수/클스 단위
/-------------------\
```

---

## 🧪 테스트 유형

### 1. 단위 테스트 (Unit Test)

**대상:** 함수, 클래스, 유틸리티

```typescript
// ✅ 좋은 예: 순수 함수 테스트
describe('validateUser', () => {
  it('should return true for valid user', () => {
    const result = validateUser({ email: 'test@example.com', name: 'John' });
    expect(result.valid).toBe(true);
  });
  
  it('should return false for invalid email', () => {
    const result = validateUser({ email: 'invalid', name: 'John' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Invalid email');
  });
  
  it('should handle null input', () => {
    const result = validateUser(null);
    expect(result.valid).toBe(false);
  });
});
```

**커버리지 목표:** 80%+

---

### 2. 통합 테스트 (Integration Test)

**대상:** API 엔드포인트, DB 연동, 외부 서비스

```typescript
// ✅ 좋은 예: API 테스트
describe('POST /api/users', () => {
  it('should create user and return 201', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ email: 'test@example.com', name: 'John' });
      
    expect(response.status).toBe(201);
    expect(response.body.id).toBeDefined();
    
    // DB 검증
    const user = await db.query('SELECT * FROM users WHERE email = ?', ['test@example.com']);
    expect(user).toBeDefined();
  });
  
  it('should return 400 for invalid data', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ email: 'invalid' });
      
    expect(response.status).toBe(400);
  });
});
```

**커버리지 목표:** 핵심 API 100%

---

### 3. E2E 테스트 (End-to-End)

**대상:** 사용자 시나리오, 워크플로우

```typescript
// ✅ 좋은 예: 사용자 시나리오
describe('User Registration Flow', () => {
  it('should complete full registration', async () => {
    // 1. 회원가입
    const register = await request(app)
      .post('/api/auth/register')
      .send({ email: 'user@test.com', password: 'password123' });
    expect(register.status).toBe(201);
    
    // 2. 로그인
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@test.com', password: 'password123' });
    expect(login.status).toBe(200);
    
    // 3. 프로필 조회
    const profile = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(profile.status).toBe(200);
  });
});
```

---

## ✅ 테스트 작성 원칙

### AAA 패턴
```typescript
describe('Feature', () => {
  it('should work correctly', () => {
    // Arrange (준비)
    const input = { email: 'test@example.com' };
    
    // Act (실행)
    const result = validateEmail(input);
    
    // Assert (검증)
    expect(result.valid).toBe(true);
  });
});
```

### FIRST 원칙
- **F**ast: 빠르게 실행
- **I**ndependent: 독립적 실행
- **R**epeatable: 반복 가능
- **S**elf-validating: 자동 검증
- **T**imely: 코드 작성 시 함께

---

## 🎭 Mocking 규칙

### 외부 의존성 Mock
```typescript
// ✅ 데이터베이스 Mock
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  })),
}));

// ✅ 외부 API Mock
vi.mock('axios', () => ({
  default: {
    post: vi.fn().mockResolvedValue({ data: { success: true } }),
  },
}));
```

### Mock 사용 시 주의
```typescript
// ❌ 과도한 Mock - 실제 동작과 달라짐
vi.mock('./database', () => ({
  query: vi.fn().mockResolvedValue({}), // 너무 추상적
}));

// ✅ 적절한 Mock - 실제와 유사한 동작
vi.mock('./database', () => ({
  query: vi.fn((sql, params) => {
    if (sql.includes('SELECT')) {
      return Promise.resolve([{ id: 1, name: 'Test' }]);
    }
    return Promise.resolve({ affectedRows: 1 });
  }),
}));
```

---

## 📈 커버리지 정책

### 목표 커버리지
| 유형 | 최소 | 목표 |
|------|------|------|
| 라인 커버리지 | 70% | 80% |
| 함수 커버리지 | 80% | 90% |
| 브랜치 커버리지 | 60% | 75% |

### 예외 처리
```yaml
커버리지 예외:
  - UI 컴포넌트 (Visual 테스트로 대체)
  - Third-party 라이브러리 래퍼
  - Deprecated 코드
  - 
허용 절차:
  1. PR 설명에 예외 사유 기록
  2. @qa 승인
  3. 대체 테스트 계획 명시
```

---

## 🔄 테스트 실행

### 로컬 개발
```bash
# 파일 변경 시 자동 실행
npm run test:watch

# 특정 테스트
npm run test -- shadow-mode

# 커버리지 포함
npm run test:coverage
```

### CI/CD
```bash
# 전체 테스트
npm run test:ci

# 통합 테스트만
npm run test:integration

# 단위 테스트만
npm run test:unit
```

---

## 🚨 테스트 실패 처리

### 단계별 대응

**1단계: 확인**
```bash
# 실패 테스트 재실행
npm run test -- --run shadow-mode.test.ts

# 플래키 테스트 확인
npm run test -- --run --reporter=verbose
```

**2단계: 분류**
```
□ 테스트 코드 문제 → 테스트 수정
□ 제품 코드 문제 → 제품 코드 수정
□ 환경 문제 → 환경 설정 수정
□ 플래키 테스트 → 안정화 또는 제거
```

**3단계: 조치**
```bash
# 테스트 수정
git add shadow-mode.test.ts
git commit -m "test(pilot): Fix flaky Shadow Mode test"

# 제품 코드 수정
git add shadow-mode.ts
git commit -m "fix(pilot): Correct Shadow Mode logic"
```

---

## 📋 테스트 체크리스트

### 테스트 작성 시
```markdown
□ 성공 케이스
□ 실패 케이스
□ 경계값 (null, empty, max)
□ 예외 상황
□ 비동기 처리
□ Mock 적절성
```

### 테스트 리뷰 시
```markdown
□ 테스트가 요구사항을 검증하는가?
□ 독립적으로 실행 가능한가?
□ 적절한 수준의 Mocking인가?
□ 커버리지 기준을 충족하는가?
□ 명확한 이름을 가지는가?
```

---

## 🏷️ 테스트 네이밍

### 좋은 이름의 예
```typescript
// ✅ 명확하고 구체적
describe('UserService', () => {
  describe('createUser', () => {
    it('should create user with valid email and name', () => {});
    it('should throw error when email already exists', () => {});
    it('should throw validation error for invalid email format', () => {});
    it('should trim whitespace from name before saving', () => {});
  });
});

// ❌ 모호함
describe('UserService', () => {
  it('works correctly', () => {});
  it('handles errors', () => {});
  it('test 1', () => {});
});
```

---

## 📚 참고 문서
- [Testing Library](https://testing-library.com/)
- [Vitest](https://vitest.dev/)
- [PILOT_TEST_001.md](./PILOT_TEST_001.md)
- [AGENTS_TEAM.md](./AGENTS_TEAM.md)
