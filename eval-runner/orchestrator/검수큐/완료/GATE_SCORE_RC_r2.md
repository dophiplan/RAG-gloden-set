# GATE_SCORE_RC_r2 — 사람 게이트

- 발행: 2026-07-16T16:11:23 · 제품: RC · 단계: ⑧ 실물 채점

## 무엇을 / 왜 멈췄나
r2 성적표 확정 — E형·판정 문맥 확인 큐(P-04) 검토 후 사람 확정

## 실측 수치
- round: r2
- raw_keys: list
- 회차 비교: 허용
- out: results/score_RC_r2

## 플래그 ack 체크리스트 (전건 ack 없이 통과 불가)
(플래그 없음)

## 기계 권고 (참고용 — 판단은 사람)
E형 히트는 자동 기각 금지 — 문맥 열람 의무 (P-04). 확정 시 approve.

## 재개
- 승인: `python3 tools/pipeline.py approve SCORE_RC_r2`
- 반려: `python3 tools/pipeline.py reject SCORE_RC_r2 --reason "..."` (사유 필수)
