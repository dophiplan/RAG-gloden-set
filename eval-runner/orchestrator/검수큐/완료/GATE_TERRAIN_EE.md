# GATE_TERRAIN_EE — 사람 게이트

- 발행: 2026-07-23T13:11:49 · 제품: EE · 단계: ② 지형 판정

## 무엇을 / 왜 멈췄나
EE terrain 프로파일 확정 필요 — citation/앵커 패턴·부록 스위치를 사람이 판정

## 실측 수치
- 프로파일: 초안(복제/빈)
- 확정 항목: citation_pattern·anchor_patterns·appendix_switches

## 플래그 ack 체크리스트 (전건 ack 없이 통과 불가)
(플래그 없음)

## 기계 권고 (참고용 — 판단은 사람)
기존 제품(RV/RC) 프로파일과 코퍼스 실측 결과를 대조해 결정

## 재개
- 승인: `python3 tools/pipeline.py approve TERRAIN_EE`
- 반려: `python3 tools/pipeline.py reject TERRAIN_EE --reason "..."` (사유 필수)
