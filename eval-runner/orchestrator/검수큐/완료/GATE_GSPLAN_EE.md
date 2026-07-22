# GATE_GSPLAN_EE — 사람 게이트

- 발행: 2026-07-23T08:02:17 · 제품: EE · 단계: ④ 골든셋 배치

## 무엇을 / 왜 멈췄나
배분계획 승인 — 재료실측 완료, 배치 배분안 확인

## 실측 수치
- 재료 풀(맵 단위): 12
- 밴드: 60~75
- 계획: {"plan": "단일 배치 B1 — 전 단위 직접 커버", "batches": ["B1"]}

## 플래그 ack 체크리스트 (전건 ack 없이 통과 불가)
(플래그 없음)

## 기계 권고 (참고용 — 판단은 사람)
승인 시 파일럿 30문항 생성 시작

## 재개
- 승인: `python3 tools/pipeline.py approve GSPLAN_EE`
- 반려: `python3 tools/pipeline.py reject GSPLAN_EE --reason "..."` (사유 필수)
