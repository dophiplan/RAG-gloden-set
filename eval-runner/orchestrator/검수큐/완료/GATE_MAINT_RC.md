# GATE_MAINT_RC — 사람 게이트

- 발행: 2026-07-16T16:02:36 · 제품: RC · 단계: ⑨ 유지보수

## 무엇을 / 왜 멈췄나
RC 유지보수 큐 판단 — 전제 실효/오탐 되먹임은 사람 판정

## 실측 수치
- 되먹임 (a): 전제 실효 후보 → 골든셋 vN+1 개정 큐
- 되먹임 (b): 오탐·측정 불능 → 채점기 개정 큐 → 규칙 D

## 플래그 ack 체크리스트 (전건 ack 없이 통과 불가)
(플래그 없음)

## 재개
- 승인: `python3 tools/pipeline.py approve MAINT_RC`
- 반려: `python3 tools/pipeline.py reject MAINT_RC --reason "..."` (사유 필수)
