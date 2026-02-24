# 🤖 AI 개발 규칙 (Development Guidelines)

> **버전**: 1.0  
> **마지막 업데이트**: 2026-02-24  
> **적용 대상**: 모든 AI 코드 생성 작업

---

## 📋 핵심 원칙

### 1. 최소한의 변경 (Minimal Changes)
- 필요한 부분만 수정한다
- 기존 동작을 변경하지 않는다
- 리팩토링은 별도 커밋으로 분리한다

### 2. 코드 일관성 (Consistency)
- 기존 프로젝트 스타일을 유지한다
- 새로운 패턴 도입 시 사전 승인을 받는다
- Prettier/ESLint 설정을 따른다

### 3. 타입 안전성 (Type Safety)
- TypeScript strict mode를 준수한다
- `any` 타입 사용을 지양한다
- 모든 함수에 반환 타입을 명시한다

---

## ✅ 개발 시작 전 필수 체크리스트

- [ ] **사전 승인**: 개발 실행 전 반드시 사용자에게 물어보고 작업한다
- [ ] **아이디어 제안**: 더 나은 해결책이 있다면 적극적으로 제안한다
- [ ] **파일 읽기**: 관련 파일을 먼저 읽고 맥락을 파악한다 (추측 금지)
- [ ] **환경 변수 확인**: API 호출 시 환경 변수 사용 여부를 확인한다

---

## 🛠️ 개발 중 준수사항

### 4. 컴팩트한 개발 (Compact Development)
- 불필요한 공백이나 주석을 피한다
- 코드 블록은 논리적으로 그룹화한다
- 한 파일에 과도한 로직을 넣지 않는다 (단일 책임 원칙)

### 5. 간결함 유지 (Keep It Simple)
> "항상 가장 간단한 해결책을 선택하라."

- 불필요한 추상화를 지양한다
- 새로운 라이브러리 도입은 신중하게 검토한다
- 오버엔지니어링을 피한다

### 6. 상태 관리 (State Management)
> "전역 상태보다는 리액트 쿼리(React Query/SWR)를 우선적으로 사용한다"

- `useState`, `useReducer`로 해결 가능한지 먼저 검토
- Context API는 꼭 필요할 때만 사용
- Redux/Zustand 등은 최후의 수단으로

### 7. 에러 처리 (Error Handling)
> "사용자에게 친화적인 메시지를 반환하고, 난제 로깅"

```typescript
// ✅ 좋은 예
try {
  const data = await apiFetch('/api/data');
} catch (error) {
  console.error('[API Error] /api/data:', error); // 난제 로깅
  showError('데이터를 불러오는데 실패했습니다.'); // 사용자 친화적 메시지
}
```

---

## 🧪 테스트 및 품질

### 8. 테스트 필수 (Testing Required)
> "모든 로직 수정 후에는 반드시 관련 테스트를 실행하거나 새로 작성하라"

- **품질 목표**: 항상 90점 이상 유지
- **현재 품질 점수**: 94.1% (A등급)
- **테스트 실행**: `npm test`
- **빌드 확인**: `npm run build`

### 9. 사이드 이펙트 방지 (No Side Effects)
> "개발 완료 후 사이드 이펙트가 나지 않았는지 자체적으로 테스트하라"

- 수정 후 관련 기능 전체를 테스트한다
- 연관된 컴포넌트/훅을 확인한다
- 콘솔 에러가 없는지 확인한다

---

## 📦 API 및 환경

### 10. API 호출 규칙
- **api-utils 사용**: 모든 API 호출은 `src/lib/api-utils.ts`의 함수 사용
  - `apiGet()`, `apiPost()`, `apiPatch()`, `apiDelete()`
- **타입 지정**: 제네릭으로 응답 타입을 명시한다
  ```typescript
  const data = await apiGet<{ items: Item[] }>('/api/items');
  ```
- **환경 변수 확인**: API URL에 환경 변수 사용 여부 확인
  ```typescript
  // ✅ 좋은 예
  const url = `${process.env.NEXT_PUBLIC_API_URL}/api/items`;
  ```

---

## 🔍 QA / TQC 프로세스

### 11. 개발 완료 후 마무리 절차

1. **자체 테스트**
   - [ ] 빌드 오류 없음 (`npm run build`)
   - [ ] 테스트 통과 (`npm test`)
   - [ ] TypeScript 에러 없음

2. **사이드 이펙트 확인**
   - [ ] 수정한 파일 관련 기능 테스트
   - [ ] 브라우저 콘솔 에러 확인
   - [ ] 네트워크 탭 API 정상 응답 확인

3. **품질 점수 확인**
   - [ ] 90점 이상 유지
   - [ ] `/settings/qa` 페이지에서 확인

4. **Git 커밋**
   - [ ] 커밋 메시지: `type: description` 형식
   - [ ] 관련 파일만 staging
   - [ ] 푸시 전 최종 확인

---

## 📝 규칙 업데이트 로그

| 날짜 | 버전 | 변경 내용 |
|------|------|----------|
| 2026-02-24 | 1.0 | 초안 작성 - 11가지 핵심 규칙 정의 |

---

## ⚠️ 실수 방지 규칙 (지속 업데이트)

> 개발 중 발생한 실수와 그 해결책을 기록하여 반복을 방지합니다.

### 패턴 1: API 응답 구조
- **실수**: `data.items`로 접근했는데 실제는 `{ data: { items: [] } }` 구조
- **해결**: 항상 `result.data?.items || []` 패턴 사용
- **참고**: `src/lib/api-utils.ts`의 `parseApiResponse` 사용

### 패턴 2: SWR 캐싱
- **실수**: API 수정 후에도 캐시된 데이터가 표시됨
- **해결**: 캐시 키 변경 또는 `mutate()` 호출
- **참고**: `revalidateOnFocus: true` 설정

### 패턴 3: RLS 정책
- **실수**: Supabase RLS로 인해 API가 빈 배열 반환
- **해결**: 관리 데이터는 `createAdminClient()` 사용
- **적용**: products, languages, platforms API

### 패턴 4: 타입 에러
- **실수**: `data is of type 'unknown'` 에러
- **해결**: 제네릭으로 타입 명시 `<{ items: Item[] }>`
- **참고**: 모든 apiFetch 호출에 타입 지정

---

## 💡 팁

- **질문하기**: 모호한 상황에서는 추측보다 질문하라
- **작게 시작**: 큰 변경보다 작은 단위로 커밋하라
- **문서화**: 복잡한 로직은 주석으로 설명하라
- **되돌리기**: 문제 발생 시 즉시 되돌리고 보고하라

---

> **이 문서는 개발 시작 전 반드시 읽고, 개발 중 상시 참조하세요.**
