# GATE_SCORE_RC2_r1 — 사람 게이트

- 발행: 2026-08-03T15:04:31 · 제품: RC2 · 단계: ⑧ 실물 채점

## 무엇을 / 왜 멈췄나
r1 성적표 확정 — E형 원문 열람(0건) + 스코프 변동 확인 후 사람 확정

## 실측 수치
- round: r1
- 공식(v11).top1: 236
- 공식(v11).top5: 369
- 공식(v11).pass: 미응시
- 공식(v11).partial: 미응시
- 공식(v11).unparsed: 미응시
- 공식(v11).E환각(원시): 미응시
- 공식(v11).E거절: 미응시
- 공식(v11).n: 889
- 공식(v11).응시 범위: 검색축만 (answer 미제출 — 생성축·E형 채점 없음)
- 회차 비교: 허용(공식 v1.1 기준)
- out: results/score_RC2_r1

## 플래그 ack 체크리스트 (전건 ack 없이 통과 불가)
(플래그 없음)

## 기계 권고 (참고용 — 판단은 사람)
검색축만 회차 — E형 원문 확인은 해당 없음 (answer 미제출).

### 👀 사람 확인 가이드 — 검색축만 회차: 표본으로 '채점이 말이 되는지'만 보면 됩니다

**① top1 성공 표본 — 1순위 출처가 정답 출처와 같은 문서인가요?**
- RC2-483 · 정답: https://www.remotecall.com/kr/blog/holiday-customer-support-remotecall/
  ↳ 시스템 1순위: https://www.remotecall.com/kr/blog/holiday-customer-support-remotecall/
- RC2-488 · 정답: https://www.remotecall.com/kr/blog/holiday-customer-support-remotecall/
  ↳ 시스템 1순위: https://www.remotecall.com/kr/blog/holiday-customer-support-remotecall/
- RC2-489 · 정답: https://www.remotecall.com/kr/blog/how-to-add-remote-support-vibe-coding/
  ↳ 시스템 1순위: https://www.remotecall.com/kr/blog/how-to-add-remote-support-vibe-coding/

**② 실패 표본 — 정답과 가져온 출처가 정말 다른가요? (사실 같은 문서인데 실패 처리면 반려)**
- RC2-482 · 정답: https://www.remotecall.com/kr/blog/holiday-customer-support-remotecall/
  ↳ 시스템 상위: https://www.remotecall.com/kr/blog/persuade-remotecall/ | https://www.remotecall.com/kr/blog/so
- RC2-484 · 정답: https://www.remotecall.com/kr/blog/holiday-customer-support-remotecall/
  ↳ 시스템 상위: https://www.remotecall.com/kr/support/update-history/update-20221115/ | https://files.rsupport.
- RC2-485 · 정답: https://www.remotecall.com/kr/blog/holiday-customer-support-remotecall/
  ↳ 시스템 상위: https://www.remotecall.com/kr/blog/rsupport-remotecall-iso-27001-27017-certification/ | https:/

**③ 수치 감**: top1 236 · top5 369 / 889문항 — 표본과 모순 없으면 승인하세요. (생성축·E형은 미응시 — 이번 회차 확인 대상 아님)

## 재개
- 승인: `python3 tools/pipeline.py approve SCORE_RC2_r1`
- 반려: `python3 tools/pipeline.py reject SCORE_RC2_r1 --reason "..."` (사유 필수)
