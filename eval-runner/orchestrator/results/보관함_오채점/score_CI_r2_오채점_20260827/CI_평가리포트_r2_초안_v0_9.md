# CI RAG 평가 리포트 — r2 (초안 v0.9 · 자동 생성)

> ⚠ 초안 — 발주자(난희) 검증 전 외부 전달 금지 (규격 v1.0 §A-3)

## 0. 성적 요약
| 항목 | 값 |
|---|---|
| 회차 | r2 · 응시 범위: 검색축만 (answer 미제출 — 생성축·E형 미응시) |
| 시스템 | r_rag_platform dev@111123b |
| 모수 | 488문항 전량 · 형식 게이트 PASS |
| top1 (엄격) | **0 / 488 = 0.0%** |
| top5 (엄격) | **0 / 488 = 0.0%** |
| top1 (관대*) | **0 / 174 = 0.0%** |
| top5 (관대*) | **0 / 174 = 0.0%** |

* 관대 = 채점 가능 문항만 (정답 출처 URL 결측 314건 제외 — §2-③)

## 1. 시스템 현재 위치
| 축 | 상태 | 근거 |
|---|---|---|
| 검색 | 🟡 | top1 0.0% · top5 0.0% (관대) |
| 생성/E형 | — 미응시 | 본 회차 answer 미제출 |
| 실행 안정성 | ✅ | 488/488 전량 응답 · 형식 결함 0 |

## 2. 검색 분해 (실측)
### ① 정답 소스군별 miss율
| 소스군 | 문항 | miss | miss율 |
|---|---|---|---|
| www.docomo.ne.jp | 78 | 78 | 100% |
| dpoint.docomo.ne.jp | 20 | 20 | 100% |
| id.smt.docomo.ne.jp | 19 | 19 | 100% |
| dphoto.docomo.ne.jp | 19 | 19 | 100% |
| www.hikaritv-docomo.jp | 13 | 13 | 100% |
| service.smt.docomo.ne.jp | 8 | 8 | 100% |
| health.docomo.ne.jp | 6 | 6 | 100% |
| ssw.web.docomo.ne.jp | 4 | 4 | 100% |
| shop.smt.docomo.ne.jp | 4 | 4 | 100% |
| www.sugotoku.docomo.ne.jp | 3 | 3 | 100% |

### ② 전멸 소스군 (인입/인덱싱 점검 요청)
· www.docomo.ne.jp · www.hikaritv-docomo.jp · health.docomo.ne.jp · dpoint.docomo.ne.jp · id.smt.docomo.ne.jp · service.smt.docomo.ne.jp · dphoto.docomo.ne.jp

### ③ 방법론 이슈
- 정답 출처 URL 결측 314건 (miss 273) — 구조적 채점 불가, 골든셋 보정 후 규칙 D 소급 재채점 권고

## 3. 저조 원인 분석 — 점수가 왜 이렇게 나왔나 (전건 실측·매 회차 표준)

검증: 시스템이 가져온 청크 **본문**에 골든셋 '근거 원문 발췌'가 실재하는지 448건 전건 대조.

| 기준 | top1 | top5 |
|---|---|---|
| 공식 (URL 일치) | 0 (0%) | 0 (0%) |
| **합집합 (URL 또는 내용 실재 — v12 병기)** | **27 (6%)** | **45 (10%)** |

### 공식 miss 447건의 속사정
| 분류 | 건수 | 뜻 |
|---|---|---|
| 내용은 맞는데 miss ① 출처 URL 결측 | 32 | 골든셋 데이터 문제 — 보정 후 소급 재채점 대상 |
| 내용은 맞는데 miss ② 다른 문서에 같은 내용 | 13 | 모호 질문/중복 문서 — 채점 기준의 한계 (v12가 구제) |
| **진짜 검색 실패** (top5 어디에도 정답 내용 없음) | **402** | 검색기/인입 개선 대상 — §2 소스군 분해 참조 |

→ 요약: 낮은 점수의 10%는 채점·데이터 요인, 90%는 실제 검색 실패.

## 4. 다음 회차 정답률을 올리려면 (실행 가이드 — 우선순위순)

| # | 조치 | 담당 | 예상 효과 | 근거 |
|---|---|---|---|---|
| 1 | **전멸 소스군 인입/인덱싱 확인**: www.docomo.ne.jp · www.hikaritv-docomo.jp · health.docomo.ne.jp · dpoint.docomo.ne.jp · id.smt.docomo.ne.jp · service.smt.docomo.ne.jp · dphoto.docomo.ne.jp | 팀장님 | 해당 문항 전건 회복 가능 | top5에 한 번도 안 잡힘 = 인덱스 부재 의심 |
| 2 | **진짜 실패 최다 소스군 우선 튜닝**: ssw.web.docomo.ne.jp(4건) · shop.smt.docomo.ne.jp(4건) · www.sugotoku.docomo.ne.jp(3건) | 팀장님 | 최대 +11건 | §2-① miss 분해 |
| 3 | **골든셋 출처 URL 결측 보정 + 소급 재채점** | 우리(평가) | 공식 지표 +32건 | §3 분류 ① — 채점 불가였던 문항 |
| 4 | **합집합(v12) 병기 지표를 공식 보고에 병기** | 우리(평가) | +13건 정당 인정 | §3 분류 ② — 다른 문서의 같은 내용 |

→ 다음 회차(r+1)에서 이 표의 이행 여부와 지표 변화를 대조해 보고합니다.

## E형
미응시 (검색축만 회차)

## 부록
- score_report.json / score_report.xlsx (재현용 원자료)
