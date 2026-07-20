# 🎯 RAG 골든셋 표준 패키지 — 이 폴더 하나가 전부다

> **이 zip이 유일한 정본이다.** 이전에 흩어져 있던 eval-runner 안의 파일들(골든셋 폴더, 리뉴얼팩, 낱개 md 등)은 전부 이 안에 최신판으로 통합됐다. 옛 파일들은 삭제하거나 `_옛날자료` 폴더로 치워도 된다.
> 통합일: 2026-07-06 · 표준 버전: 생성규칙서 v3.3 / 런북 v3.2 / SOP v1.3 / 검증규칙서 v2.4 / 방법론 v1.1 / 작업지시서 v0.4

---

## 📁 폴더 지도

```
goldenset-system/
├── README_시작하기.md      ← 지금 이 문서
├── SYSTEM.md               ← 시스템 전체 설명
├── DATA_SCHEMA.md          ← 데이터 규격 (컬럼 정의의 최상위 기준)
├── ROADMAP.md              ← 개발 로드맵
│
├── knowledge/              ← 【지식두뇌】 프로젝트의 헌법·기억
│   ├── CONSTITUTION.md         (헌법 — 절대 원칙들)
│   ├── DECISIONS.md            (판례 — 내린 결정들)
│   └── OPEN_ISSUES.md          (미결함 — 아직 못 정한 것들)
│
├── kit/                    ← 【표준 키트】 4제품 공용. AI에게 주는 문서들
│   ├── 커버리지맵_작업지시서.md    (2단계: 커버리지맵 만들 때 AI-1에게)
│   ├── 생성규칙서.md  ★v3.3      (4단계: 문항 만들 때 AI-1에게)
│   ├── SOP.md  ★v1.3            (작업 절차 — AI-1에게 같이)
│   ├── 골든셋_런북.md  ★v3.2     (복붙 프롬프트 실행판)
│   ├── 검증규칙서.md  (v2.4)     (2축 기준 — AI-2에게)
│   ├── judge_prompt_2axis_표준.md (2축 채점 프롬프트 — AI-2에게)
│   ├── 3차_교차검토_프롬프트.md    (3차 분류 — AI-3에게)
│   ├── RAG_평가_방법론.md  ★v1.1  (신규 카테고리 설계 기준)
│   └── verifier/corpus_loader.py  (1축 엔진)
│
├── tools/                  ← 【실행 프로그램】 터미널에서 python3로 돌리는 것
│   ├── run_1axis.py            (5단계: 1축 검증)
│   ├── postprocess_1axis.py    (6단계: 1축 결과 정리)
│   ├── make_batches.py         (8단계: 2축용 쪼개기)
│   ├── collect_2axis.py        (10단계: 2축 결과 집계)
│   └── ...
│
├── products/               ← 【제품별 작업물】 매일 만지는 곳
│   ├── RC/   RC_커버리지맵_통합정본_v0_4_1367행.xlsx (정본 맵)
│   │         RC_골든셋_STAGE1_v2.xlsx (진행 중 — v3 수정 대기)
│   │         원문/ ← RC 원문 PDF·xlsx 넣는 곳
│   ├── RM/   RM_골든셋_v1_3_스키마정합.xlsx (✅ 최종)
│   │         RM_커버리지맵_v04_2_disposition반영.xlsx (✅ 최종)
│   ├── RV/   RV_커버리지맵_OKF_v0_4.xlsx (골든셋 본작업 전)
│   └── HR/   인사팀_커버리지맵_OKF_v3.xlsx (골든셋 진행 중 — 최신본은 HR 채팅에)
│
└── logs/                   ← 자동 기록 (안 봐도 됨)
```

---

## 🔢 작업 순서 (한 제품 = 이 20단계)

| # | 뭐 | 누가/어디서 | 쓰는 파일 |
|---|---|---|---|
| 1 | 원문 넣기 | 너 (Finder) | → `products/{제품}/원문/` |
| 2 | 커버리지맵 생성 | AI-1 | kit/커버리지맵_작업지시서.md + 원문 |
| 3 | 맵 저장·검수 | 너 | → `products/{제품}/` |
| 4 | ✋ 설계 승인 (커버 목표·유형 비율) | 너 | — |
| 5 | 골든셋 문항 생성 | AI-1 | kit/생성규칙서.md + kit/SOP.md + 맵 + 원문 |
| 6 | 골든셋 저장 | 너 | → `products/{제품}/` |
| 7 | 1축 검증 | 터미널 | `python3 tools/run_1axis.py -p RC -g 골든셋 -c 원문/` |
| 8 | 1축 정리 | 터미널 | `python3 tools/postprocess_1axis.py -p RC -v verify_1axis.json -c 맵` |
| 9 | ✋ 사람확인 CSV 처리 | 너 | human_review_1axis.csv |
| 10 | 2축 배치 쪼개기 | 터미널 | `python3 tools/make_batches.py -p RC -g 골든셋` |
| 11 | 2축 채점 | **AI-2 (새 창!)** | kit/judge_prompt_2axis_표준.md + batch들 |
| 12 | 2축 집계 | 터미널 | `python3 tools/collect_2axis.py -p RC` |
| 13 | 3차 분류 (의심 많을 때만) | **AI-3 (또 새 창)** | kit/3차_교차검토_프롬프트.md |
| 14 | ✋ 최종 확정 | 너 | 의심·반려만 판정 |
| 15 | 검증완료 승격 → final 저장 | 너 | goldenset_final.xlsx |
| 16 | disposition → 맵 조인 (미검토 0) | AI-1 | coverage_map_final.xlsx |
| 17 | 백업 | 너 | 두 final 파일 |

## ⚠️ 절대 규칙 6개

1. **2축·3차는 만든 AI와 다른 세션** (자기검증 금지)
2. **발췌는 원문 그대로** (요약·수정 금지) / E형만 발췌 공란
3. **missing은 절대 자동완료 안 함** (사람이 원문 확인)
4. **골든셋 acl_level = 전부 `all`** (커버리지맵 값은 acl_참고로)
5. **질문은 유일하게** — 질문만 읽고 어느 단위인지 특정되게 (v3.3)
6. **수정 보고는 변경 건수 숫자로** — 숫자 없는 "완료" 보고는 접수 안 함 (v1.3)

## 🚑 막히면

- 터미널 명령은 터미널에, 문서는 AI 채팅에 (섞으면 에러)
- "지금 어디까지 했지?" → `ls products/RC/` 쳐서 어떤 파일 있나 본다
- PDF가 다 missing으로 나옴 → `pip3 install PyMuPDF openpyxl` (최초 1회)
