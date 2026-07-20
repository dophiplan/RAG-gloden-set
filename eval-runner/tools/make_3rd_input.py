#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
[작업 지시] 3차 교차검토 투입용 압축본 제작 (STAGE2 → 3차 준비)

사용자 실행법:
    cd ~/eval-runner/tools
    python3 make_3rd_input.py    # inputs/, results/ 를 읽어 3rd_input.json 생성

입력:
    inputs/2axis_input_B01.json  ~ B30.json   (문항 본문)
    results/2axis_result_B01.json ~ B30.json  (2축 판정)

출력:
    3rd_input.json  (meta / flagged / passed_summary)
"""

import json
import sys
from collections import Counter
from pathlib import Path


INPUT_DIR = Path("inputs")
RESULT_DIR = Path("results")
OUTPUT_FILE = Path("3rd_input.json")
BATCHES = [f"B{i:02d}" for i in range(1, 31)]
EXPECTED_TOTAL = 893

# flagged 출력에 담을 필드 (지시서 출력 예시 순서)
FLAGGED_FIELDS = [
    "id",
    "type",
    "verdict",
    "checks",
    "reason",
    "fix_hint",
    "question",
    "gold_answer_required",
    "answer_type",
    "pass_criteria",
    "evidence_excerpt",
    "citation",
]

# passed_summary 출력에 담을 필드
PASSED_FIELDS = ["id", "type", "reason"]


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def load_inputs():
    """inputs/2axis_input_B01.json ~ B30.json 의 items를 id 기준으로 수집"""
    inputs_by_id = {}
    for batch in BATCHES:
        path = INPUT_DIR / f"2axis_input_{batch}.json"
        data = load_json(path)
        items = data.get("items", []) if isinstance(data, dict) else data
        for item in items:
            qid = item.get("id")
            if not qid:
                raise ValueError(f"{path}: id가 누락된 문항이 있습니다.")
            if qid in inputs_by_id:
                raise ValueError(f"중복된 input id: {qid}")
            inputs_by_id[qid] = item
    return inputs_by_id


def load_results():
    """results/2axis_result_B01.json ~ B30.json 의 배열을 id 기준으로 수집"""
    results_by_id = {}
    for batch in BATCHES:
        path = RESULT_DIR / f"2axis_result_{batch}.json"
        data = load_json(path)
        if not isinstance(data, list):
            raise ValueError(f"{path}: 최상위가 배열이 아닙니다.")
        for item in data:
            qid = item.get("id")
            if not qid:
                raise ValueError(f"{path}: id가 누락된 판정이 있습니다.")
            if qid in results_by_id:
                raise ValueError(f"중복된 result id: {qid}")
            results_by_id[qid] = item
    return results_by_id


def build_output(inputs_by_id, results_by_id):
    """id 조인 후 flagged / passed_summary 분류"""
    input_ids = set(inputs_by_id.keys())
    result_ids = set(results_by_id.keys())

    only_in_input = sorted(input_ids - result_ids)
    only_in_result = sorted(result_ids - input_ids)
    if only_in_input or only_in_result:
        print("[ERROR] id 조인 실패", file=sys.stderr)
        for qid in only_in_input:
            print(f"  input에만 있음: {qid}", file=sys.stderr)
        for qid in only_in_result:
            print(f"  result에만 있음: {qid}", file=sys.stderr)
        sys.exit(1)

    flagged = []
    passed_summary = []
    verdict_counts = Counter()

    for qid in sorted(input_ids):
        inp = inputs_by_id[qid]
        res = results_by_id[qid]

        verdict = res.get("verdict")
        if verdict not in ("타당", "반려", "의심"):
            raise ValueError(f"{qid}: 알 수 없는 verdict '{verdict}'")
        verdict_counts[verdict] += 1

        if verdict in ("반려", "의심"):
            merged = {
                "id": inp.get("id"),
                "type": inp.get("type"),
                "verdict": verdict,
                "checks": res.get("checks"),
                "reason": res.get("reason"),
                "fix_hint": res.get("fix_hint"),
                "question": inp.get("question"),
                "gold_answer_required": inp.get("gold_answer_required"),
                "answer_type": inp.get("answer_type"),
                "pass_criteria": inp.get("pass_criteria"),
                "evidence_excerpt": inp.get("evidence_excerpt"),
                "citation": inp.get("citation"),
            }
            flagged.append({k: merged[k] for k in FLAGGED_FIELDS})
        else:  # 타당
            passed_summary.append({
                "id": inp.get("id"),
                "type": inp.get("type"),
                "reason": res.get("reason"),
            })

    output = {
        "meta": {
            "total": len(input_ids),
            "verdict_counts": {
                "타당": verdict_counts["타당"],
                "반려": verdict_counts["반려"],
                "의심": verdict_counts["의심"],
            },
            "made_from": "2axis results B01~B30",
        },
        "flagged": flagged,
        "passed_summary": passed_summary,
    }
    return output


def validate(output):
    """지시서의 5가지 자가검증 등식 확인"""
    total = output["meta"]["total"]
    vc = output["meta"]["verdict_counts"]
    flagged_count = len(output["flagged"])
    passed_count = len(output["passed_summary"])

    # flagged 필수 필드 결측 확인 (evidence_excerpt는 E형 null 허용)
    missing = 0
    for item in output["flagged"]:
        for k in FLAGGED_FIELDS:
            if k == "evidence_excerpt":
                continue
            if item.get(k) is None:
                missing += 1
                print(f"  [결측] {item.get('id')} 의 {k}", file=sys.stderr)

    checks = {
        "총 병합 건수 = 893": total == EXPECTED_TOTAL,
        "flagged + passed_summary = 893": flagged_count + passed_count == total,
        "verdict_counts 합 = 893": sum(vc.values()) == total,
        "조인 실패 0": True,  # build_output에서 이미 실패 시 sys.exit(1)
        "flagged 필수 필드 결측 0": missing == 0,
    }

    print("=== 자가검증 ===")
    all_ok = True
    for desc, ok in checks.items():
        status = "OK" if ok else "FAIL"
        print(f"- {desc}: {status}")
        if not ok:
            all_ok = False

    print(f"\n상세 수치: total={total}, 타당={vc['타당']}, 반려={vc['반려']}, 의심={vc['의심']}")
    print(f"flagged={flagged_count}, passed_summary={passed_count}")

    return all_ok


def main():
    inputs_by_id = load_inputs()
    results_by_id = load_results()
    output = build_output(inputs_by_id, results_by_id)

    with OUTPUT_FILE.open("w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
        f.write("\n")

    ok = validate(output)
    print(f"\n출력 파일: {OUTPUT_FILE.resolve()}")

    if not ok:
        print("\n[WARNING] 자가검증 등식이 일부 맞지 않습니다.", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
