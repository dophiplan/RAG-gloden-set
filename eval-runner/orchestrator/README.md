# RAG 평가 파이프라인 오케스트레이터 v0

사양: `오케스트레이터_구현사양서_v1_3.md` (충돌 시 **인수인계서 v2** 우선 — `~/eval-runner/설계본부_인수인계서_v2.md`)
구축: 2026-07-16 G0~G6 · 2026-07-20 G7(생성·판정 엔진) + G8(v2 프로세스) · 회귀 전건 통과 + E2E 관통

**G8 (인수인계서 v2 반영, 2026-07-20)**
- 형식 게이트 강화: answer null 검사 + **meta 문서·청크 수 전 회차 대조** — r4→r5 결손(−19문서·−414청크) 실적발 ✅
- **E형 문맥 확인 의무**: 채점 후 환각 원시 판정 전건 원문 열람 자료(`E형_문맥확인.md`) + 게이트 ack 강제 (P-신규-3)
- 이중 채점기: 공식=v1.1(run_score_v11) · `tools/run_score_v12.py` 놓이면 자동 병기(+규칙 D 발동)
- **구독 CLI 앙상블**(provider: "cli") — API 키 없이 Claude Code/Codex 구독으로 생성·판정 (ANTHROPIC_API_KEY 비우기!)
- **git 우체통**(`tools/postbox.py`) — send/poll/watch, 전건 원장 기록. AI 릴레이의 기계화
- RC r4·r5 실채점 완료(공식 v11): r4 184/345/179 · r5 188/350/187 — 게이트 카드에 v1.2 개정 큐 5항목 등재

**핵심**: 코퍼스 export 하나 넣으면 ① 실측 → ③ 커버리지맵 **생성** → ④ 골든셋 **생성**(검수 7종 자동)
→ ⑥ judge 캘리브레이션 **실행** → ⑦ 본판정 **실행** → ⑧ 질문셋 **발행**·채점까지 자동 진행하고,
사람 판단 지점마다 게이트로 정지한다. 증명: `ORCH_MOCK=1 python3 tools/e2e_fulltrack.py`
(모의 제품 TT — 코퍼스 12청크 → 성적표 게이트까지 무개입 관통, 성적 top1 9/13·pass 9·E환각 1 검출)

## 켜는 법 (비개발자용)

**`dashboard/대시보드_켜기.command` 더블클릭** → 브라우저가 열립니다.
- 트랙 동그라미(①~⑨)에 마우스 = 그 단계가 뭘 하는지 + 쓰는/만드는 파일 + 보유 자료 다운로드
- 검수큐 카드의 승인/반려 버튼 = 원장에 자동 기록 (반려는 사유 필수)
- 첫 실행 시 macOS 경고가 뜨면: 파일 우클릭 → 열기

**운영 규칙 (한글 파일명·멀티 플랫폼, FLAG-03)**
1. macOS 에서는 최초 1회 `git config core.precomposeunicode true` 실행 (NFD 자소분리 커밋 방지)
2. 산출물 전달은 zip 왕복 대신 **우체통(git) 직접 커밋**으로 — 파일명 인코딩 사고 원천 차단
3. 우체통 안 신규 디렉토리명은 ASCII 권장 (outbox/ 구조 유지)

## 구조

```
orchestrator/
├── config.yaml            # models(키 개수→모드) · pipeline · terrain.profiles · paths
├── state.json             # 상태 기계 직렬화 (resume 가능)
├── ledger.jsonl           # 원장 — append-only, 수정·삭제 금지, 정정은 새 행
├── 검수큐/                 # GATE_*.md(사람 게이트) · INPUT_*.md(입력 대기) · 완료/
├── data/<제품>/<단계>/      # 데이터 층 — 제품·회차마다 갈아끼움 (§2′)
├── catalog/               # manifest.json(SHA256·정본) · stage_meta.json · catalog.json
├── results/               # score_<제품>_<회차>/ · 회귀 임시
├── tools/                 # 프로세스 층
│   ├── verify_batch.py    #   검수 7종 (§8) — exit 0 PASS/1 REJECTED/2 사용오류/3 HALT
│   ├── regression_g1.py   #   §9 회귀 스위트 (9건)
│   ├── olib.py            #   원장·상태·카드 공용
│   ├── pipeline.py        #   상태기계 + 게이트 CLI (§4~§6)
│   ├── model_adapter.py   #   1/2/3키 모드 + 규칙 A/B/B′ (§3)
│   ├── llm.py             #   LLM 클라이언트 (실모델 + ORCH_MOCK 결정적 모의)
│   ├── gen_coverage.py    #   ③ 커버리지맵 생성 + 1축 검수 반려 루프 + ③′ GAP_AUDIT
│   ├── gen_goldenset.py   #   ④ 배분계획→파일럿→차수(밴드)→마감 생성 루프
│   ├── judge_run.py       #   ⑥ 캘리브 30건 판정 실행 · ⑦ 본판정 전건 + 재검 시드
│   ├── calibration.py     #   ⑥ 일치율 실측 + 규칙 C 지문
│   ├── scoring.py         #   ⑧ 질문셋 발행 + 발행/형식 게이트 + run_score 연동 + 규칙 D
│   └── e2e_fulltrack.py   #   신규 제품 전 트랙 관통 테스트 (①→⑧)
└── dashboard/             # serve.py(로컬 API) + index.html (§10)
```

## CLI 요약

```bash
cd ~/eval-runner/orchestrator
python3 tools/pipeline.py status                 # 전 제품 현황
python3 tools/pipeline.py run --product RV       # 멈출 때까지 진행
python3 tools/pipeline.py approve <게이트ID> [--ack-all]
python3 tools/pipeline.py reject <게이트ID> --reason "..."
python3 tools/pipeline.py resume --after-fix <제품> --reason "..."   # HALT 해제 유일 경로
python3 tools/pipeline.py appeal <게이트ID> --evidence "..."
python3 tools/pipeline.py onboard --product RM --name 리모트미팅

python3 tools/verify_batch.py --batch <배치.xlsx> --map <커버리지맵.xlsx> --product RV \
    [--union <전 차수...>]                        # 흡수 대장 있으면 union 필수
python3 tools/calibration.py measure --product RV
python3 tools/scoring.py score --product RC --log <응답로그.json> --round r5
```

## §9 회귀 결과 (2026-07-16 · 9/9 통과)

| # | 케이스 | 기대 | 결과 |
|---|---|---|---|
| T1 | 합격 배치 B2 2차(57) + 합집합 | PASS | ✅ |
| T2 | 합격 배치 B6 3차 v1_1(35, 앵커 의무) | PASS | ✅ |
| T3 | 계리 불일치 (80vs79 유형 — 행 삭제 변조) | REJECTED | ✅ |
| T4 | 1축 문자 불일치 (발췌 변조) | REJECTED | ✅ |
| T5 | citation 위조 (맵 부재) | REJECTED | ✅ |
| T6 | 질문 중복 | REJECTED | ✅ |
| T7 | RVB-G07 앵커 변형 '(…게시)' | PASS+플래그 (FAIL 금지) | ✅ |
| T8 | 커버 등식 소실 5 | HALT (반려 아님) | ✅ |
| T9 | 흡수 대장 有 + union 누락 | 실행 거부 exit 2 | ✅ |

**§9′ 대체 명기 (각주)**
- B2 57문항 반려 원판 미확보 → 합격판 v1_0 변조 모의 파일로 반려 사유 재현 (T3~T6).
- RC 4차 로그 미도착(브로슈어 인입 대기) → 거절 오탐 회귀는 r2 실채점으로 대체.
  r2 재채점 실측: top1 156 · top5 308 (인수인계서 기록과 **정확 일치**) ·
  pass 172(문서 173) · E환각 15(문서 16) — 각 1건 차이는 문서 기록 시점 채점기
  스냅샷 차이로 추정, 규칙 D가 감시하는 바로 그 현상. 구채점기(v1.0) 산출물과의
  diff 19건은 전건 E형(거절 패턴 확장 수리분)으로 해명 완료.
- RVT-A22(앵커 삭제 날짜 오집계)는 실제 캘리브 대조표 불일치 사유에 원문 실재 확인
  → judge 프롬프트 vFinal 개정에 이미 반영됨 (⑥ 실측에서 검증).

## 핵심 규칙 구현 위치

| 규칙 | 내용 | 구현 |
|---|---|---|
| A | 1축은 항상 스크립트 | verify_batch.py (LLM 호출 함수 부재) |
| B | 판정 새 세션 + [문항, 기준서]만 | model_adapter.build_judge_request (오염 키 구조적 제거) |
| B′ | 해시 매니페스트 벽 | model_adapter.guard_attachments (미등록 거부+원장) |
| C | 구성/기준서 변경 → 캘리브 리셋 | calibration.check_config (지문 감시) |
| D | 채점기 변경 → 소급 재채점+비교 차단 | scoring.rule_d_check |
| §5′ | WAITING_INPUT 카드 | olib.issue_input_card + pipeline 단계 검사 |
| §6 | HALT ≠ 반려 | exit 3 vs 1 · resume --after-fix 유일 해제 |
| P-02 | 선언≠실측 | 캘리브 일치율 재계산 · 성적 실집계 · 미실측 미표시 |

## 실모델 전환 (mock → 실전)

`export GEN_KEY=... JUDGE_KEY=...` 만 하면 같은 코드가 실모델로 돈다 (config.yaml models 참조).
ORCH_MOCK 없이 키 없으면: 생성·판정 단계에서 명확한 오류로 정지 (조용한 mock 대체 없음).
생성 프롬프트는 gen_coverage.SYSTEM / gen_goldenset.SYSTEM_GEN / judge_run.SYSTEM_J —
kit/ 생성규칙서·런북 조항을 추가 반영하려면 이 프롬프트를 보강하면 된다.

## 남은 운영 항목 (코드 아님 — 실물 대기)

- RV: 팀장님 응답 로그 도착 → `data/RV/08_scoring/`에 넣고 `run` (자동 형식 게이트 → 채점)
- RC: 4차 로그(브로슈어 인입 후) → 동일 절차 · E004/E006 골든셋 개정 큐는 ⑨ 게이트에서 판단
- RM/HR: 코퍼스 export 투입 → run — 이제 커버리지맵부터 자동 생성된다 (TT E2E와 동일 경로)
- 실모델 골든셋 생성 품질은 첫 실전 배치에서 파일럿 게이트로 사람이 확인 (파이프라인이 강제)
