# GATE_SCORE_RC2_r1 — 사람 게이트

- 발행: 2026-08-03T15:04:31 · 제품: RC2 · 단계: ⑧ 실물 채점

## 무엇을 / 왜 멈췄나
r1 성적표 확정 — E형 원문 열람(0건) + 스코프 변동 확인 후 사람 확정

## 실측 수치
- round: r1
- 공식(v11).top1: 236
- 공식(v11).top5: 369
- 공식(v11).pass: 미응시
- 공식(v11).partial: 미응시
- 공식(v11).unparsed: 미응시
- 공식(v11).E환각(원시): 미응시
- 공식(v11).E거절: 미응시
- 공식(v11).n: 889
- 공식(v11).응시 범위: 검색축만 (answer 미제출 — 생성축·E형 채점 없음)
- 회차 비교: 허용(공식 v1.1 기준)
- out: results/score_RC2_r1

## 플래그 ack 체크리스트 (전건 ack 없이 통과 불가)
(플래그 없음)

## 기계 권고 (참고용 — 판단은 사람)
E형 원시 판정은 그대로 믿지 말 것(P-신규-3) — 원문 확인 후 실질 수치 병기. 열람 자료: —

## 재개
- 승인: `python3 tools/pipeline.py approve SCORE_RC2_r1`
- 반려: `python3 tools/pipeline.py reject SCORE_RC2_r1 --reason "..."` (사유 필수)
