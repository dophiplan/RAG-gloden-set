#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""final_dash.py — 재추출 최종 질주: 모든 선행 구간(인수·스퍼트) 완료분을 빼고 남은 청크를
N차선으로 재분할 (난희: 16:30 목표, 빠를수록 좋음 — 2026-08-21).
선행 체크포인트 전부 보존 — 병합 때 합산. 결정적 분할이라 차선 간 중복 없음."""
import argparse
import csv
import io
import json
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import gen_coverage as gc
from olib import ROOT, N, ledger_append, load_config

ap = argparse.ArgumentParser()
ap.add_argument("--piece", type=int, required=True)
ap.add_argument("--of", type=int, required=True)
ap.add_argument("--role", required=True, choices=["generator", "reviewer", "judge"])
a = ap.parse_args()

cfg = load_config()
z = zipfile.ZipFile(ROOT / "data/CI/벡터감사/exports.zip_")
rows = []
with z.open("chunks-nhkim-all-2026-08-19.csv") as f:
    for i, r in enumerate(csv.DictReader(io.TextIOWrapper(f, "utf-8-sig"))):
        rows.append({"doc": ("FAQ" if r["doc_key"] == "288882413337" else "매뉴얼") + f"_{r['chunk_index']}",
                     "chunk_id": int(r["chunk_index"]),
                     "text": N(r.get("text", "")), "source": N(r.get("title", ""))})
kimi_target = [r for k, r in enumerate(rows) if k % 3 == 1]
plan = gc.plan_batches(kimi_target, cfg)
done_k = json.load(open(ROOT / "results/_ckpt_coverage_CI_rebasecmp_judge_s2.json"))["judge"]["done"]
rest = [c for b in plan[done_k:] for c in b]

def done_chunks(target, ckpt_name):
    """선행 구간의 완료 청크 재현 — 같은 결정적 배치 계획으로"""
    tplan = gc.plan_batches(target, cfg)
    try:
        d = json.load(open(ROOT / f"results/{ckpt_name}"))
        dn = next(v["done"] for v in d.values() if isinstance(v, dict))
    except Exception:
        return set()
    return {(c["doc"], c["chunk_id"]) for b in tplan[:dn] for c in b}

done = set()
# 1층: 인수 1·2
half1 = [c for k, c in enumerate(rest) if k % 2 == 0]
half2 = [c for k, c in enumerate(rest) if k % 2 == 1]
done |= done_chunks(half1, "_ckpt_coverage_CI_rebasecmp_takeover1.json")
done |= done_chunks(half2, "_ckpt_coverage_CI_rebasecmp_takeover2.json")
# 2층: 스퍼트 1·2·3 (인수 완료분 제외 후 3분할이었음)
remain1 = [c for c in rest if (c["doc"], c["chunk_id"]) not in done]
for p in (1, 2, 3):
    piece = [c for k, c in enumerate(remain1) if k % 3 == (p - 1)]
    done |= done_chunks(piece, f"_ckpt_coverage_CI_rebasecmp_sprint{p}.json")

remain = [c for c in rest if (c["doc"], c["chunk_id"]) not in done]
mine = [c for k, c in enumerate(remain) if k % a.of == (a.piece - 1)]
who = {"generator": "claude", "reviewer": "codex", "judge": "Kimi"}[a.role]
print(f"최종 잔여 {len(remain):,}청크 / {a.of}차선 — 내 몫 {len(mine):,} ({who} 차선{a.piece})")
if a.piece == 1:
    ledger_append("SCORING", "REBASE_FINAL_DASH", "script:final_dash",
                  evidence={"잔여": f"{len(remain):,}청크 {a.of}차선", "목표": "16:30 이전 (난희)"}, product="CI")
gc.generate_units("CI", mine, cfg, role=a.role, ckpt_tag=f"_rebasecmp_final{a.piece}",
                  phase=f"재추출 최종질주 {a.piece}/{a.of}")
print("차선 완료")
