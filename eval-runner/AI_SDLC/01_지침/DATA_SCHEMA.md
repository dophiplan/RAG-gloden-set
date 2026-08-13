# DATA_SCHEMA.md — 데이터 규약

> 시스템이 주고받는 모든 파일의 정확한 형식. Claude Code는 이 규약대로 읽고 쓴다.
> 헌법 §4(스키마)와 일치해야 하며, 충돌 시 헌법 우선.

---

## 1. 골든셋 본문 (goldenset_draft.xlsx / goldenset_final.xlsx)

시트명: `골든셋본문`. 컬럼 1~10은 위치 고정, 11~15는 이름으로 읽음(위치 무관).

| # | 컬럼명 | 필수 | 형식/값 | 비고 |
|---|---|---|---|---|
| 1 | ID | ✅ | `{제품}-{영역}-{번호}` | 예: RM-F09, RC-SPEC-FUNC-012 |
| 2 | 유형 | ✅ | A/B/C/D/E/F/G | 문제 유형 |
| 3 | 출제 의도 | ✅ | 텍스트 | |
| 4 | 질문 | ✅ | 텍스트 | 정답을 질문에 노출 금지 |
| 5 | 정답(필수 포함 요소) | ✅ | 텍스트 | |
| 6 | 근거 출처 | ✅ | `citation_id들 ; 출처코드들` | 세미콜론 좌우분리, 같은쪽 다중은 `+` |
| 7 | 합격 기준 | ✅ | 텍스트 | Knock-out 조건 포함 |
| 8 | 난이도 | ✅ | 하/중/상 | |
| 9 | 기대 라우팅 | ✅ | 텍스트 | |
| 10 | 검증 상태 | ✅ | 초안/검토중/검증완료 | |
| 11 | 작성자/검증자 | | 텍스트 | |
| 12 | 근거 원문 발췌 | ✅(E형 제외) | verbatim 문자열 | 헌법 §2.6. E형은 비움 |
| 13 | 신뢰도 | | 텍스트/수치 | |
| 14 | acl_level | ✅ | 현재 전부 `all` | 임의 변경 금지(헌법 §4) |
| 15 | **answer_type** | ✅(신규) | `single` / `multi_equivalent` | **헌법 §3.4·ISS-006. 다음 생성부터 필수.** 없으면 single로 간주 |

> multi_equivalent면 5번 정답에 동등 답 목록을, 6번에 각 답의 출처를 매핑한다.

---

## 2. 커버리지맵 (coverage_map.xlsx)

커버리지맵 작업지시서 OKF 공통 v0.4 = 21컬럼 표준. 핵심 컬럼:

| 컬럼 | 뜻 |
|---|---|
| Unit ID | 단위 고유 ID (citation_id가 가리키는 대상) |
| source_location | 원문 위치 (파일·페이지·조항) |
| type | 단위 유형 |
| acl_level | 현재 `all` |
| citation_id | 이 단위의 인용 ID |
| related_units | 연관 단위 ID들 (영향분석에 사용) |
| 처리상태 | 커버됨 / 미커버(사유) / 사람확인 / 미검토 |
| (사유) | 미커버 시 반드시 기재 (헌법 §2.5) |

> Unit ID·source_location·type은 작업지시서 표준 그대로 — 임의 변형 금지(union 안전장치).

---

## 3. 1축 결과 (verify_1axis.json)

```json
{
  "meta": {"product":"RM","goldenset":"goldenset_draft.xlsx","corpus_files":13,"total":130,
           "by_status":{"e_trap":15,"ok_uncited":77,"partial":20,"missing":18}},
  "decisions": [
    {"id":"RM-EA01","status":"ok_uncited","found_in":["errdef.pdf"],"cited_ok":false,
     "auto_bucket":"미정","note":"발췌 실재, 출처 미인용"}
  ]
}
```
- status: `e_trap`(E형 정상) / `ok_uncited`(발췌 진짜, 출처 빔) / `partial`(표현 약간 다름) / `missing`(원문에 없음=환각 의심)
- 자동 후처리 규칙(헌법 §3.1, DEC-010):
  - e_trap → 완료(비고 "E형 의도된 부재")
  - ok_uncited → 커버리지맵에서 Unit ID 찾아 citation 채움 → 완료 (발췌 미변경)
  - partial → 사람볼것
  - missing → 사람볼것(원문 대조 필요, 절대 자동완료 금지 — 헌법 §3.2)

---

## 4. 2축 핸드오프 (handoff/)

### 내보내는 입력 (시스템 자동 생성)
- `goldenset_2axis.jsonl` — 한 줄 1문항. 필드: id, type, difficulty, question, gold_answer_required,
  answer_type, pass_criteria, citation, source_code, evidence_excerpt, acl_level, axis1_status
- `batchNN_*.txt` — 15문항씩 자동 분할(첫 줄에 "다음 문항들을 판정해줘:" + ```fence```)
- 첫 배치 전에 `judge_prompt_2axis_표준.md`(고정 키트)를 깔라는 안내

### 받는 결과 (외부 AI 출력)
```json
{"id":"RM-F01","verdict":"타당|의심|반려","answer_type_seen":"single|multi_equivalent",
 "checks":{"근거충실성":"pass|fail","정답누설":"...","Knockout":"...","유형적합":"...","E형":"pass|fail|na","정답수렴":"..."},
 "reason":"...","fix_hint":"..."}
```
- 시스템이 `judge_results.json`으로 모아 집계(타당/의심/반려), 누락 id 확인.

---

## 5. 3차 분류 핸드오프 (handoff/)

- 입력: 2축 결과 + `3차_교차검토_프롬프트.md`(고정 키트)
- 받는 결과: A(사람즉시검토) / B(경미) / C(통과후보) / ★역검출 분류표 + 집계.

---

## 6. 상태 파일 (state.json) — 제품별

SYSTEM.md §5 형식. 필드: product, current_node, nodes{각 노드 status·output·summary}, human_queue[].
- node status 값: `idle` / `running` / `waiting_external`(핸드오프 대기) / `waiting_human`(게이트 대기) / `done`

---

## 7. 로그 (logs/{제품}_{날짜}.log)

한 줄 1 결정 (탭 구분):
```
ISO시각 \t 제품 \t 노드 \t 입력(파일 v버전) \t 결정 \t 근거(헌법§/DEC)
```
- 모든 자동·사람·핸드오프 결정을 남긴다. 역추적·영향분석의 근거.

---

## 8. 미결 이슈 (OPEN_ISSUES.md 항목) — 필드 재확인

`ID / 제품 / 대상 / 발생노드 / 이슈유형 / 내용 / 재개조건 / 상태`
- 발생노드·이슈유형은 **빈칸 금지**(트리아지 패턴 감지 입력 — 헌법 §6).
