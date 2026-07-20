#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
judge_run.py — ⑥ 캘리브레이션 판정 실행 + ⑦ 본판정 (사양서 §4-⑥⑦)

⑥: 통합 대장에서 30문항 추출(유형 비례·E 필수 포함) → judge 판정(규칙 B — 새 세션,
   [문항, 기준서]만) → 판정문 보존 → 사람 블라인드 판정 입력 시트 생성 →
   사람 판정 기입 후 대조표 완성(calibration.py 가 실측).
⑦: calibration_passed 확인(규칙 C) → 전건 판정 → 판정대장 xlsx + 무작위 재검
   {seed, 추출 ID 목록} 원장 기록 의무 [v1.1].
"""
import json
import random
import sys
import unicodedata
from collections import Counter
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).parent))
import llm
from olib import ROOT, N, load_config, load_state, ledger_append, issue_gate_card
from model_adapter import build_judge_request, effective_recheck_rate

DATA = ROOT / "data"


def load_items(prod):
    """정본 통합 대장 → 문항 리스트"""
    led = sorted((DATA / prod / "05_unified_ledger").glob("*.xlsx"))
    if not led:
        return [], None
    path = led[-1]
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    items = []
    for sn in wb.sheetnames:
        ws = wb[sn]
        try:
            hdr = [N(c) for c in next(ws.iter_rows(min_row=1, max_row=1, values_only=True))]
        except StopIteration:
            continue
        if "ID" in hdr and "질문" in hdr:
            for r in ws.iter_rows(min_row=2, values_only=True):
                d = {h: N(v) for h, v in zip(hdr, r)}
                if d.get("ID"):
                    if "정답" not in d and "정답 (필수 포함 요소)" in d:
                        d["정답"] = d["정답 (필수 포함 요소)"]
                    items.append(d)
            break
    wb.close()
    return items, path


def load_rubric(prod):
    for pat in ("*프롬프트*vFinal*", "*기준서*", "*프롬프트*"):
        c = sorted((DATA / prod / "07_stage2").glob(pat))
        if c:
            return c[-1].read_text(encoding="utf-8"), N(c[-1].name)
    return "판정 기준서: 정답 필수 요소 전건 포함=합격 / 일부=부분 / 상충·창작=0점. E형은 부재 인정만 합격.", "(기본 기준서)"


SYSTEM_J = """[TASK:JUDGE_VERDICTS] 너는 골든셋 2축 판정관이다. 입력의 판정 기준서만 따르라.
출력: JSON 배열만 — [{ID, 판정(합격|부분|0점), 판정문}]. 판정문에 조항 근거를 인용하라(전건 보존됨)."""


def judge_batch(items, rubric, cfg, batch=20):
    """규칙 B: build_judge_request 로 오염 키 제거 후 호출. 배치 단위 독립 호출(새 세션)."""
    env = None
    if llm.is_mock():   # mock 모드 = 2키 구성으로 간주 (generator+judge)
        env = {m["api_key_env"]: "mock" for m in cfg["models"].values() if m and m.get("api_key_env")}
    out = []
    for i in range(0, len(items), batch):
        part = items[i:i + batch]
        reqs = [build_judge_request(it, rubric, cfg, env=env)["inputs"]["문항"]
                for it in part]
        resp = llm.chat("judge", SYSTEM_J,
                        json.dumps({"items": reqs, "rubric": rubric[:4000]}, ensure_ascii=False), cfg)
        out += llm.extract_json(resp)
    return out


def pick_calibration_set(items, n=30):
    """유형 비례 + E형 필수 포함 (결정적: ID 정렬 후 등간 추출)"""
    by_type = {}
    for it in sorted(items, key=lambda x: x["ID"]):
        by_type.setdefault(it.get("유형", "?"), []).append(it)
    total = len(items)
    picked = []
    for t, lst in sorted(by_type.items()):
        k = max(1, round(n * len(lst) / total)) if t != "E" else max(1, min(3, len(lst)))
        step = max(1, len(lst) // k)
        picked += lst[::step][:k]
    return picked[:n] if len(picked) >= n else picked


def run_calibration_judging(prod, cfg):
    items, src = load_items(prod)
    if not items:
        return "WAITING_INPUT", {"통합 대장": "없음"}
    rubric, rname = load_rubric(prod)
    cal = pick_calibration_set(items, 30)
    verdicts = judge_batch(cal, rubric, cfg)
    vmap = {N(v["ID"]): v for v in verdicts}
    out = DATA / prod / "06_calibration" / f"{prod}_judge_캘리브레이션_판정30_v1_0.xlsx"
    out.parent.mkdir(parents=True, exist_ok=True)
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "1_judge_판정_전건"
    ws.append(["문항ID", "유형", "질문", "judge 판정", "judge 판정문(전건 보존)"])
    for it in cal:
        v = vmap.get(it["ID"], {})
        ws.append([it["ID"], it.get("유형", ""), it["질문"], N(v.get("판정", "미판정")), N(v.get("판정문", ""))])
    ws2 = wb.create_sheet("2_대조표_판정완료")
    ws2.append(["문항ID", "judge 판정", "사람 판정(설계본부 기입)", "일치 여부", "불일치 사유 분류"])
    for it in cal:
        v = vmap.get(it["ID"], {})
        ws2.append([it["ID"], N(v.get("판정", "")), "", "", ""])   # 사람 판정은 블라인드 기입
    wb.save(out)
    ev = {"세트": f"{len(cal)}문항 (유형 {dict(Counter(i.get('유형','?') for i in cal))})",
          "기준서": rname, "판정문 보존": "전건", "산출": N(out.name),
          "다음": "사람 블라인드 판정 30건 기입 → calibration measure"}
    ledger_append("CALIBRATION", "JUDGE30_EXECUTED", "script:judge_run", evidence=ev, product=prod)
    return "DONE", ev


def run_stage2(prod, cfg):
    st = load_state()
    if not st["products"][prod]["calibration_passed"]:
        return "BLOCKED", {"사유": "규칙 C — calibration_passed=false"}
    items, src = load_items(prod)
    if not items:
        return "WAITING_INPUT", {"통합 대장": "없음"}
    rubric, rname = load_rubric(prod)
    verdicts = judge_batch(items, rubric, cfg)
    vmap = {N(v["ID"]): v for v in verdicts}
    # 무작위 재검 — 시드+추출 목록 원장 기록 의무 [v1.1]
    seed = cfg["pipeline"].get("recheck_seed") or int.from_bytes(
        __import__("hashlib").sha256(f"{prod}{len(items)}{rname}".encode()).digest()[:4], "big")
    rate = effective_recheck_rate(cfg)
    rng = random.Random(seed)
    recheck_ids = sorted(rng.sample([i["ID"] for i in items], max(1, int(len(items) * rate))))
    out = DATA / prod / "07_stage2" / f"{prod}_본판정_판정대장_{len(items)}_v1_0.xlsx"
    out.parent.mkdir(parents=True, exist_ok=True)
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "판정대장"
    ws.append(["문항ID", "유형", "판정", "판정문(전건 보존)", "재검 대상"])
    cnt = Counter()
    for it in items:
        v = vmap.get(it["ID"], {})
        verdict = N(v.get("판정", "미판정"))
        cnt[verdict] += 1
        ws.append([it["ID"], it.get("유형", ""), verdict, N(v.get("판정문", "")),
                   "○" if it["ID"] in set(recheck_ids) else ""])
    wb.save(out)
    ev = {"판정": dict(cnt), "재검": f"{len(recheck_ids)}건 (rate {rate})",
          "seed": seed, "기준서": rname, "산출": N(out.name)}
    ledger_append("STAGE2", "STAGE2_JUDGED", "script:judge_run",
                  evidence={**ev, "recheck_ids": recheck_ids}, product=prod)
    return "DONE", ev


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["calibrate", "stage2"])
    ap.add_argument("--product", required=True)
    a = ap.parse_args()
    fn = run_calibration_judging if a.cmd == "calibrate" else run_stage2
    print(fn(a.product, load_config()))
