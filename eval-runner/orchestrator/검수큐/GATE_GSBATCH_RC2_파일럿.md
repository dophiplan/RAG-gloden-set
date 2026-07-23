# GATE_GSBATCH_RC2_파일럿 — 사람 게이트

- 발행: 2026-07-23T12:06:19 · 제품: RC2 · 단계: ④ 골든셋 배치

## 무엇을 / 왜 멈췄나
파일럿 생성·검수 완료 — 사람 게이트

## 실측 수치
- 배치: RC2_골든셋_파일럿_31문항_v1_0.xlsx
- 문항: 31
- 검수 7종: PASS
- 직접 커버 누계: 30
- 잔여: 850

## 플래그 ack 체크리스트 (전건 ack 없이 통과 불가)
(플래그 없음)

## 기계 권고 (참고용 — 판단은 사람)
승인 시 다음 차수 / 잔여 0이면 배치 마감으로

## 재개
- 승인: `python3 tools/pipeline.py approve GSBATCH_RC2_파일럿`
- 반려: `python3 tools/pipeline.py reject GSBATCH_RC2_파일럿 --reason "..."` (사유 필수)
