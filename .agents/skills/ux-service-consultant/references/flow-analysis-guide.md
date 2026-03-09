# 플로우 분석 상세 가이드

## 1. 사용자 플로우 매핑 방법

### 1.1 페이지 단위 분석
```typescript
// 각 page.tsx 파일에서 확인할 항목:

interface PageAnalysis {
  // 1. 진입점 (Entry Points)
  entryPoints: string[];        // URL, router.push, Link
  
  // 2. 주요 액션
  actions: {
    name: string;
    trigger: 'click' | 'submit' | 'load' | 'change';
    handler: string;            // 핸들러 함수명
    destination?: string;       // 이동하는 페이지
  }[];
  
  // 3. 데이터 의존성
  dataDependencies: {
    key: string;                // SWR key 또는 query key
    endpoint: string;           // API endpoint
    usedIn: string[];           // 사용되는 컴포넌트
  }[];
  
  // 4. 상태 관리
  stateManagement: {
    local: string[];            // useState 목록
    global: string[];           // Context/SWR 목록
  };
  
  // 5. 에러 핸들링
  errorHandling: {
    hasErrorBoundary: boolean;
    hasTryCatch: boolean;
    userFeedback: string;       // 토스트/알림 여부
  };
}
```

### 1.2 컴포넌트 의존성 추적
```bash
# 특정 컴포넌트가 어디서 사용되는지 찾기
grep -r "ComponentName" src --include="*.tsx" -l

# 특정 훅이 어디서 사용되는지 찾기
grep -r "useHookName" src --include="*.ts" --include="*.tsx" -l

# 특정 API가 어디서 호출되는지 찾기
grep -r "/api/endpoint" src --include="*.ts" --include="*.tsx" -l
```

---

## 2. 끊긴 플로우 식별 체크리스트

### 2.1 네비게이션 플로우
- [ ] 메뉴 클릭 시 올바른 페이지로 이동하는가?
- [ ] 뒤로 가기 시 이전 상태가 유지되는가?
- [ ] URL 직접 접근 시 정상 동작하는가?
- [ ] 권한 없는 페이지 접근 시 리다이렉트되는가?

### 2.2 데이터 플로우
- [ ] 생성 후 리스트에 즉시 반영되는가?
- [ ] 수정 후 저장되었다는 피드백이 있는가?
- [ ] 삭제 후 리스트에서 제거되는가?
- [ ] 페이지 전환 시 데이터가 유지/갱신되는가?

### 2.3 이벤트 플로우
- [ ] 버튼 클릭 시 핸들러가 연결되어 있는가?
- [ ] 폼 제출 시 유효성 검사가 동작하는가?
- [ ] 파일 업로드 시 진행 상황이 표시되는가?
- [ ] 에러 발생 시 사용자에게 알림이 가는가?

---

## 3. 작동하지 않는 기능 식별

### 3.1 코드 패턴 검색
```bash
# 1. TODO/FIXME 주석
grep -rn "TODO\|FIXME\|XXX" src --include="*.ts" --include="*.tsx"

# 2. Not implemented 오류
 grep -rn "not implemented\|구현되지 않았습니다\|준비중" src --include="*.ts" --include="*.tsx" -i

# 3. Mock 데이터 사용처
 grep -rn "mock\|Mock" src --include="*.ts" --include="*.tsx" | grep -v "mockup\|mocking"

# 4. console.warn (개발용 경고)
grep -rn "console.warn" src --include="*.ts" --include="*.tsx"

# 5. throw new Error
 grep -rn "throw new Error" src --include="*.ts" --include="*.tsx"
```

### 3.2 플레이스홀더 UI 식별
```tsx
// 미구현 기능을 나타내는 UI 패턴:

// 1. disabled 버튼
<Button disabled tooltip="준비중입니다">

// 2. "Coming Soon" 배지
<Badge variant="secondary">Coming Soon</Badge>

// 3. 에러 토스트
showError('아직 구현되지 않았습니다');

// 4. 빈 핸들러
const handleClick = () => {
  // TODO: implement
};
```

---

## 4. 데이터 일관성 체크

### 4.1 캐싱 전략 분석
```typescript
// SWR 설정 확인
const swrConfig = {
  revalidateOnFocus,    // 포커스 시 갱신 여부
  revalidateOnReconnect, // 재연결 시 갱신 여부
  refreshInterval,      // 주기적 갱신 간격
  dedupingInterval,     // 중복 요청 제거 간격
};

// 캐시 무효화 패턴 확인
mutate(key, data, { revalidate: true });
invalidateCache(pattern);
```

### 4.2 낙관적 업데이트 체크
```typescript
// 낙관적 업데이트가 적용되어 있는지 확인:
// 1. API 호출 전 로컬 상태 변경
// 2. API 실패 시 롤백
// 3. 에러 핸들링
```

---

## 5. 출력 예시

### 예시 1: 끊긴 플로우 발견
```markdown
## 🔴 발견된 문제: 제품별 페이지 상태 필터 미동작

**위치**: `src/app/(dashboard)/translations/[product]/page.tsx:171-191`

**현재 코드**:
```tsx
{['pending', 'in_progress', 'reviewed', 'deployed'].map((status) => (
  <button
    key={status}
    className={cn(...)}
    // ← onClick 핸들러 없음!
  >
    {getStatusLabel(status)}
  </button>
))}
```

**문제**: 버튼에 onClick이 없어 필터링이 동작하지 않음

**영향**: 사용자가 상태별로 번역을 필터링할 수 없음

**수정 제안**: `setStatusFilter(status)` 연결 필요

**관련 파일**: 
- 수정: `[product]/page.tsx`
- 영향: `useTranslationFilters.ts` (필터 상태 관리)
```

### 예시 2: 미구현 기능 발견
```markdown
## 🟠 발견된 문제: 이메일 발송 기능 미구현

**위치**: `src/lib/emails/email-service.ts:52-68`

**현재 코드**:
```typescript
class SMTPEmailService implements EmailService {
  async send(params: EmailParams) {
    // TODO: Implement SMTP email sending
    console.warn('SMTP not implemented, using mock');
    return new MockEmailService().send(params);
  }
}
```

**문제**: 실제 SMTP/SendGrid 연동이 되어 있지 않음

**영향**: 번역 요청 이메일이 실제로 발송되지 않음

**수정 제안**: nodemailer 또는 @sendgrid/mail 라이브러리 연동

**필요 작업**:
1. 패키지 설치: `npm install nodemailer @sendgrid/mail`
2. 환경변수 설정: SMTP_HOST, SMTP_USER 등
3. EmailService 구현 완성
4. 실제 발송 테스트
```
