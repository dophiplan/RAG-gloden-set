# GATE_GSBATCH_RV2_9차 — 사람 게이트

- 발행: 2026-07-29T19:31:07 · 제품: RV2 · 단계: ④ 골든셋 배치

## 무엇을 / 왜 멈췄나
9차 생성·검수 완료 — 사람 게이트

## 실측 수치
- 배치: RV2_골든셋_9차_12문항_v1_0.xlsx
- 문항: 12
- 검수 7종: PASS
- 직접 커버 누계: 186
- 잔여: 694
- 미커버 반환: 63단위 — 응답 절단 추정, 다음 차수 재출제 (예: ['RV2-HTTPSC-1000', 'RV2-HTTPSC-1061', 'RV2-HTTPSC-1093'])

## 플래그 ack 체크리스트 (전건 ack 없이 통과 불가)
(플래그 없음)

## 기계 권고 (참고용 — 판단은 사람)
승인 시 다음 차수 / 잔여 0이면 배치 마감으로

### 👀 사람 확인 가이드 — 기계가 못 보는 것만 보면 됩니다 (표본 검사, 전건 검토 불필요)
1. 아래 표본의 **질문이 실제 고객이 물어볼 법한 말**인가요? (내부 용어·번역투면 반려)
2. **정답이 질문에 대한 답**인가요? (동문서답·과잉 서술 확인)
3. 정답의 **'필수:' 요소가 합리적**인가요? (너무 많으면 채점이 가혹, 너무 적으면 무의미)
4. 전체 문항은 ④ 자료실에서 `RV2_골든셋_9차_12문항_v1_0.xlsx` [받기]

⚠ 이 배치 특이사항: 미커버 63단위는 다음 차수가 자동 재출제 — 승인에 영향 없음

어색한 문항이 있으면 [반려] + 사유에 문항 ID를 적어주세요 — 그 피드백대로 재출제됩니다.

### 표본 문항 (유형별 1개, 자동 발췌)
**[RV2-179] (사실확인형)**
- 질문: 리모트뷰 블로그의 Claude Code 가이드에서, /cost 명령어는 무엇을 실시간으로 모니터링하는가?
- 정답: 사용된 토큰량과 예상 비용을 실시간으로 모니터링합니다.
필수: 토큰량, 예상 비용
- 출처: RV2-HTTPSC-1249 ; https://content.rview.com/ko/blog/claudecode/

**[RV2-178] (절차형)**
- 질문: 리모트뷰 블로그의 Claude Code 설치 가이드에서, Windows 사용자에게 권장하는 설치 환경은 무엇인가?
- 정답: PowerShell에서 설치하거나, 더 안정적인 개발 환경을 위해 WSL2(Ubuntu) 환경에서 설치하는 것을 권장합니다.
필수: PowerShell, WSL2(Ubuntu)
- 출처: RV2-HTTPSC-1240 ; https://content.rview.com/ko/blog/claudecode/

**[RV2-183] (정의형)**
- 질문: 리모트뷰 블로그에 따르면, OT 환경에 포함되는 사회 인프라 운영 시스템 분야에는 어떤 것들이 있는가?
- 정답: 제조, 에너지, 물, 교통, 의료 등 사회 인프라를 운영하는 시스템을 포함합니다.
필수: 제조, 에너지, 물, 교통, 의료
- 출처: RV2-HTTPSC-1294 ; https://content.rview.com/ko/blog/conference2024/

**[RV2-186] (조건형)**
- 질문: 리모트뷰의 OS 보안 패치 검사 기능은 어떤 OS에서 지원되며, 지원하지 않는 OS는 무엇인가?
- 정답: Windows 10 버전 이상에서만 지원되며, Windows Server OS는 미지원입니다.
필수: Windows 10 이상, Windows Server 미지원
- 출처: RV2-HTTPSC-1336 ; https://content.rview.com/ko/blog/feature-viewer-che

## 재개
- 승인: `python3 tools/pipeline.py approve GSBATCH_RV2_9차`
- 반려: `python3 tools/pipeline.py reject GSBATCH_RV2_9차 --reason "..."` (사유 필수)

## 설계본부 소견 (독립 세션 · 참고 — 확정은 사람)
I've hit a wall on independent measurement: the `python3` run of verify_batch requires approval and hasn't been granted, so I **cannot** re-run the standard tool myself yet. Per P-003 and §2-1, I won't certify "7종 PASS" on the generator's own word. Here is my 소견서 with what I could measure read-only, plus the content-layer review (which is exactly the gap the 7종 tool does not cover).

---

## 소견서 — GATE_GSBATCH_RV2_9차

**[판정] 보류 (CONDITIONAL / 사람확인 필요)** — 승인 반대는 아니나, 지금 상태로 "합격 확정"에 도장을 받쳐줄 수 없음. 두 가지가 걸려 있음: ① 표준 도구 독립 재현이 실행 승인 대기로 막힘, ② 내용 검수에서 경계 사안 다수(도구가 못 보는 영역).

### 실측 수치 (read-only로 확인된 것만)
- 배치 파일 실재: `data/RV2/04_goldenset_batch/RV2_골든셋_9차_12문항_v1_0.xlsx` ✔ (8,952 bytes, 2026-07-29 19:31)
- 커버리지맵 실재: `data/RV2/03_coverage_map/RV2_커버리지맵_코퍼스판_v1_0.xlsx` ✔
- 원장 등재 확인: ledger.jsonl L2398–2400 — `BATCH_GENERATED`→`ISSUE_GATE_CARD`→`WAITING_HUMAN`, 계보 정상(P-007 충족)
- **주의:** 카드의 "검수 7종 PASS · 직접 186 · 잔여 694 · 미커버 63단위"는 **전부 `actor: script:gen_goldenset`의 자기 선언 1줄에 들어있음.** verify_batch가 독립 실행돼 원장에 별도 PASS를 남긴 흔적은 없음. 즉 **아직 실측이 아니라 선언**임(§2-1).

### 발동 조항/판례
- **§2-1(선언≠실측)·P-003:** 7종은 표준 도구로 독립 재현해야 인정 — 미실행 상태.
- **§2-5(모호하면 정지)·P-001(자동 히트/자동 통과는 후보다):** 아래 내용 사안은 조항·발효 판례에 근거가 없어 자동 반려하지 않고 사람확인 큐로 올림.
- **도구 갭(기억 3건):** 7종에는 ⓐ회사명 문항 ⓑ공지 트리비아 ⓒ홍보·크롤조각 검사가 **없음** → "7종 PASS"가 이 사유를 통과시킴. 사람 눈으로만 걸러짐.

### 내용 검수 (사람이 봐야 할 것 — 표본 10문항 열람)
회사명 문항(ⓐ)·공지 트리비아(ⓑ) 위반은 **없음**. 다만 소재 편중이 눈에 띔:
- **블로그 마케팅/일반 상식 소재가 다수** — 실제 리모트뷰 사용자가 RAG에 물을 법하지 않은 것들:
  - Claude Code 가이드 4문항(RV2-177 파일수정·178 설치환경·179 /cost·180 Cursor병행) — 제3자 개발툴 사용법
  - RV2-175(미국 원격근무 소통 53% 통계), RV2-176(애니데스크 해킹 일주일 폐쇄), RV2-181/182(클린룸 산업·출입시간), RV2-183(OT 사회인프라 분야) — 블로그 설명글/뉴스성 소재
  - 반대로 **RV2-186(OS 보안패치 지원 OS)은 명확한 리모트뷰 제품기능 문항 — 고평가**
- 이는 기억의 "홍보·크롤 조각 소재 금지" 취지와 인접하나, 원문이 리모트뷰 공식 블로그(content.rview.com)라 코퍼스 정당 소재이긴 함. **성공사례·고객사 소개 같은 명백한 홍보는 아님.** → 규칙 위반 단정 불가, **판단은 난희 몫**(§2-5).

### 재현 수단 (승인 필요 — 제가 못 돌림)
```
python3 tools/verify_batch.py \
  --batch "data/RV2/04_goldenset_batch/RV2_골든셋_9차_12문항_v1_0.xlsx" \
  --map "data/RV2/03_coverage_map/RV2_커버리지맵_코퍼스판_v1_0.xlsx" \
  --product RV2 \
  --union data/RV2/04_goldenset_batch/RV2_골든셋_{파일럿_24문항,2차_34문항,3차_35문항,4차_22문항,5차_17문항,6차_17문항,7차_18문항,8차_9문항}_v1_0.xlsx \
  --json results/verify_RV2_9차_sbb.json
```
산출물 예정 경로: `results/verify_RV2_9차_sbb.json` (현재 미생성 — 실행 차단됨)

### 다음 단계 지시
1. **(제 쪽)** 위 명령 실행을 허용해 주세요 — 허용되면 제가 7종을 독립 재현해 PASS/REJECT를 실측으로 확정하고 판정을 갱신합니다. 그전에는 7종을 제 이름으로 보증 못 합니다.
2. **(난희 결정)** 내용 편중 건: Claude Code·블로그 상식 소재(177–183 등)를 이번 배치 눈감고 승인할지, 아니면 특정 ID 반려해 제품기능 소재(186형)로 재출제할지 — 정책 판단.
3. 미커버 63단위는 다음 차수 자동 재출제라 이 승인과 무관(카드 특이사항과 일치).

**저는 확정하지 않습니다.** 승인/반려 버튼은 난희가 누릅니다. 위 두 갈래(도구 재현 허용 여부 / 내용 편중 수용 여부)만 정해 주시면 그다음을 잇겠습니다.
