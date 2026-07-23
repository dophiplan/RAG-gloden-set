# GATE_CALIN_EE — 사람 게이트

- 발행: 2026-07-23T11:32:30 · 제품: EE · 단계: ⑥ 캘리브레이션

## 무엇을 / 왜 멈췄나
사람 블라인드 판정 30건 기입 대기 — EE_judge_캘리브레이션_판정30_v1_0.xlsx 시트 '2_대조표_판정완료'의 '사람 판정' 컬럼을 기입한 뒤 승인 (기입 전 승인 금지)

## 실측 수치
- 파일: EE_judge_캘리브레이션_판정30_v1_0.xlsx
- judge 판정: 완료·보존
- 사람 판정: 0/30 기입

## 플래그 ack 체크리스트 (전건 ack 없이 통과 불가)
(플래그 없음)

## 기계 권고 (참고용 — 판단은 사람)
블라인드 원칙 — judge 판정 열람 전 독립 판정

## 재개
- 승인: `python3 tools/pipeline.py approve CALIN_EE`
- 반려: `python3 tools/pipeline.py reject CALIN_EE --reason "..."` (사유 필수)
