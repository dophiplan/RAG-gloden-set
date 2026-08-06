# GATE_COVMAP_EE — 사람 게이트

- 발행: 2026-08-06T11:51:54 · 제품: EE · 단계: ③ 커버리지맵

## 무엇을 / 왜 멈췄나
커버리지맵 생성·검수 완료 — 확정은 사람 (사람확인 큐)

## 실측 수치
- 실행 전략: ensemble
- 커버 단위(검수 통과): 12
- 기여도: {'generator': {'추출(검수통과)': 12, '신규 기여': 12}, 'judge': {'추출(검수통과)': 12, '신규 기여': 0}}
- 재검수 탈락: 0
- 1축 문자 대조: 불일치 0 (통과분)
- GAP_AUDIT 누락 문서: 0
- 산출: EE_커버리지맵_코퍼스판_v1_0.xlsx

## 플래그 ack 체크리스트 (전건 ack 없이 통과 불가)
(플래그 없음)

## 기계 권고 (참고용 — 판단은 사람)
GAP 누락·반려 잔존 항목 ack 후 승인 시 맵 확정 → ④ 진입

## 재개
- 승인: `python3 tools/pipeline.py approve COVMAP_EE`
- 반려: `python3 tools/pipeline.py reject COVMAP_EE --reason "..."` (사유 필수)
