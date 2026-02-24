# 제품 관리 최종 정의서

## 🎯 작업 범위

### 1. CRUD 기능 (settings/page.tsx - 제품 관리)
- ✅ 제품 등록
- ✅ 제품 조회
- ✅ 제품 수정 (제품코드, 제품명)
- ✅ 제품 삭제 (조걶부)

### 2. 연동 영역 (제품 변경 시 동기화)
| 영역 | 위치 | 동기화 항목 |
|------|------|------------|
| 대시보드 | ProductTabs | 제품 탭 목록 |
| 번역관리 | translations/[product] | 탭, 새번역추가 팝업 제품분류 |
| 용어집 | glossary/[product] | 탭, 용어추가 팝업 제품 |
| 번역요청 | /upload | 제품 선택 영역 |
| 데이터마이그레이션 | settings/migration | 제품 영역 |
| 사용자관리 | users/page | 사용자 등록/수정 제품 영역 |
| 작업이력 | audit_logs | 제품 정보 기록 |
| 번역히스토리 | VersionHistory | 제품 정보 노출 |

### 3. 삭제 정책
| 사용자 | 조건 | 동작 |
|--------|------|------|
| 1st_master | 항상 가능 | "관련 데이터 모두 삭제?" confirm 후 Y면 cascade 삭제 |
| master/manager/user | 데이터 있음 | 삭제 불가 (오류 메시지) |
| master/manager/user | 데이터 없음 | 삭제 가능 |

### 4. 수정 정책
| 변경 항목 | 동작 | 영향 범위 |
|-----------|------|----------|
| 제품코드 | cascade update | translations, translation_results, glossary, glossary_products, translation_products, issues 등 |
| 제품명 | 표시 동기화 | 모든 UI 컴포넌트 |

---

## 📝 작업 순서

### Phase 1: 백엔드 API 수정
1. `/api/products/[id]/route.ts` - DELETE 메서드 수정
   - 1st_master 체크
   - 관련 데이터 존재 여부 확인
   - cascade 삭제 또는 거부

2. `/api/products/[id]/route.ts` - PATCH 메서드 수정
   - 제품코드 변경 시 cascade update

3. Audit Log 제품 정보 추가
   - translation_audit_logs 테이블에 product_code 컬럼 확인/추가

### Phase 2: 프론트엔드 연동
1. 제품 관리 CRUD 완성
2. 대시보드 ProductTabs 동기화
3. 번역관리 탭/팝업 동기화
4. 용어집 탭/팝업 동기화
5. 번역요청하기 동기화
6. 데이터마이그레이션 동기화
7. 사용자관리 동기화
8. 번역히스토리 제품 정보 표시

---

## ⚠️ 주의사항
- 제품코드 변경은 많은 테이블에 영향을 미침 (트랜잭션 필수)
- 캐시된 데이터 무효화 필요 (React Query/SWR 캐시)
- 1st_master 권한 체크 정확히 구현
