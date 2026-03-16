# 📋 작업 표준 정책 (SOP - Standard Operating Procedure)
## Standard Operating Procedure for All Development Activities

**버전:** 1.0  
**생성일:** 2026-03-15  
**적용 범위:** 모든 코드 변경, 리뷰, 배포 활동

---

## 🎯 목적

모든 팀원이 **일관된 방식**으로 작업하여:
- 코드 품질 유지
- 협업 효율 극대화
- 버그/장애 예방
- 빠른 롤백 가능

---

## 📌 필수 준수사항 (MUST)

### 1. 작업 시작 전 (Before)

#### 1.1 일정 산정
```
□ 작업 범위 정의
□ 예상 소요 시간 산정 (±20% 버퍼 포함)
□ 의존성 작업 파악
□ 블로커 식별
```

**템플릿:**
```markdown
## 작업 계획
- **작업명:** 
- **예상 소요:** X시간
- **의존성:** #티켓번호
- **블로커:** 없음 / 있음 (설명)
- **리스크:** 낮음/중간/높음
```

#### 1.2 브랜치 전략
```bash
# 필수: main에서 분기
git checkout main
git pull origin main
git checkout -b feature/티켓번호-설명

# 금지: 직접 main 커밋
git commit -m "..."  # ❌ main에서 직접
```

#### 1.3 사전 검증
```
□ npm run type-check  # 0개 에러 확인
□ npm run lint        # 0개 에러 확인
□ npm run build       # 성공 확인
```

---

### 2. 작업 중 (During)

#### 2.1 코드 작성 규칙

**타입 안전성:**
```typescript
// ✅ 필수: any 사용 금지
function process(data: any) { }  // ❌

// ✅ 필수: 구체적인 타입 사용
function process(data: UserData) { }  // ✅
```

**에러 핸들링:**
```typescript
// ✅ 필수: 모든 비동기 함수 try-catch
try {
  await operation();
} catch (error) {
  logger.error('Operation failed', error);
  throw new AppError('사용자 친화적 메시지', error);
}
```

**로깅:**
```typescript
// ✅ 필수: 모든 외부 호출 로깅
logger.info('API 호출 시작', { endpoint, params });
logger.info('API 호출 완료', { endpoint, duration });
logger.error('API 호출 실패', error, { endpoint });
```

#### 2.2 테스트 작성
```
□ 단위 테스트: 핵심 로직 1개 이상
□ 통합 테스트: API 엔드포인트 1개 이상
□ 실패 케이스: 최소 1개
```

**예시:**
```typescript
describe('Feature', () => {
  it('should work correctly', () => { });  // 성공
  it('should handle error', () => { });    // 실패
  it('should handle edge case', () => { }); // 경계
});
```

#### 2.3 중간 커밋
```bash
# ✅ 권장: 작은 단위로 자주 커밋
git commit -m "feat: Add user validation logic"
git commit -m "fix: Handle null pointer exception"
git commit -m "test: Add unit tests for validation"
```

---

### 3. 작업 완료 후 (After)

#### 3.1 최종 검증 (6단계)

```bash
# Step 1: 타입 체크
npm run type-check
# 결과: 0 errors

# Step 2: 린트
npm run lint
# 결과: 0 errors, 0 warnings

# Step 3: 테스트
npm run test
# 결과: 90% 이상 통과

# Step 4: 빌드
npm run build
# 결과: Compiled successfully

# Step 5: 보안 스캔
npm audit
# 결과: 0 critical, 0 high

# Step 6: 데이터 검증 (해당 시)
npm run test:data-integrity
# 결과: 정합성 99.9% 이상
```

#### 3.2 PR 작성

**필수 항목:**
```markdown
## 📋 변경사항
- 변경 내용 요약

## ✅ 검증 결과
- [ ] Type Check: 0 errors
- [ ] Build: 성공
- [ ] Test: X% 통과
- [ ] Security: 0 critical

## 🧪 테스트 방법
1. ...
2. ...

## 📎 관련 티켓
- PILOT-XXX

## 🖼️ 스크린샷 (UI 변경 시)
```

#### 3.3 리뷰 요청
```
@architect @qa @security
리뷰 부탁드립니다.

핵심 변경점:
1. ...
2. ...
```

---

## 🚫 금지사항 (NEVER)

| 금지 행위 | 이유 | 대안 |
|----------|------|------|
| main 직접 커밋 | 충돌/장애 위험 | feature 브랜치 사용 |
| any 타입 사용 | 타입 안전성 상실 | 구체적인 타입 정의 |
| console.log | 프로덕션 로그 노출 | logger 사용 |
| 비밀번호 하드코딩 | 보안 취약점 | 환경 변수 사용 |
| 대용량 데이터 쿼리 | 성능 저하 | 페이지네이션/캐싱 |
| 트랜잭션 없이 다중 쓰기 | 데이터 불일치 | transaction 사용 |

---

## ✅ 체크리스트 템플릿

### 코드 작성 체크리스트
```markdown
## 코드 품질
- [ ] TypeScript any 미사용
- [ ] 모든 함수에 반환 타입 명시
- [ ] 에러 핸들링 구현
- [ ] 로깅 추가
- [ ] 단위 테스트 작성

## 보안
- [ ] SQL Injection 방지 (파라미터화)
- [ ] XSS 방지 (입력 검증)
- [ ] 인증/인가 체크
- [ ] 민감정보 로깅 금지

## 성능
- [ ] N+1 쿼리 방지
- [ ] 불필요한 리렌더링 방지
- [ ] 캐싱 적용 (해당 시)
```

### 배포 체크리스트
```markdown
## 사전 검증
- [ ] Type Check: 0 errors
- [ ] Build: 성공
- [ ] Test: 90%+ 통과
- [ ] Security: 0 critical/high

## 배포 중
- [ ] Feature Flag 비활성화 상태 확인
- [ ] 롤백 절차 확인
- [ ] 모니터링 대시보드 확인

## 배포 후
- [ ] 헬스체크 API 정상 응답
- [ ] 에러 로그 모니터링 (10분)
- [ ] 핵심 기능 수동 테스트
```

---

## 🔄 예외 처리

### 긴급 배포 (Hotfix)
```
1. main에서 hotfix 브랜치 생성
2. 최소한의 수정
3. 2인 이상 리뷰 (필수)
4. QA 빠르게 통과
5. 배포 후 30분 모니터링
```

### 테스트 실패 허용
```
조건:
- 90% 이상 통과
- 실패 테스트가 Legacy 코드
- PILOT-TEST-XXX 티켓 생성

절차:
1. 티켓 생성
2. PR 설명에 기록
3. 팀 리드 승인
```

---

## 📊 위반 시 조치

| 위반 수준 | 조치 |
|----------|------|
| 경고 (1회) | 피드백, 재교육 |
| 주의 (2회) | PR 리뷰 강화 |
| 심각 (3회+) | 페어 프로그래밍 의무 |

---

## 📚 참고 문서
- [AGENTS_TEAM.md](./AGENTS_TEAM.md)
- [POLICY_COMMUNICATION.md](./POLICY_COMMUNICATION.md)
- [POLICY_QUALITY_GATE.md](./POLICY_QUALITY_GATE.md)
