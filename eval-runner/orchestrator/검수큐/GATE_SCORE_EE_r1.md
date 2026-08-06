# GATE_SCORE_EE_r1 — 사람 게이트

- 발행: 2026-08-06T16:13:14 · 제품: EE · 단계: ⑧ 실물 채점

## 무엇을 / 왜 멈췄나
r1 성적표 확정 — E형 원문 열람 + 스코프 변동 확인 후 사람 확정 (시연)

## 실측 수치
- round: r1
- top1: 0
- top5: 0
- n: 13

## 플래그 ack 체크리스트 (전건 ack 없이 통과 불가)
(플래그 없음)

## 재개
- 승인: `python3 tools/pipeline.py approve SCORE_EE_r1`
- 반려: `python3 tools/pipeline.py reject SCORE_EE_r1 --reason "..."` (사유 필수)
