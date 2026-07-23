# GATE_SCORE_EE_r1 — 사람 게이트

- 발행: 2026-07-23T13:12:03 · 제품: EE · 단계: ⑧ 실물 채점

## 무엇을 / 왜 멈췄나
r1 성적표 확정 — E형 원문 열람(0건) + 스코프 변동 확인 후 사람 확정

## 실측 수치
- round: r1
- 공식(v11).top1: 0
- 공식(v11).top5: 0
- 공식(v11).pass: 10
- 공식(v11).partial: 0
- 공식(v11).unparsed: 0
- 공식(v11).E환각(원시): 0
- 공식(v11).E거절: 1
- 공식(v11).n: 13
- 회차 비교: 허용(공식 v1.1 기준)
- out: results/score_EE_r1

## 플래그 ack 체크리스트 (전건 ack 없이 통과 불가)
(플래그 없음)

## 기계 권고 (참고용 — 판단은 사람)
E형 원시 판정은 그대로 믿지 말 것(P-신규-3) — 원문 확인 후 실질 수치 병기. 열람 자료: —

## 재개
- 승인: `python3 tools/pipeline.py approve SCORE_EE_r1`
- 반려: `python3 tools/pipeline.py reject SCORE_EE_r1 --reason "..."` (사유 필수)
