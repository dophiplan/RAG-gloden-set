# GATE_SCORE_TT_r1 — 사람 게이트

- 발행: 2026-07-20T19:22:07 · 제품: TT · 단계: ⑧ 실물 채점

## 무엇을 / 왜 멈췄나
r1 성적표 확정 — E형 원문 열람(1건) + 스코프 변동 확인 후 사람 확정

## 실측 수치
- round: r1
- 공식(v11).top1: 0
- 공식(v11).top5: 0
- 공식(v11).pass: 9
- 공식(v11).partial: 0
- 공식(v11).unparsed: 0
- 공식(v11).E환각(원시): 1
- 공식(v11).E거절: 0
- 공식(v11).n: 13
- 회차 비교: 허용(공식 v1.1 기준)
- out: results/score_TT_r1
- E형 문맥확인 자료: results/score_TT_r1/E형_문맥확인.md

## 플래그 ack 체크리스트 (전건 ack 없이 통과 불가)
- [ ] ack: E형 환각(원시) 문맥 확인 · TT-E13 · ['양자암호 전송은 설정 메뉴에서 켤 수 있습니다.']

## 기계 권고 (참고용 — 판단은 사람)
E형 원시 판정은 그대로 믿지 말 것(P-신규-3) — 원문 확인 후 실질 수치 병기. 열람 자료: results/score_TT_r1/E형_문맥확인.md

## 재개
- 승인: `python3 tools/pipeline.py approve SCORE_TT_r1`
- 반려: `python3 tools/pipeline.py reject SCORE_TT_r1 --reason "..."` (사유 필수)
